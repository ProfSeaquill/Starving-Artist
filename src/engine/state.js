// state.js — core game state & helpers for Starving Artist

// ---- Stage constants ----
export const STAGE_HOME    = 'home';
export const STAGE_DREAMER = 'dreamer';
export const STAGE_AMATEUR = 'amateur';
export const STAGE_PRO     = 'pro';

// ---- Game status constants ----
export const STATUS_IN_PROGRESS = 'in_progress';
export const STATUS_WON         = 'won';
export const STATUS_LOST        = 'lost';

// ---- Default config (can be overridden by external JSON later) ----
export const DEFAULT_CONFIG = {
  home: {
    // rollSequence: meaning "must roll strictly greater than each value in order"
    // This corresponds to: >4, then >3, then >2
    rollSequence: [4, 3, 2]
  },
  dreamer: {
    advanceThresholds: {
      money: 5,
      inspiration: 5,
      craft: 3
    },
    advanceRollTarget: 4
  },
  amateur: {
    portfolioCost: {
      money: 5,
      inspiration: 3,
      craft: 2
    },
    proAdvanceRollTarget: 4,
    maxMinorWorks: 3,
    jobLossSkipCount: 3
  },
  pro: {
    maintenanceRollTarget: 4,
    masterworkTargetProgress: 10
  },
  global: {
    maxTurns: 40,
    starvationGraceTurns: 2
  }
};

// ---- Job definitions (single source of truth for IDs & effects) ----
// These effects are applied when a player chooses "Go To Work" in the Amateur stage.
// timeDelta applies to the remaining timeThisTurn (usually negative, except Student).
export const JOBS = [
  {
    id: 'job_teacher',
    name: 'Teacher',
    moneyDelta: 1,
    inspirationDelta: 2,
    foodDelta: 0,
    timeDelta: -2
  },
  {
    id: 'job_programmer',
    name: 'Programmer',
    moneyDelta: 2,
    inspirationDelta: -1,
    foodDelta: 0,
    timeDelta: -1
  },
  {
    id: 'job_admin',
    name: 'Admin',
    moneyDelta: 1,
    inspirationDelta: -2,
    foodDelta: 1,
    timeDelta: 0
  },
  {
    id: 'job_student',
    name: 'Student',
    moneyDelta: -1,
    inspirationDelta: 0,
    foodDelta: 1,
    timeDelta: 2
  },
  {
    id: 'job_drug_dealer',
    name: 'Drug Dealer',
    moneyDelta: 3,
    inspirationDelta: 1,
    foodDelta: 0,
    timeDelta: -3
  },
  {
    id: 'job_volunteer',
    name: 'Volunteer',
    moneyDelta: -2,
    inspirationDelta: 3,
    foodDelta: 1,
    timeDelta: 0
  }
];

// Convenience: array of all job IDs (for availability tracking).
export const JOB_IDS = JOBS.map(j => j.id);

// ---- Player factory ----
let nextPlayerId = 1;

/**
 * Create a new player with default starting stats on the Home track.
 * 
 * @param {string} name - Display name, e.g. "Player 1"
 * @param {string} artPath - e.g. 'author' | 'painter' | 'actor' | ...
 * @returns {object} PlayerState
 */
export function createPlayer(name, artPath) {
  const id = `P${nextPlayerId++}`;
  return {
    id,
    name,
    artPath,           // identity only (for now)
    stage: STAGE_HOME,

    // Core stats
    money: 0,
    food: 0,
    inspiration: 0,
    craft: 0,

    // Per-turn time (not stored between turns)
    timeThisTurn: 0,

    // Stage-specific progress
    homeProgress: 0,       // 0..rollSequence.length
    minorWorks: [],        // array of MinorWorkState (we'll define shape later)
    portfolioBuilt: false,
    masterworkProgress: 0,

    // Amateur job state
    jobId: null,           // one of JOB_IDS
    skippedWorkCount: 0,

    // NEW: remember which jobs this player has been fired from
    firedJobs: [],
    
    // For future: burnout flags, conditions, etc.
    flags: {}
  };
}

/**
 * Create the initial game state.
 * 
 * NOTE: For now this assumes a single-player game. We still use a players[]
 * array so that multiplayer/hotseat can be added later without rewriting the core.
 * 
 * @param {object} options
 * @param {number} options.numPlayers - how many players to create (default 1)
 * @param {string[]} options.artPaths - optional array of art paths, one per player
 * @param {object} options.config - optional config override; merged shallowly over DEFAULT_CONFIG
 */
export function createInitialGame(options = {}) {
  const {
    numPlayers = 1,
    artPaths = [],
    config: configOverride = {}
  } = options;

  const config = {
    home:    { ...DEFAULT_CONFIG.home,    ...(configOverride.home    || {}) },
    dreamer: { ...DEFAULT_CONFIG.dreamer, ...(configOverride.dreamer || {}) },
    amateur: { ...DEFAULT_CONFIG.amateur, ...(configOverride.amateur || {}) },
    pro:     { ...DEFAULT_CONFIG.pro,     ...(configOverride.pro     || {}) },
    global:  { ...DEFAULT_CONFIG.global,  ...(configOverride.global  || {}) }
  };

  // Create players
  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    const name    = `Player ${i + 1}`;
    const artPath = artPaths[i] || 'painter'; // default path
    players.push(createPlayer(name, artPath));
  }

  const gameState = {
    // Turn & round tracking
    turn: 1,                // "round" number (in multiplayer this increments after all players act)
    activePlayerIndex: 0,   // index into players[]

    // Players & config
    players,
    config,

    // Global decks / piles (to be initialized later in main.js or a deck module)
    // For now, just placeholders. We'll wire real decks once data loading is in place.
    homeDeck: [],
    homeDiscard: [],
    socialDeck: [],
    socialDiscard: [],
    jobDeck: JOB_IDS.slice(),  // all jobs initially available (no duplicates)
    jobDiscard: [],
    profDevDeck: [],
    profDevDiscard: [],
    proDeck: [],
    proDiscard: [],
    cultureDeck: [],
    cultureDiscard: [],

    // Active global culture card
    currentCultureCard: null, // will hold the full card object once drawn

    // Global status & loss tracking
    status: STATUS_IN_PROGRESS,
    lossReason: null,          // e.g. 'starvation' | 'max_turns' | 'other'

    // For starvation or other global counters
    starvationCounter: 0       // how many turns Food has been at/below 0
  };

  return gameState;
}

// ---- Selector helpers ----

/**
 * Get the currently active player.
 */
export function getActivePlayer(gameState) {
  return gameState.players[gameState.activePlayerIndex] || null;
}

/**
 * Convenience helper to immutably update the active player.
 * 
 * updater receives the current player object and should return a new one.
 */
export function updateActivePlayer(gameState, updater) {
  const idx = gameState.activePlayerIndex;
  const current = gameState.players[idx];
  if (!current) return gameState;

  const updated = updater(current);

  // Global stat floor: these stats can never go below 0.
  // (Money is intentionally not clamped; debt is allowed.)
  const clamp0 = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0);

  // Only clamp if the property exists on the updated object
  // (avoids accidentally creating/overwriting fields).
  const fixed = { ...updated };
  if ('food' in fixed) fixed.food = clamp0(fixed.food);
  if ('inspiration' in fixed) fixed.inspiration = clamp0(fixed.inspiration);
  if ('craft' in fixed) fixed.craft = clamp0(fixed.craft);
  if ('time' in fixed) fixed.time = clamp0(fixed.time);
  
  const players = gameState.players.slice();
  players[idx] = fixed;

  return { ...gameState, players };
}


/**
 * Simple helper to check if the game is over.
 */
export function isGameOver(gameState) {
  return gameState.status === STATUS_WON || gameState.status === STATUS_LOST;
}
