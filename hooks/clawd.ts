// Clawd's player: which animation runs when, hearts, and the half-block drawing.
import { COLS, PALETTE, SPRITES } from './clawd-anims'

// `times` replays the loop that often unless something holds it; `shift` walks Clawd
// that many cells left and back over the clip.
export type Clip = { sprite: string; from: number; to: number; loop?: [number, number]; fps: number; times?: number; shift?: number }

// Frame ranges as Claude Desktop plays them.
export const CLIPS: Record<string, Clip> = {
  idle: { sprite: 'LookingAround', from: 0, to: 0, fps: 12 },
  lookAround: { sprite: 'LookingAround', from: 4, to: 30, fps: 12 },
  eyes: { sprite: 'LookingAroundEyesOnly', from: 0, to: 41, fps: 12 },
  sway: { sprite: 'Swaying', from: 4, to: 48, fps: 12 },
  turning: { sprite: 'Turning', from: 2, to: 26, fps: 12 },
  wave: { sprite: 'Waving', from: 3, to: 16, fps: 12 },
  hula: { sprite: 'Hula', from: 6, to: 53, fps: 12 },
  dance: { sprite: 'DancingHappy', from: 4, to: 38, fps: 12 },
  excited: { sprite: 'Excited', from: 2, to: 21, fps: 14 },
  disappointed: { sprite: 'Disappointed', from: 2, to: 42, fps: 12 },
  dizzy: { sprite: 'Dizzy', from: 0, to: 40, fps: 12 },
  facepalm: { sprite: 'Facepalm', from: 2, to: 33, fps: 12 },
  meditate: { sprite: 'Meditating', from: 2, to: 59, fps: 12 },
  laptop: { sprite: 'Laptop', from: 2, to: 33, loop: [17, 33], fps: 12 },
  laptopOut: { sprite: 'Laptop', from: 34, to: 42, fps: 16 },
  crab: { sprite: 'CrabWalking', from: 4, to: 11, loop: [4, 11], times: 5, fps: 16, shift: 6 },
  walk: { sprite: 'Walking', from: 4, to: 9, loop: [5, 9], times: 6, fps: 12, shift: 5 },
  run: { sprite: 'Running', from: 5, to: 16, loop: [5, 16], times: 2, fps: 16 },
  point: { sprite: 'Pointing', from: 3, to: 42, fps: 12 },
  breakdance: { sprite: 'BreakDancing', from: 2, to: 27, fps: 12 },
  spark: { sprite: 'Spark', from: 2, to: 68, fps: 13 },
  jump: { sprite: 'Jumping', from: 0, to: 20, fps: 14 },
  // Compaction: sheets of context drop onto a pile and a press packs them, a press a loop;
  // then the pile is a little cube and Clawd hops.
  compact: { sprite: 'Compact', from: 0, to: 38, loop: [20, 38], fps: 10 },
  compactOut: { sprite: 'CompactOut', from: 0, to: 7, fps: 8 },
  // Warming the cache: Clawd sits down by a campfire, warms his hands, pokes the fire and
  // tosses a log in (a loop of 64), then the fire dies down and he stands up.
  campfire: { sprite: 'Campfire', from: 0, to: 72, loop: [9, 72], fps: 11 },
  campfireOut: { sprite: 'CampfireOut', from: 0, to: 11, fps: 11 },
}

export function clipLength(c: Clip) {
  return c.to - c.from + 1 + (c.loop ? (c.loop[1] - c.loop[0] + 1) * (c.times ?? 0) : 0)
}

// How far left a walking clip has taken Clawd after `played` frames: out and back.
export function shiftAt(c: Clip, played: number) {
  if (!c.shift) return 0
  const t = Math.min(1, played / clipLength(c))
  return Math.round(c.shift * (t < 0.5 ? t * 2 : 2 - t * 2))
}

const IDLE_SHOTS = [
  'lookAround', 'eyes', 'sway', 'turning', 'wave', 'lookAround', 'eyes', 'hula',
  'crab', 'walk', 'run', 'point', 'breakdance', 'spark', 'jump', 'dance',
]

export type Scene = {
  // What keeps Clawd busy: a model turn (laptop) or the cache guard warming (campfire).
  busy: 'turn' | 'guard' | null
  // Clawd watches the cache (warm mode on): between other things he sits at the campfire.
  warm: boolean
  // Any compaction: /compact, auto-compact or the guard's.
  compacting: boolean
  sleepy: boolean
  sweaty: boolean
  reaction: string | null
}

// How often, with warm mode on, an idle Clawd goes back to the campfire.
export const WARM_SHARE = 0.7

// The clip after `current` ends (or is interrupted by work starting).
export function nextClip(current: string, s: Scene, rnd: number): string {
  if (s.compacting) return 'compact'
  if (current === 'compact') return 'compactOut'
  if (s.busy) return s.busy === 'turn' ? 'laptop' : 'campfire'
  if (current === 'laptop') return 'laptopOut'
  if (current === 'campfire') return 'campfireOut'
  if (s.reaction) return s.reaction
  if (current !== 'idle') return 'idle'
  // Watching the cache, he goes back to the fire most times, and now and then does something else.
  if (s.warm) {
    if (rnd < WARM_SHARE) return 'campfire'
    rnd = (rnd - WARM_SHARE) / (1 - WARM_SHARE)
  }
  if (s.sleepy) return 'meditate'
  if (s.sweaty) return rnd < 0.5 ? 'dizzy' : 'facepalm'
  return IDLE_SHOTS[Math.floor(rnd * IDLE_SHOTS.length)]
}

export type Heart = { x: number; y: number }

const HEART_COLOR = '#ff5c8a'

// Hearts are glyphs drifting up the cells right of Clawd, a few rows a second.
export function moveHearts(hearts: Heart[]): Heart[] {
  return hearts.map(h => ({ ...h, y: h.y - 0.12 })).filter(h => h.y > -0.5)
}

// Later hearts start below the band and rise into view one after another.
export function spawnHearts(n: number, seed: number): Heart[] {
  return Array.from({ length: n }, (_, i) => ({ x: BODY_RIGHT + 1 + ((seed + i) % 2), y: 2 + i * 1.4 }))
}

// Clawd's body ends at this column; two more hold hearts, z's and sparks.
export const BODY_RIGHT = 17
const spans: Record<string, [number, number]> = {}

// The columns a clip can paint, so the band gives it no more room than it uses:
// a laptop, a campfire, a press or a crab walk widen it to the left only while they play.
export function clipSpan(clip: string): [number, number] {
  const c = CLIPS[clip]
  if (!spans[c.sprite]) {
    let lo = COLS
    let hi = 0
    for (const f of SPRITES[c.sprite]) {
      for (const row of f) {
        for (let x = 0; x < row.length; x++) {
          if (row[x] !== '.') {
            lo = Math.min(lo, x)
            hi = Math.max(hi, x)
          }
        }
      }
    }
    spans[c.sprite] = [lo, hi]
  }
  const [lo, hi] = spans[c.sprite]
  return [Math.max(0, lo - (c.shift ?? 0)), Math.min(COLS - 1, Math.max(hi, BODY_RIGHT) + 2)]
}

export type Cell = { text: string; fg?: string; bg?: string }

// One frame, hearts and per-cell glyphs (a 'z', a drop) drawn as rows of terminal
// cells: '▀' painted with the top pixel, its background the bottom one.
export function draw(clip: string, frame: number, hearts: Heart[], glyphs: Record<string, Cell> = {}, shift = 0, span: [number, number] = [0, COLS - 1]): Cell[][] {
  const c = CLIPS[clip]
  const rows = SPRITES[c.sprite][Math.min(frame, SPRITES[c.sprite].length - 1)]
  const px: (string | undefined)[][] = rows.map(r =>
    [...(r.slice(shift) + '.'.repeat(shift))].map(ch => (ch === '.' ? undefined : PALETTE[ch.charCodeAt(0) - 97])),
  )
  const marks: Record<string, Cell> = { ...glyphs }
  for (const h of hearts) {
    const row = Math.round(h.y)
    if (row >= 0 && row < px.length / 2) marks[`${row},${h.x}`] = { text: h.y < 0.8 ? '♡' : '♥', fg: HEART_COLOR }
  }
  const out: Cell[][] = []
  for (let y = 0; y < px.length; y += 2) {
    const runs: Cell[] = []
    px[y].slice(span[0], span[1] + 1).forEach((top, i) => {
      const x = i + span[0]
      const bottom = px[y + 1]?.[x]
      const cell: Cell =
        marks[`${y / 2},${x}`] && !top && !bottom ? marks[`${y / 2},${x}`]
        : top && bottom ? (top === bottom ? { text: '█', fg: top } : { text: '▀', fg: top, bg: bottom })
        : top ? { text: '▀', fg: top }
        : bottom ? { text: '▄', fg: bottom }
        : { text: ' ' }
      const last = runs[runs.length - 1]
      if (last && last.fg === cell.fg && last.bg === cell.bg && last.text.length && [...last.text][0] === cell.text) last.text += cell.text
      else runs.push({ ...cell })
    })
    out.push(runs)
  }
  return out
}

const SPARKS = ['✦', '✧', '⋆', '·']

// Glyphs a clip throws around itself: sparks over the campfire,
// dust when the press slams, a glint on the packed cube, sparks as Clawd sparks.
export function clipGlyphs(clip: string, frame: number, tick: number): Record<string, Cell> {
  const g: Record<string, Cell> = {}
  if (clip === 'campfire' && frame >= CLIPS.campfire!.loop![0]) {
    g[`0,${tick % 4 < 2 ? 2 : 4}`] = { text: tick % 3 ? '˙' : '·', fg: '#f2c94c' }
  }
  // Clawd's head row empty: the frame where he and the press come down.
  if (clip === 'compact' && SPRITES.Compact[frame]?.[0][10] === '.') {
    g['2,6'] = { text: tick % 2 ? '·' : '˙', fg: '#8b8b8b' }
    g['2,17'] = { text: tick % 2 ? '˙' : '·', fg: '#8b8b8b' }
  }
  if (clip === 'compactOut' && frame >= 2 && frame <= 6) g[`1,${frame % 2 ? 1 : 4}`] = { text: SPARKS[frame % SPARKS.length]!, fg: '#ffd866' }
  if (clip === 'spark') {
    const spots = [[0, 5], [0, 19], [1, 4], [1, 18], [0, 7], [0, 16]]
    spots.forEach(([r, c], i) => {
      if ((tick + i) % 3 !== 0) g[`${r},${c}`] = { text: SPARKS[(tick + i) % SPARKS.length], fg: i % 2 ? '#ffd866' : '#faf7e5' }
    })
  }
  return g
}
