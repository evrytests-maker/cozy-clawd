import { expect, mock, test } from 'claude-code/testing'

import { CLIPS, clipGlyphs, clipLength, clipSpan, draw, moveHearts, nextClip, shiftAt, spawnHearts } from './clawd'
import { COLS } from './clawd-anims'
import { CACHE_TTL_MS, MAX_WARMS, baseModel, freshLimits, guardDue, lineBar, modelName, pct, ramp, resetsIn, settingsEffort } from './register'

const band = (isWorking: boolean) =>
  ({
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 12, bodyColumns: 140, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  }) as const

test('clawd clips follow the session, sprites draw as three rows', () => {
  const calm = { busy: null, warm: false, compacting: false, sleepy: false, sweaty: false, reaction: null, typing: 0 }
  expect(nextClip('idle', { ...calm, busy: 'turn' }, 0)).toBe('laptop')
  // Laptop down, he types as fast as the model writes, and switches as it speeds up.
  expect(nextClip('laptop', { ...calm, busy: 'turn', typing: 2 }, 0)).toBe('type2')
  expect(nextClip('type2', { ...calm, busy: 'turn', typing: 3 }, 0)).toBe('type3')
  expect(nextClip('type3', { ...calm, busy: 'turn' }, 0)).toBe('type0')
  expect(nextClip('type1', calm, 0)).toBe('laptopOut')
  expect(nextClip('laptop', calm, 0)).toBe('laptopOut')
  // All of his typing takes the laptop's columns, so the band does not jump as he speeds up.
  for (const k of ['type0', 'type1', 'type2', 'type3']) expect(clipSpan(k)).toEqual(clipSpan('laptop'))
  expect(Object.keys(clipGlyphs('type3', 15, 0)).length).toBe(1)
  expect(nextClip('laptopOut', { ...calm, reaction: 'dance' }, 0)).toBe('dance')
  expect(nextClip('dance', calm, 0)).toBe('idle')
  expect(nextClip('idle', { ...calm, sleepy: true }, 0)).toBe('meditate')
  expect(['dizzy', 'facepalm']).toContain(nextClip('idle', { ...calm, sweaty: true }, 0.7))
  // Warming the cache lights a campfire; it dies down once the guard is done.
  expect(nextClip('idle', { ...calm, busy: 'guard' }, 0)).toBe('campfire')
  expect(nextClip('campfire', calm, 0)).toBe('campfireOut')
  // With warm mode on an idle Clawd goes to the fire and stays there: no other clips.
  for (const rnd of [0, 0.5, 0.99]) expect(nextClip('idle', { ...calm, warm: true }, rnd)).toBe('campfire')
  expect(nextClip('campfire', { ...calm, warm: true }, 0.5)).toBe('campfireSit')
  expect(nextClip('campfireLog', { ...calm, warm: true }, 0.5)).toBe('campfireSit')
  expect(nextClip('campfireLog', calm, 0.5)).toBe('campfireOut')
  expect(nextClip('campfireSit', { ...calm, warm: true, busy: 'turn' }, 0)).toBe('laptop')
  expect(nextClip('idle', calm, 0.1)).not.toBe('campfire')
  expect(Object.keys(clipGlyphs('campfire', 12, 0))).toEqual(['0,2'])
  expect(Object.keys(clipGlyphs('campfire', 2, 0))).toEqual([])
  // Compaction runs the press even mid-turn, then leaves a packed cube.
  expect(nextClip('laptop', { ...calm, busy: 'turn', compacting: true }, 0)).toBe('compact')
  expect(nextClip('compact', calm, 0)).toBe('compactOut')
  // The press slams once per loop: dust beside the pile on those frames only.
  const slams = Array.from({ length: 39 }, (_, f) => f).filter(f => clipGlyphs('compact', f, 0)['2,6'])
  expect(slams.length).toBeGreaterThan(0)
  expect(slams.some(f => f >= CLIPS.compact.loop![0])).toBe(true)
  expect(Object.keys(clipGlyphs('compactOut', 3, 1)).length).toBeGreaterThan(0)
  // A crab walk takes Clawd out to the left and back.
  const crab = CLIPS.crab
  expect(shiftAt(crab, 0)).toBe(0)
  expect(shiftAt(crab, clipLength(crab) / 2)).toBe(crab.shift)
  expect(shiftAt(crab, clipLength(crab))).toBe(0)
  expect(modelName('claude-opus-5-5[1m]')).toBe('Opus 5.5 1M')
  expect(modelName('claude-haiku-5-5')).toBe('Haiku 5.5')
  expect(modelName('Sonnet 5.5')).toBe('Sonnet 5.5')
  // Effort before the first request: the model's own setting first, then the global one.
  const settings = { effortLevel: 'medium', modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' } } }
  expect(settingsEffort(settings, 'claude-opus-5-5[1m]')).toBe('high')
  expect(settingsEffort(settings, 'claude-haiku-5-5')).toBe('medium')
  expect(settingsEffort({}, 'claude-haiku-5-5')).toBeUndefined()
  expect(baseModel('claude-opus-5-5[1m]')).toBe('claude-opus-5-5')
  // Every frame of every clip is the same 22x3 box, so the band never jumps.
  for (const [name, c] of Object.entries(CLIPS)) {
    for (const f of [c.from, c.to]) {
      const rows = draw(name, f, [])
      expect(rows.length).toBe(3)
      for (const r of rows) expect(r.reduce((n, x) => n + [...x.text].length, 0)).toBe(COLS)
    }
  }
  // Hearts rise and fade out.
  let h = spawnHearts(2, 0)
  for (let i = 0; i < 80; i++) h = moveHearts(h)
  expect(h.length).toBe(0)
  expect(draw('idle', 0, [{ x: COLS - 2, y: 2 }]).flat().some(c => c.text === '♥')).toBe(true)
  // 50% of 4 cells: two thick, two thin; the shine lights one cell.
  expect(lineBar(50, 4, '#000000').map(r => r.text).join('')).toBe('━━──')
  expect(lineBar(50, 4, '#000000', 1).length).toBe(3)
  // Percents keep a space from the bar at any value, 100% included.
  expect(pct(100)).toBe(' 100%')
  expect(pct(7)).toBe('   7%')
  expect(pct(null)).toBe('    —')
  expect(ramp([[0, '#000000'], [1, '#ffffff']], 0.5)).toBe('#808080')
  expect(resetsIn('2026-10-12T12:10:00Z', Date.parse('2026-10-12T10:00:00Z'), { d: 'd', h: 'h', m: 'm' })).toBe('2h 10m')
})

test('band shows eased stats, cache from main thread only', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  const toasts: string[] = []
  on('ui.toast', (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        tokens: 128_000,
        window: 1_000_000,
        percent: 13,
        breakdown: {
          categories: [], totalTokens: 128_000, maxTokens: 512_000, rawMaxTokens: 512_000,
          autocompactSource: 'settings' as const, percentage: 25, gridRows: [], model: 'm',
          memoryFiles: [], mcpTools: [], agents: [], isAutoCompactEnabled: true, apiUsage: null,
        },
      },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 34, resetsAt: '2026-10-12T12:10:00Z' },
        { kind: 'seven_day', percentUsed: 12, resetsAt: '2026-10-16T10:00:00Z' },
      ],
      cost: { usd: 1.5 },
    },
  }))
  on('turn.step', async function* (_$, e) {
    const read = e.agentId ? 0 : 900
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const,
      usage: { model: 'm', input_tokens: 100, output_tokens: 5, cache_read_input_tokens: read, cache_creation_input_tokens: 900 - read },
    }
  })
  const step = async (index: number, agentId?: string) => {
    for await (const _ of $.turn.step({ turnId: 't', index, model: 'm', messageCount: 1, agentId }));
  }
  await step(0)
  await step(0, 'sub') // ignored

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'cozy-clawd', surface, ...band(false) })
    await clock.advance(3000) // let the bars ease in
    // The context shows its percent; a press on it switches to the tokens and back.
    expect((await ui.find({ key: 'ctx' }))?.text).toBe('  25%')
    await ui.press({ key: 'ctx' })
    expect((await ui.find({ key: 'ctx' }))?.text).toBe(' 128k/512k')
    await ui.press({ key: 'ctx' })
    expect((await ui.find({ key: 'ctx' }))?.text).toBe('  25%')
    expect(await ui.find({ type: 'Text', text: '  90%' })).toBeDefined()
    // A limit shows its percent; a press shows when it resets instead, and back.
    expect((await ui.find({ key: 'lim0' }))?.text).toBe('  34%')
    expect(await ui.find({ type: 'Text', text: /2h10m/ })).toBeUndefined()
    await ui.press({ key: 'lim0' })
    expect((await ui.find({ key: 'lim0' }))?.text).toBe(' 2h10m')
    await ui.press({ key: 'lim0' })
    expect((await ui.find({ key: 'lim0' }))?.text).toBe('  34%')
    expect(await ui.find({ type: 'Text', text: 'cache 60m left' })).toBeDefined()
    if (surface === 'desktop') {
      // Clawd is plain Text there; the guard's own button switches it.
      expect(await ui.find({ key: 'clawd0' })).toBeUndefined()
      expect((await ui.find({ key: 'guard' }))?.text).toBe('Clawd: off')
      await ui.press({ key: 'guard' })
      expect((await ui.find({ key: 'guard' }))?.text).toBe('Clawd: warm')
      await ui.press({ key: 'guard' })
      expect((await ui.find({ key: 'guard' }))?.text).toBe('Clawd: off')
    } else {
      // A click on Clawd switches the cache guard on and off, shown in the info row only.
      await ui.press({ key: 'clawd1' })
      expect(await ui.find({ type: 'Text', text: 'Clawd: warm' })).toBeDefined()
      await ui.press({ key: 'clawd0' })
      expect(await ui.find({ type: 'Text', text: 'Clawd: warm' })).toBeUndefined()
    }
    expect(toasts).toEqual([])
    await ui.unmount()
  }
})

test('guard acts only in the last 5 minutes of the cache, once per idle stretch', () => {
  const at = 1_000_000
  const g = (mode: 'off' | 'warm', warms = 0) => ({ mode, warms })
  const late = at + CACHE_TTL_MS - 2 * 60_000
  expect(guardDue(g('warm'), at, at + 30 * 60_000, false)).toBe(false)
  expect(guardDue(g('warm'), at, late, false)).toBe(true)
  expect(guardDue(g('warm'), at, late, true)).toBe(false)
  expect(guardDue(g('warm'), at, at + CACHE_TTL_MS + 1, false)).toBe(false)
  expect(guardDue(g('warm', MAX_WARMS - 1), at, late, false)).toBe(true)
  expect(guardDue(g('warm', MAX_WARMS), at, late, false)).toBe(false)
  expect(guardDue(g('off'), at, late, false)).toBe(false)
  // A guard saved by the old version in 'compact' mode stays off.
  expect(guardDue({ mode: 'compact' as 'off', warms: 0 }, at, late, false)).toBe(false)
})

test('warm mode pings through a fork just before the cache lapses', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  let forks = 0
  on('model.fork', () => {
    forks += 1
    return { value: { isAnswered: true as const, text: '.', usage: { input_tokens: 5, output_tokens: 1, cache_read_input_tokens: 300_000, cache_creation_input_tokens: 0 } } }
  })
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const,
      usage: { model: 'm', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 9 },
    }
  })
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 }));
  const ui = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', ...band(false) })
  await ui.press({ key: 'clawd0' }) // guard on
  await ui.unmount() // the guard runs without the band drawn
  for (let m = 0; m < 50; m++) await clock.advance(60_000)
  expect(forks).toBe(0)
  for (let m = 0; m < 6; m++) await clock.advance(60_000)
  expect(forks).toBe(1)
})

test('band labels, model and effort', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 36_000, window: 1_000_000, percent: 4 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 32, resetsAt: '2026-10-12T13:26:00Z' }],
      cost: { usd: 0.1 },
    },
  }))
  on('session.model', () => ({ value: 'claude-haiku-5-5' }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const,
      usage: { model: 'm', input_tokens: 100, output_tokens: 5, cache_read_input_tokens: 600, cache_creation_input_tokens: 300 },
    }
  })
  for await (const _ of $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1, effort: 'medium' }));
  const ui = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', ...band(false) })
  expect(await ui.find({ type: 'Text', text: 'cache ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '5h ' })).toBeDefined()
  await ui.press({ key: 'lim0' })
  expect((await ui.find({ key: 'lim0' }))?.text).toBe(' 3h26m')
  expect(await ui.find({ type: 'Text', text: 'cache 60m left' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Haiku 5.5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'medium' })).toBeDefined()
  await ui.unmount()
})

test('a limit past its reset reads 0% until a response reports it', () => {
  const now = Date.parse('2026-10-12T15:00:00Z')
  const limits = [
    { kind: 'five_hour', percent: 91, resetsAt: '2026-10-12T14:10:00Z' },
    { kind: 'seven_day', percent: 40, resetsAt: '2026-10-16T10:00:00Z' },
  ]
  expect(freshLimits(limits, now)).toEqual([{ kind: 'five_hour', percent: 0 }, limits[1]])
})

test('the costly context breakdown is not asked for on every step', async ($, on) => {
  mock.clock(on, { now: 0 })
  let deep = 0
  let plain = 0
  on('session.usage', (_$, e) => {
    if (e?.breakdown) deep += 1
    else plain += 1
    return { value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] } }
  })
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const,
      usage: { model: 'm', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 9 },
    }
  })
  for (let i = 0; i < 5; i++) for await (const _ of $.turn.step({ turnId: 't', index: i, model: 'm', messageCount: 1 }));
  expect(plain).toBeGreaterThanOrEqual(5)
  expect(deep).toBe(1)
})

test('the last limits seen are shown before a session has its own', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-12T10:00:00Z') })
  mock.store(on)
  // A fresh session: no response yet, so the engine has no readings.
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] } }))
  const limits = [
    { kind: 'five_hour', percentUsed: 40, resetsAt: '2026-10-12T12:10:00Z' },
    { kind: 'seven_day', percentUsed: 28, resetsAt: '2026-10-16T07:00:00Z' },
  ]
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({ context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: limits, changed: ['rateLimits'] })
  const ui = await $.ui.mount({ plugin: 'cozy-clawd', surface: 'terminal', ...band(false) })
  expect(await ui.find({ type: 'Text', text: '5h ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '7d ' })).toBeDefined()
  await ui.press({ key: 'lim0' })
  expect((await ui.find({ key: 'lim0' }))?.text).toBe(' 2h10m')
  await ui.unmount()
})

test('counting how fast the model writes passes its stream on untouched', async ($, on) => {
  mock.clock(on, { now: 0 })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] } }))
  const sent = [
    { kind: 'thinking' as const, index: 0, text: 'hm' },
    { kind: 'text' as const, index: 1, text: 'Hello' },
    { kind: 'tool' as const, index: 2, id: 'tu_1', name: 'Read' },
    { kind: 'input' as const, index: 2, json: '{"file_path":"a"}' },
  ]
  on('turn.step', async function* (_$, e) {
    for (const c of sent) yield c
    return {
      turnId: e.turnId, index: e.index, answer: 'Hello', toolUses: [], stopReason: 'end_turn' as const,
      usage: { model: 'm', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 9 },
    }
  })
  const got: unknown[] = []
  const stream = $.turn.step({ turnId: 't', index: 0, model: 'm', messageCount: 1 })
  let r = await stream.next()
  for (; !r.done; r = await stream.next()) got.push(r.value)
  expect(got.map(c => ({ ...(c as object), ref: undefined }))).toEqual(sent.map(c => ({ ...c, ref: undefined })))
  expect(r.value?.answer).toBe('Hello')
})

test('typing speeds up with the model, in the terminal and on the desktop', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] } }))
  on('turn.step', async function* (_$, e) {
    yield { kind: 'text' as const, index: 0, text: 'x'.repeat(40) }
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const,
      usage: { model: 'm', input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 9 },
    }
  })
  // The keys' clicks: a cell of their own in the terminal, a glyph in the desktop's picture.
  const clicks = async (ui: { find: (q: { type?: string; text?: RegExp }) => Promise<{ props: Record<string, unknown> } | undefined> }, surface: string) =>
    surface === 'terminal'
      ? (await ui.find({ type: 'Text', text: /^[˙·]$/ })) !== undefined
      : /[˙·]<\/text>/.test(String((await ui.find({ type: 'Svg' }))?.props.source ?? ''))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'cozy-clawd', surface, ...band(true) })
    await clock.advance(3000) // the laptop goes down; nothing streams yet, so no clicks
    expect(await clicks(ui, surface)).toBe(false)
    // About 40 characters every tenth of a second: flat out.
    let clicked = false
    for (let i = 0; i < 40; i++) {
      for await (const _ of $.turn.step({ turnId: 't', index: i, model: 'm', messageCount: 1 }));
      await clock.advance(100)
      clicked ||= await clicks(ui, surface)
    }
    expect(clicked).toBe(true)
    await ui.unmount()
    // The turn ends: he puts the laptop away and the band still draws.
    const after = await $.ui.mount({ plugin: 'cozy-clawd', surface, ...band(false) })
    await clock.advance(3000)
    expect(await after.find({ key: 'ctx' })).toBeDefined()
    await after.unmount()
  }
})

test('the guard keeps its press handle while Clawd animates, so a click on a shown drawing lands', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200_000, percent: 1 }, rateLimits: [] } }))
  // The press handles a drawing carries, by key: the host drops a click whose handle the band has since let go of.
  const handles = (n: unknown, out: Record<string, number> = {}): Record<string, number> => {
    if (Array.isArray(n)) n.forEach(c => handles(c, out))
    else if (n && typeof n === 'object') {
      const x = n as { props?: { key?: string }; press?: { handle: number }; children?: unknown }
      if (x.press && x.props?.key) out[x.props.key] = x.press.handle
      handles(x.children, out)
    }
    return out
  }
  for (const surface of ['desktop', 'terminal'] as const) {
    const draw = async () => handles(await $.ui.render({ component: 'AbovePrompt', props: band(false).props, surface }))
    const ui = await $.ui.mount({ plugin: 'cozy-clawd', surface, ...band(false) })
    // Warm: Clawd sits at the campfire, redrawing many times a second.
    await ui.press({ key: surface === 'desktop' ? 'guard' : 'clawd0' })
    const first = await draw()
    for (let i = 0; i < 5; i++) {
      await clock.advance(100)
      expect((await draw()).guard).toBe(first.guard)
    }
    // The guard label switches warm off on either surface.
    await ui.press({ key: 'guard' })
    expect(await ui.find({ text: 'Clawd: warm' })).toBeUndefined()
    await ui.unmount()
  }
})
