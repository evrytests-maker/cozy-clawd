import { expect, mock, test } from 'claude-code/testing'

import { CLIPS, clipGlyphs, clipLength, draw, moveHearts, nextClip, shiftAt, spawnHearts } from './clawd'
import { COLS } from './clawd-anims'
import { CACHE_TTL_MS, MAX_WARMS, baseModel, guardDue, lineBar, settingsEffort, modelName, ramp, resetsIn } from './register'

const band = (isWorking: boolean) =>
  ({
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking, maxRows: 12, bodyColumns: 140, scroll: { offset: 0, bodyRows: 12 }, view: {} },
  }) as const

test('clawd clips follow the session, sprites draw as three rows', () => {
  const calm = { busy: null, compacting: false, sleepy: false, sweaty: false, reaction: null }
  expect(nextClip('idle', { ...calm, busy: 'turn' }, 0)).toBe('laptop')
  expect(nextClip('laptop', calm, 0)).toBe('laptopOut')
  expect(nextClip('laptopOut', { ...calm, reaction: 'dance' }, 0)).toBe('dance')
  expect(nextClip('dance', calm, 0)).toBe('idle')
  expect(nextClip('idle', { ...calm, sleepy: true }, 0)).toBe('meditate')
  expect(['dizzy', 'facepalm']).toContain(nextClip('idle', { ...calm, sweaty: true }, 0.7))
  // Warming the cache lights a campfire; it dies down once the guard is done.
  expect(nextClip('idle', { ...calm, busy: 'guard' }, 0)).toBe('campfire')
  expect(nextClip('campfire', calm, 0)).toBe('campfireOut')
  expect(Object.keys(clipGlyphs('campfire', 6, 0))).toEqual(['0,0'])
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
    expect((await ui.find({ key: 'ctx' }))?.text).toBe(' 25%')
    await ui.press({ key: 'ctx' })
    expect((await ui.find({ key: 'ctx' }))?.text).toBe(' 128k/512k')
    await ui.press({ key: 'ctx' })
    expect((await ui.find({ key: 'ctx' }))?.text).toBe(' 25%')
    expect(await ui.find({ type: 'Text', text: ' 90%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: ' 2h10m' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'cache 60m left' })).toBeDefined()
    // A click on Clawd switches the cache guard on and off, shown in the info row only.
    await ui.press({ key: 'clawd1' })
    expect(await ui.find({ type: 'Text', text: 'Clawd: warm' })).toBeDefined()
    await ui.press({ key: 'clawd0' })
    expect(await ui.find({ type: 'Text', text: 'Clawd: warm' })).toBeUndefined()
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
  expect(await ui.find({ type: 'Text', text: ' 3h26m' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'cache 60m left' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Haiku 5.5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'medium' })).toBeDefined()
  await ui.unmount()
})
