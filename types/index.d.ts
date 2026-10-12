export type Limit = { kind: string; percent: number; resetsAt?: string }

export type Snap = {
  at: number
  contextTokens: number
  // Effective window (compaction limit when set).
  contextWindow: number
  contextPercent: number
  usd?: number
  // The main loop's model id and reasoning effort.
  model?: string
  effort?: string
  limits: Limit[]
}

// Main-thread prompt-cache counters, in input tokens; lastAt is the last request's time.
export type Cache = {
  steps: number
  read: number
  total: number
  lastHit: number | null
  lastAt: number | null
}

// 'warm' keeps the cache alive just before it lapses; anything else (an old 'compact') is off.
export type GuardMode = 'off' | 'warm'

// The cache guard a click on Clawd switches.
export type Guard = {
  mode: GuardMode
  // Pings sent in the current idle stretch.
  warms: number
}

declare module 'claude-code' {
  interface PluginState {
    'cozy-clawd': { snap: Snap | null; cache: Cache; guard: Guard }
  }
}
