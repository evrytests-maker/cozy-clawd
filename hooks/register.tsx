import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cache, Guard, Limit, Snap } from '../types'
import { BODY_RIGHT, CLIPS, FIRE, clipGlyphs, clipSpan, draw, drawSvg, moveHearts, nextClip, shiftAt, spawnHearts } from './clawd'
import type { Cell, Heart, Scene } from './clawd'
import { COLS } from './clawd-anims'

const snap = atom({ plugin: 'cozy-clawd', key: 'snap' } as const, null)
const cache = atom({ plugin: 'cozy-clawd', key: 'cache' } as const, {
  steps: 0,
  read: 0,
  total: 0,
  lastHit: null,
  lastAt: null,
})
const guard = atom({ plugin: 'cozy-clawd', key: 'guard' } as const, { mode: 'off', warms: 0 })

// Every word the band and its toasts say.
export const t = {
  limits: { five_hour: '5h', seven_day: '7d', spend_limit: '$' } as Record<string, string>,
  units: { d: 'd', h: 'h', m: 'm' },
  cache: 'cache',
  cacheLeft: (m: number) => `cache ${m}m left`,
  cacheAsleep: 'cache expired',
  guard: 'Clawd: warm',
  guardOff: 'Clawd: off',
  warmPrompt: 'Reply with one character: .',
  warmed: (k: number) => `Clawd warmed the cache (${k}k read from cache)`,
  warmFailed: (why: string) => `Clawd could not warm the cache: ${why}`,
}

// Subscription prompt cache lives an hour; the guard acts this long before it lapses.
export const CACHE_TTL_MS = 60 * 60_000
export const GUARD_LEAD_MS = 5 * 60_000
// Warming stops after this many pings in one idle stretch (~4h kept alive).
export const MAX_WARMS = 3
const GUARD_CHIP = '#ff8f5a'

// Bar colours by level: green → amber → red for load, the reverse for the cache.
const EMPTY = '#4b4f58'
const LOAD_RAMP: [number, string][] = [[0, '#5ad19a'], [0.6, '#f2c94c'], [1, '#ff6b6b']]
const CACHE_RAMP: [number, string][] = [[0, '#ff6b6b'], [0.5, '#f2c94c'], [1, '#5ad19a']]

// Animation lives in module variables: a reload starts it over, the data stays in $.state.
let tick = 0
let timerStarted = false
let working = false
let guarding = false
// Whether the guard is warming the cache right now; any compaction sets `compacting`.
let warming = false
// Warm mode is on: the campfire is Clawd's home base until it is switched off.
let warmOn = false
let compacting = false
// Tool calls that failed in the current turn: a facepalm afterwards.
let toolErrors = 0
// The effort the main thread's requests asked for, per model; settings until the first one.
const effortFor: Record<string, string> = {}
let lastEffort: string | undefined
let reaction: string | null = null
let clip = 'idle'
let frameAt = 0
let idleLeft = 0
let loopsLeft = 0
let played = 0
let lastWait = 0
let hearts: Heart[] = []
let cacheLeftMin: number | null = null
// Percents a press switched to their detail (the context's tokens, a limit's reset), by meter.
const flipped: Record<string, boolean> = {}
let target: Record<string, number> = {}
const shown: Record<string, number> = {}

// The auto-compact window and the settings' effort cost a walk over the whole conversation
// and a settings read, so they are asked for at the start, after a compaction, when the
// model changes and every WINDOW_MS; the figures in between come from the free call.
const WINDOW_MS = 10 * 60_000
let windowFor: { model?: string; at: number; window?: number; settings: object } = { at: -Infinity, settings: {} }

// A limit whose window has reset before any response reported the new one: the engine
// still has the old reading, but the window is fresh, so it reads 0% with no reset time.
export function freshLimits(limits: Limit[], now: number): Limit[] {
  return limits.map(l => (l.resetsAt && Date.parse(l.resetsAt) <= now ? { kind: l.kind, percent: 0 } : l))
}

async function refresh($: EngineInterface, deep = false) {
  try {
    const now = await $.clock.now()
    const model = await $.session.model().catch(() => undefined)
    if (deep || model !== windowFor.model || now - windowFor.at >= WINDOW_MS) {
      // `summary` estimates locally; rawMaxTokens is the effective (auto-compact) window.
      const full = await $.session.usage({ breakdown: 'summary', columns: 40 })
      windowFor = { model, at: now, window: full.context.breakdown?.rawMaxTokens, settings: await $.settings.read().catch(() => ({})) }
    }
    const u = await $.session.usage()
    const tokens = u.context.tokens ?? 0
    const window = windowFor.window || u.context.window
    const s: Snap = {
      at: now,
      contextTokens: tokens,
      contextWindow: window,
      contextPercent: window ? Math.min(100, (tokens / window) * 100) : 0,
      usd: u.cost?.usd,
      model,
      effort: undefined,
      limits: freshLimits(u.rateLimits.map(r => ({ kind: r.kind, percent: r.percentUsed, resetsAt: r.resetsAt })), now),
    }
    // The last request's effort stands in when the session names its model differently.
    s.effort = (s.model && (effortFor[baseModel(s.model)] ?? settingsEffort(windowFor.settings, s.model))) || lastEffort
    await update($, snap, () => s)
  } catch {
    // Keep the last snapshot; the next step or minute retries.
  }
}

// Whether the guard should warm now: inside the last GUARD_LEAD_MS of the cache's
// life, at most MAX_WARMS times per idle stretch.
export function guardDue(g: Guard, lastAt: number | null, now: number, isWorking: boolean): boolean {
  if (g.mode !== 'warm' || isWorking || lastAt === null) return false
  const idle = now - lastAt
  if (idle < CACHE_TTL_MS - GUARD_LEAD_MS || idle >= CACHE_TTL_MS) return false
  return g.warms < MAX_WARMS
}

async function runGuard($: EngineInterface) {
  const now = await $.clock.now()
  const c = await read($, cache)
  const g = await read($, guard)
  cacheLeftMin = c.lastAt === null ? null : Math.max(0, Math.ceil((c.lastAt + CACHE_TTL_MS - now) / 60_000))
  if (!guardDue(g, c.lastAt, now, working || guarding)) return
  guarding = warming = true
  kick($)
  try {
    // Re-sends the main thread's last request with a tiny tail: a cache read, which restarts the TTL.
    const r = await $.model.fork({ prompt: t.warmPrompt })
    if (r.isAnswered) {
      await update($, cache, x => ({ ...x, lastAt: now }))
      await update($, guard, x => ({ ...x, warms: x.warms + 1 }))
      cacheLeftMin = CACHE_TTL_MS / 60_000
      const hit = r.usage.cache_read_input_tokens
      $.ui.toast(t.warmed(Math.round(hit / 1000)))
    } else {
      await update($, guard, x => ({ ...x, warms: MAX_WARMS }))
      $.ui.toast(t.warmFailed(r.reason))
    }
  } catch {
    // A turn started meanwhile: the next check retries.
  } finally {
    guarding = warming = false
    kick($)
  }
}

// Eases every shown value a third of the way to its target; snaps when close.
function ease() {
  for (const k in target) {
    const from = shown[k] ?? 0
    const d = target[k] - from
    shown[k] = Math.abs(d) < 0.3 ? target[k] : from + d / 3
  }
}

function scene(): Scene {
  const sweaty = (target.ctx ?? 0) >= 85 || (target.lim0 ?? 0) >= 85
  return { busy: working ? 'turn' : warming ? 'guard' : null, warm: warmOn, compacting, sleepy: cacheLeftMin === 0, sweaty, reaction }
}

function play(name: string) {
  clip = name
  frameAt = CLIPS[name].from
  loopsLeft = CLIPS[name].times ?? 0
  played = 0
  if (name === reaction) reaction = null
  if (name === 'dance' || name === 'excited') hearts = [...hearts, ...spawnHearts(name === 'dance' ? 3 : 2, tick)]
  if (name === 'idle') idleLeft = warmOn ? 300 : 5000 + Math.random() * 8000
}

// One step of Clawd: the next frame of the clip, a loop while its reason holds,
// or the next clip. Returns how long until the next step.
// Loops of warming his hands (1.5 s each) between two logs: 4 to 8, so 6 to 12 s.
const LOG_MIN = 4
const LOG_MAX = 8
let logIn = LOG_MIN

const MAX_FPS = 12
const FRAME_MS = Math.round(1000 / MAX_FPS)

function step(): number {
  const c = CLIPS[clip]
  const atFire = (clip === 'campfire' || clip === 'campfireSit') && (warming || warmOn)
  const holds = (clip === 'laptop' && working) || atFire || (clip === 'compact' && compacting)
  played += 1
  if (clip === 'idle') {
    idleLeft -= lastWait
    if (idleLeft <= 0) play(nextClip(clip, scene(), Math.random()))
  } else if (frameAt < c.to) frameAt += 1
  else if (atFire && --logIn <= 0) {
    // Every few loops at the fire he tosses a log in; the flame flares up.
    logIn = LOG_MIN + Math.floor(Math.random() * (LOG_MAX - LOG_MIN + 1))
    play('campfireLog')
  } else if (c.loop && (holds || loopsLeft > 0)) {
    frameAt = c.loop[0]
    if (!holds) loopsLeft -= 1
  } else play(nextClip(clip, scene(), Math.random()))
  hearts = moveHearts(hearts)
  const easing = Object.keys(target).some(k => shown[k] !== target[k])
  // At most MAX_FPS redraws a second: each one redraws the band, which in a long chat adds up.
  lastWait = clip === 'idle' ? (hearts.length || easing ? FRAME_MS : Math.max(FRAME_MS, idleLeft)) : Math.max(FRAME_MS, Math.round(1000 / CLIPS[clip].fps))
  return lastWait
}

// Each loop carries its generation; a newer loop (work just started) retires the older.
let loop = 0

// The tick the band was last drawn at: while nothing draws it (collapsed, another
// view, no band at all) Clawd steps once a second instead of at his clip's speed.
let drawnAt = 0
const UNDRAWN_TICKS = 30

function animate($: EngineInterface, gen: number) {
  if (gen !== loop) return
  tick += 1
  ease()
  const wait = step()
  $.ui.invalidate('ui.render')
  $.clock.after(tick - drawnAt > UNDRAWN_TICKS ? Math.max(wait, 1000) : wait, () => animate($, gen))
}

// Interrupts the current clip when work starts or a reaction is due.
function kick($: EngineInterface) {
  const s = scene()
  const want = s.busy || s.compacting ? nextClip(clip, s, 0) : null
  // Already at the fire, the guard starting to warm keeps him there rather than sitting him down again.
  if (want && clip !== want && !(FIRE.includes(clip) && FIRE.includes(want))) play(want)
  else if (!s.busy && clip === 'idle' && reaction) play(reaction)
  loop += 1
  animate($, loop)
}

function start($: EngineInterface) {
  if (timerStarted) return
  timerStarted = true
  kick($)
  // Reset countdowns and compaction between turns.
  $.clock.every(60_000, () => void refresh($))
  $.clock.every(15_000, () => void runGuard($))
}

function hex(c: string) {
  return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
}

function mix(a: string, b: string, t: number) {
  const [x, y] = [hex(a), hex(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

export function ramp(stops: [number, string][], t: number) {
  const u = Math.max(0, Math.min(1, t))
  for (let i = 1; i < stops.length; i++) {
    const [p1, c1] = stops[i]
    const [p0, c0] = stops[i - 1]
    if (u <= p1) return mix(c0, c1, (u - p0) / (p1 - p0 || 1))
  }
  return stops[stops.length - 1][1]
}

export type Run = { text: string; fg: string }

// A thin line `width` cells long: '━' up to `p`% in `color`, '─' after; `shine` lights one cell.
export function lineBar(p: number, width: number, color: string, shine = -1): Run[] {
  const full = Math.max(0, Math.min(width, Math.round((Math.max(0, Math.min(100, p)) / 100) * width)))
  const runs: Run[] = []
  const push = (text: string, fg: string) => {
    if (!text) return
    const last = runs[runs.length - 1]
    if (last && last.fg === fg) last.text += text
    else runs.push({ text, fg })
  }
  for (let i = 0; i < full; i++) push('━', i === shine ? mix(color, '#ffffff', 0.55) : color)
  push('─'.repeat(width - full), EMPTY)
  return runs
}

// `claude-opus-5-5[1m]` → `claude-opus-5-5`: the key settings and requests share.
export const baseModel = (id: string) => id.replace(/\[1m\]$/i, '')

// The effort settings give a model: its `modelSettings` entry, else the global `effortLevel`.
export function settingsEffort(settings: object, model: string): string | undefined {
  const x = settings as { effortLevel?: string; modelSettings?: Record<string, { effortLevel?: string }> }
  return x.modelSettings?.[baseModel(model)]?.effortLevel ?? x.effortLevel
}

// `claude-opus-5-5[1m]` → `Opus 5.5 1M`; a name already pretty stays as it is.
export function modelName(id: string) {
  const m = /claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id)
  const base = m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : id.replace(/\[1m\]/, '')
  return /\[1m\]/.test(id) ? `${base} 1M` : base
}

const EFFORT_COLORS: Record<string, string> = { low: '#7aa2f7', medium: '#9ece6a', high: '#e8875f', xhigh: '#ff8f5a', max: '#ff6b6b' }

// A percent in a fixed five cells, a space before it even at 100%.
export const pct = (p: number | null) => (p === null ? '    —' : ` ${String(Math.round(p)).padStart(3)}%`)
const tok = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n))

export function resetsIn(resetsAt: string | undefined, now: number, u = t.units) {
  const ms = resetsAt ? Date.parse(resetsAt) - now : NaN
  if (!(ms > 0)) return ''
  const m = Math.round(ms / 60_000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d ? `${d}${u.d} ${h}${u.h}` : h ? `${h}${u.h} ${m % 60}${u.m}` : `${m}${u.m}`
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    start($)
    return result
  })

  // Any compaction (/compact, auto-compact) runs Clawd's press while it lasts.
  on('session.compact', async ($, e, next) => {
    if (e.trigger === 'precompute') return next(e)
    compacting = true
    kick($)
    try {
      return await next(e)
    } finally {
      compacting = false
      kick($)
      void refresh($, true)
    }
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (result.isError) toolErrors += 1
    return result
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const u = result.usage
    // Main thread only; subagents keep caches of their own.
    if (u && e.agentId === undefined) {
      if (e.effort !== undefined) effortFor[baseModel(e.model)] = lastEffort = String(e.effort)
      const total = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      const now = await $.clock.now()
      await update($, cache, c => ({
        steps: c.steps + 1,
        read: c.read + u.cache_read_input_tokens,
        total: c.total + total,
        lastHit: total ? (u.cache_read_input_tokens / total) * 100 : c.lastHit,
        lastAt: now,
      }))
      // A new idle stretch starts: the guard may act again.
      await update($, guard, g => ({ ...g, warms: 0 }))
      cacheLeftMin = CACHE_TTL_MS / 60_000
      await refresh($)
    }
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    drawnAt = tick
    start($)

    const s = await read($, snap)
    const c = await read($, cache)
    const g = await read($, guard)
    warmOn = g.mode === 'warm'
    if (e.props.isWorking !== working) {
      // A finished turn earns a reaction: hearts for a warm cache, a sigh for a cold one.
      // Failed tool calls earn a facepalm instead.
      if (working) {
        reaction = toolErrors > 0 ? 'facepalm' : c.lastHit === null ? 'excited' : c.lastHit >= 80 ? 'dance' : c.lastHit < 50 ? 'disappointed' : 'excited'
      } else toolErrors = 0
      working = e.props.isWorking
      kick($)
    }
    const limits = (s?.limits ?? []).slice(0, 2)
    target = {
      ctx: s?.contextPercent ?? 0,
      hit: c.lastHit ?? 0,
      ...Object.fromEntries(limits.map((l, i) => [`lim${i}`, l.percent])),
    }
    const v = (k: string) => shown[k] ?? 0
    const cols = e.props.bodyColumns
    const barWidth = cols >= 90 ? 10 : cols >= 70 ? 7 : 4
    const shimmer = working || guarding ? tick % (barWidth + 4) : -1
    // A click on Clawd switches the cache guard; switched on, he lights a campfire for a moment.
    const press = async () => {
      const enable = g.mode !== 'warm'
      await update($, guard, (x): Guard => ({ ...x, mode: enable ? 'warm' : 'off' }))
      warmOn = enable
      // Switched off, the fire goes out now rather than after its loop.
      if (!enable && FIRE.includes(clip) && !warming) play('campfireOut')
      reaction = enable && !FIRE.includes(clip) ? 'campfire' : null
      kick($)
    }
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
    const desktop = Svg !== undefined

    // A meter's percent; given `detail`, a switch that shows the detail in its place, and back.
    const meter = (label: string, k: string, stops: [number, string][], empty = false, detail?: string) => {
      const p = empty ? 0 : v(k)
      const color = empty ? EMPTY : ramp(stops, p / 100)
      const value = empty ? pct(null) : pct(p)
      return [
        <Text dimColor>{label} </Text>,
        ...lineBar(p, barWidth, color, shimmer).map(r => <Text color={r.fg}>{r.text}</Text>),
        detail ? (
          <Button key={k} plain onPress={() => {
            flipped[k] = !flipped[k]
            $.ui.invalidate('ui.render')
          }}>
            <Text color={color} bold>{flipped[k] ? ` ${detail}` : value}</Text>
          </Button>
        ) : (
          <Text color={color} bold>{value}</Text>
        ),
      ]
    }
    const limit = (l: { kind: string; resetsAt?: string }, i: number) => {
      const resets = s ? resetsIn(l.resetsAt, s.at).replace(' ', '') : ''
      return meter(t.limits[l.kind] ?? l.kind, `lim${i}`, LOAD_RAMP, false, resets || undefined)
    }

    const left = cacheLeftMin
    const sep = <Text dimColor> · </Text>
    // Model and effort first, then the cache's clock, the spend, the guard.
    const info = [
      ...(s?.model ? [<Text color="claude">{modelName(s.model)}</Text>] : []),
      ...(s?.effort ? [<Text> </Text>, <Text color={EFFORT_COLORS[s.effort] ?? 'subtle'}>{s.effort}</Text>] : []),
      ...(left === null || working
        ? []
        : [...(s?.model || s?.effort ? [sep] : []), <Text color={left === 0 ? 'error' : left <= 5 ? 'warning' : undefined} dimColor={left > 5}>{left ? t.cacheLeft(left) : t.cacheAsleep}</Text>]),
      ...(s?.usd !== undefined && s.usd >= 0.005 ? [sep, <Text color="#5fb8ff" bold>{`$${s.usd.toFixed(2)}`}</Text>] : []),
      // A desktop cannot press Clawd (see below): the guard gets a button of its own there.
      ...(desktop
        ? [sep, <Button key="guard" plain onPress={press}>{g.mode === 'warm' ? t.guard : t.guardOff}</Button>]
        : g.mode === 'warm' ? [sep, <Text color={GUARD_CHIP}>{t.guard}</Text>] : []),
    ]

    // Glyphs beside the sprite: z's over a meditating Clawd, a drop under load.
    const glyphs: Record<string, Cell> = clipGlyphs(clip, frameAt, tick)
    if (clip === 'meditate' || scene().sleepy) {
      const k = Math.floor(tick / 6) % 3
      glyphs[`${2 - k},${BODY_RIGHT + 1 + (k % 2)}`] = { text: k === 2 ? 'Z' : 'z', fg: '#a9b1d6' }
    }
    if (scene().sweaty && !working) glyphs[`${Math.floor(tick / 4) % 2},${BODY_RIGHT + 1}`] = { text: '˚', fg: '#7cc7ff' }

    return (
      <Box flexDirection="row" justifyContent="flex-end">
        <Box flexDirection="column" alignItems="flex-end" marginRight={1}>
          <Box flexDirection="row">
            {meter('ctx', 'ctx', LOAD_RAMP, false, s ? `${tok(s.contextTokens)}/${tok(s.contextWindow)}` : undefined)}
            <Text>  </Text>
            {meter(t.cache, 'hit', CACHE_RAMP, c.lastHit === null)}
          </Box>
          <Box flexDirection="row">
            {limits.length ? limits.map((l, i) => [i ? <Text>  </Text> : null, ...limit(l, i)]) : <Text> </Text>}
          </Box>
          <Box flexDirection="row">{info}</Box>
        </Box>
        {Svg ? (
          // A desktop draws text in its own font and Buttons natively: Clawd is a picture there.
          (() => {
            const pic = drawSvg(clip, frameAt, hearts, glyphs, shiftAt(CLIPS[clip], played), clipSpan(clip))
            return <Svg source={pic.svg} alt="Clawd" width={pic.width} height={pic.height} />
          })()
        ) : (
          <Box flexDirection="column">
            {draw(clip, frameAt, hearts, glyphs, shiftAt(CLIPS[clip], played), clipSpan(clip)).map((runs, i) => (
              <Button key={`clawd${i}`} plain onPress={press}>
                {runs.map(r => (
                  <Text color={r.fg} backgroundColor={r.bg}>{r.text}</Text>
                ))}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    )
  })
}
