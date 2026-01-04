import { ActionTypes } from './actions.js';
import {
  getActivePlayer,
  updateActivePlayer,
  updatePlayerById,
  isGameOver,
  STAGE_DREAMER,
  STAGE_AMATEUR,
  STAGE_PRO
} from './state.js';

import { rollD6 } from './dice.js';

import { homeReducer } from './stages/home_stage.js';
import { dreamerReducer } from './stages/dreamer_stage.js';
import { amateurReducer } from './stages/amateur_stage.js';
import { proReducer } from './stages/pro_stage.js';
import { getZeitgeistByRoll } from './zeitgeist.js';


console.log('[rules] loaded: fame-check enforcement patch v1');

/**
 * Main reducer. Takes the current gameState and an action,
 * returns the next gameState (pure function).
 */
export function applyAction(gameState, action) {
  if (!gameState || isGameOver(gameState)) return gameState;

  let next = gameState;

  switch (action.type) {
    case ActionTypes.START_TURN:
      next = startTurn(gameState);
      break;

    case ActionTypes.END_TURN:
      next = endTurn(gameState);
      break;

    case ActionTypes.ROLL_TIME:
      next = rollTime(gameState);
      break;

    // --- NEW: PR / Scandal ---
    case ActionTypes.LAY_LOW:
      next = layLow(gameState);
      break;

    case ActionTypes.ZEITGEIST_CONVERT_INSPIRATION:
     next = zeitgeistConvertInspiration(gameState, action);
    break;


    case ActionTypes.PLANT_HIT_PIECE:
      next = plantHitPiece(gameState, action);
      break;

    case ActionTypes.BUYOUT_SCANDAL:
      next = buyoutScandal(gameState, action);
      break;

    case ActionTypes.DOWNTIME_PRACTICE:
    case ActionTypes.DOWNTIME_SLEEP:
    case ActionTypes.DOWNTIME_EAT_AT_HOME:
      next = applyDowntimeAction(gameState, action.type);
      break;

    // Home
    case ActionTypes.DRAW_HOME_CARD:
    case ActionTypes.ATTEMPT_LEAVE_HOME:
      next = homeReducer(gameState, action);
      break;

    // Dreamer
    case ActionTypes.DRAW_SOCIAL_CARD:
    case ActionTypes.ATTEND_SOCIAL_EVENT:
    case ActionTypes.SKIP_SOCIAL_EVENT:
    case ActionTypes.CHOOSE_JOB:
    case ActionTypes.QUIT_JOB:
    case ActionTypes.GO_TO_WORK:
    case ActionTypes.ATTEMPT_ADVANCE_DREAMER:
      next = dreamerReducer(gameState, action);
      break;

    // Amateur
    case ActionTypes.TAKE_PROF_DEV:
    case ActionTypes.RESOLVE_PROF_DEV_CHOICE:
    case ActionTypes.START_MINOR_WORK:
    case ActionTypes.PROGRESS_MINOR_WORK:
    case ActionTypes.ATTEMPT_ADVANCE_PRO:
      next = amateurReducer(gameState, action);
      break;

    // Pro
    case ActionTypes.WORK_ON_MASTERWORK:
    case ActionTypes.DRAW_PRO_CARD:
    case ActionTypes.RESOLVE_PRO_CARD_CHOICE:
    case ActionTypes.PRO_MAINTENANCE_CHECK:
      next = proReducer(gameState, action);
      break;

    default:
      next = gameState;
      break;
  }

    // --- Zeitgeist triggers (first-ever Dreamer/Amateur/Pro) ---
  next = applyZeitgeistMilestones(gameState, next);

  // --- Zeitgeist post-action effects (small global hooks) ---
  next = applyZeitgeistPostAction(gameState, next, action);

  // If you did ANY action other than Lay Low / start/end turn, you lose Lay Low.
  next = consumeLayLowOnAnyOtherAction(gameState, next, action);

  return next;
}

// --- Pro Masterwork Focus (Food/Inspiration/Craft) ---
const PRO_FOCUS_STATS = ['food', 'inspiration', 'craft'];

function rollProFocusStat() {
  const i = Math.floor(Math.random() * PRO_FOCUS_STATS.length);
  return PRO_FOCUS_STATS[i];
}


/**
 * START_TURN:
 * - Reset timeThisTurn for the active player.
 * - Apply start-of-turn effects (e.g. Minor Works).
 * - Stamp a flag so the UI can show "Turn N started".
 * - (Later) culture rotation, loss checks, etc.
 */
function startTurn(gameState) {
  let next = gameState;

  next = updateActivePlayer(next, (player) => {
    // Start from existing flags and reset per-turn flags
    const baseFlags = {
      ...(player.flags || {}),
      // For UI: which turn did we start last?
      lastTurnStartedAtTurn: gameState.turn,
      // Reset per-turn time roll flags
      hasRolledTimeThisTurn: false,
      timeRerollsRemaining: 0,
      // NEW: reset per-turn work flag
      hasWorkedThisTurn: false,
      
      dreamerAdvanceAttemptedThisTurn: false,

            // PR / Scandal (per-turn)
      canLayLowThisTurn: false,
      hasActedThisTurn: false,

      zeitgeistAIConvertedThisTurn: false,
      
      didProMaintenanceThisTurn: false,
      proMaintenanceRequired: false,
      // Reset per-turn downtime usage
      usedPracticeThisTurn: false,
      usedSleepThisTurn: false,
      usedEatAtHomeThisTurn: false
    };

    // Clear per-turn Home flags
    const flags = { ...baseFlags };
    delete flags.homeCardDrawnThisTurn;
    delete flags.leaveHomeAttemptedThisTurn; // NEW

     // Lay Low is ONLY offered to Pros with Scandal, at the very start of the turn.
if (player.stage === STAGE_PRO && (player.scandal || 0) > 0) {
  flags.canLayLowThisTurn = true;
}

// --- NEW: Pro "Masterwork Focus" stat is chosen at the start of each Pro turn ---
if (player.stage === STAGE_PRO) {
  const focus = rollProFocusStat(); // 'food' | 'inspiration' | 'craft'
  flags.proMasterworkFocusStat = focus;
  flags.proMasterworkFocusSetAtTurn = gameState.turn;
} else {
  // Prevent stale focus leaking into other stages
  delete flags.proMasterworkFocusStat;
  delete flags.proMasterworkFocusSetAtTurn;
}

if (player.stage !== STAGE_AMATEUR && player.stage !== STAGE_PRO) {
  return {
    ...player,
    timeThisTurn: 0,
    flags
  };
}


    let updated = {
      ...player,
      timeThisTurn: 0,
      flags
    };

    if (Array.isArray(updated.minorWorks)) {
      for (const mw of updated.minorWorks) {
        if (!mw || !Array.isArray(mw.effectsPerTurn)) continue;
        for (const eff of mw.effectsPerTurn) {
          if (!eff || typeof eff !== 'object') continue;
          if (eff.type === 'stat') {
            const stat = eff.stat;
            const delta = eff.delta || 0;
            switch (stat) {
              case 'money':
                updated.money = (updated.money || 0) + delta;
                break;
              case 'food':
                updated.food = (updated.food || 0) + delta;
                break;
              case 'inspiration':
                updated.inspiration =
                  (updated.inspiration || 0) + delta;
                break;
              case 'craft':
                updated.craft = (updated.craft || 0) + delta;
                break;
              default:
                break;
            }
          }
        }
      }
    }

    return updated;
  });

  // TODO later: culture rotation, starvation checks, etc.
  return next;
}


function rollTime(gameState) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const stage = player.stage;
  if (
    stage !== STAGE_DREAMER &&
    stage !== STAGE_AMATEUR &&
    stage !== STAGE_PRO
  ) {
    // Time does nothing in Home (for now).
    return gameState;
  }

  const flags = player.flags || {};
  const hasRolled = !!flags.hasRolledTimeThisTurn;
  const rerollsRemaining = flags.timeRerollsRemaining || 0;

  // Already rolled and no rerolls banked: ignore this action.
  if (hasRolled && rerollsRemaining <= 0) {
    // Optional probe:
    // console.log('[rules] rollTime ignored: already rolled this turn, no rerolls left');
    return gameState;
  }

  const roll = rollD6();

  const next = updateActivePlayer(gameState, (p) => {
    const prevFlags = p.flags || {};
    const prevHasRolled = !!prevFlags.hasRolledTimeThisTurn;
    const prevRerolls = prevFlags.timeRerollsRemaining || 0;

    const consumingReroll = prevHasRolled && prevRerolls > 0;
    const newRerolls = consumingReroll
      ? Math.max(prevRerolls - 1, 0)
      : prevRerolls;

    const newFlags = {
      ...prevFlags,
      lastTimeRoll: roll,
      hasRolledTimeThisTurn: true,
      timeRerollsRemaining: newRerolls
    };

        const scandal = p.stage === STAGE_PRO ? (p.scandal || 0) : 0;
    const netTime = Math.max(0, roll - scandal);

    const newFlags2 = {
      ...newFlags,
      lastTimeRollRaw: roll,
      lastTimeRollScandalTax: scandal,
      lastTimeRollNet: netTime
    };

    return {
      ...p,
      timeThisTurn: netTime,
      flags: newFlags2
    };

  });

  return next;
}

function applyDowntimeAction(gameState, actionType) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  // No time left? You can’t do downtime.
  if (!player.timeThisTurn || player.timeThisTurn <= 0) {
    return gameState;
  }

  const prevFlags = player.flags || {};
  let flagKey = null;
  let deltaFood = 0;
  let deltaInspiration = 0;
  let deltaCraft = 0;

    // Zeitgeist: Wellness Culture grants +1 extra of the same stat
  const zId = gameState.zeitgeist?.current?.id || null;
  if (zId === 'wellness_culture') {
    if (deltaFood) deltaFood += 1;
    if (deltaInspiration) deltaInspiration += 1;
    if (deltaCraft) deltaCraft += 1;
  }


  switch (actionType) {
    case ActionTypes.DOWNTIME_PRACTICE:
      // Practice your art → craft
      flagKey = 'usedPracticeThisTurn';
      deltaCraft = 1;
      break;

    case ActionTypes.DOWNTIME_SLEEP:
      // Rest / Sleep → inspiration
      flagKey = 'usedSleepThisTurn';
      deltaInspiration = 1;
      break;

    case ActionTypes.DOWNTIME_EAT_AT_HOME:
      // Cook & eat at home → food
      flagKey = 'usedEatAtHomeThisTurn';
      deltaFood = 1;
      break;

    default:
      return gameState;
  }

  // Enforce the 1-per-turn cap for this specific downtime action
  if (flagKey && prevFlags[flagKey]) {
    return gameState;
  }

  return updateActivePlayer(gameState, (p) => {
    const timeThisTurn = (p.timeThisTurn || 0) - 1;

    return {
      ...p,
      food: (p.food || 0) + deltaFood,
      inspiration: (p.inspiration || 0) + deltaInspiration,
      craft: (p.craft || 0) + deltaCraft,
      // Clamp at 0 to match job time handling
      timeThisTurn: timeThisTurn < 0 ? 0 : timeThisTurn,
      flags: {
        ...(p.flags || {}),
        ...(flagKey ? { [flagKey]: true } : {})
      }
    };
  });
}

// --- NEW: Lay Low + PR mechanics ---

function isLayLowAllowed(player) {
  if (!player) return false;
  const f = player.flags || {};
  return (
    player.stage === STAGE_PRO &&
    (player.scandal || 0) > 0 &&
    !f.hasRolledTimeThisTurn &&
    !f.hasActedThisTurn &&
    !!f.canLayLowThisTurn
  );
}

/**
 * LAY_LOW:
 * - Only allowed if you have NOT rolled time and have done nothing else.
 * - Roll d6, reduce Scandal by that amount (min 0).
 * - ALWAYS ends turn.
 */
function layLow(gameState) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;
  if (!isLayLowAllowed(player)) return gameState;

  const roll = rollD6();

  let next = updateActivePlayer(gameState, (p) => {
    const before = p.scandal || 0;
    const reduced = Math.min(before, roll);
    const after = Math.max(0, before - reduced);

    return {
      ...p,
      scandal: after,
      flags: {
        ...(p.flags || {}),
        lastLayLowRoll: roll,
        lastLayLowScandalBefore: before,
        lastLayLowScandalReduced: reduced,
        lastLayLowScandalAfter: after
      }
    };
  });

  // Lay Low ALWAYS ends the turn.
  return endTurn(next);
}

/**
 * PLANT_HIT_PIECE:
 * - Allowed for Amateurs or Pros
 * - Can only target Pros
 * - Spend Time this turn to add equal Scandal to the target
 * - Once per game per player
 *
 * action: { type, targetPlayerId, amount? }
 */
function plantHitPiece(gameState, action) {
  const attacker = getActivePlayer(gameState);
  if (!attacker) return gameState;

  if (attacker.stage !== STAGE_AMATEUR && attacker.stage !== STAGE_PRO) return gameState;
  if (attacker.prHitUsed) return gameState;

  const targetId = String(action.targetPlayerId || '').trim();
  if (!targetId) return gameState;
  if (targetId === attacker.id) return gameState;

  const target = gameState.players.find((p) => p && p.id === targetId);
  if (!target || target.stage !== STAGE_PRO) return gameState;

  const available = attacker.timeThisTurn || 0;
  if (available <= 0) return gameState;

  let amount = Number.isFinite(action.amount) ? Math.floor(action.amount) : available;
  if (!Number.isFinite(amount) || amount <= 0) amount = available;
  if (amount > available) amount = available;

  let next = updateActivePlayer(gameState, (p) => ({
    ...p,
    timeThisTurn: Math.max(0, (p.timeThisTurn || 0) - amount),
    prHitUsed: true,
    flags: {
      ...(p.flags || {}),
      lastHitPieceAmount: amount,
      lastHitPieceTargetId: targetId
    }
  }));

  next = updatePlayerById(next, targetId, (p) => ({
    ...p,
    scandal: (p.scandal || 0) + amount,
    flags: {
      ...(p.flags || {}),
      lastScandalGained: amount,
      lastScandalFromPlayerId: attacker.id
    }
  }));

  return next;
}

/**
 * BUYOUT_SCANDAL:
 * - Only meaningful in Pro
 * - 3 money removes 1 Scandal
 * - If action.amount omitted, removes as much as affordable
 */
function buyoutScandal(gameState, action) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;
  if (player.stage !== STAGE_PRO) return gameState;

  const scandal = player.scandal || 0;
  if (scandal <= 0) return gameState;

  const money = player.money || 0;
  const RATE = 3; // money per 1 scandal removed

  const maxAffordable = Math.floor(money / RATE);
  const maxRemovable = Math.min(scandal, maxAffordable);
  if (maxRemovable <= 0) return gameState;

  let amount = Number.isFinite(action.amount) ? Math.floor(action.amount) : maxRemovable;
  if (!Number.isFinite(amount) || amount <= 0) amount = maxRemovable;
  if (amount > maxRemovable) amount = maxRemovable;

  const cost = amount * RATE;

  return updateActivePlayer(gameState, (p) => ({
    ...p,
    money: (p.money || 0) - cost,
    scandal: Math.max(0, (p.scandal || 0) - amount),
    flags: {
      ...(p.flags || {}),
      lastBuyoutScandalRemoved: amount,
      lastBuyoutCostMoney: cost
    }
  }));
}

/**
 * Any action other than Lay Low (including Roll Time) permanently removes Lay Low option this turn.
 * We only apply this if the action actually changed state.
 */
function consumeLayLowOnAnyOtherAction(prev, next, action) {
  if (!action || !action.type) return next;
  if (next === prev) return next;

  const t = action.type;
  if (
    t === ActionTypes.START_TURN ||
    t === ActionTypes.END_TURN ||
    t === ActionTypes.LAY_LOW
  ) {
    return next;
  }

  return updateActivePlayer(next, (p) => ({
    ...p,
    flags: {
      ...(p.flags || {}),
      canLayLowThisTurn: false,
      hasActedThisTurn: true
    }
  }));
}

/**
 * END_TURN:
 * - If you have a job and did not work this turn, increment skippedWorkCount.
 *   When skippedWorkCount reaches config.amateur.jobLossSkipCount, you are fired.
 * - Advance to the next player in turn order (for multiplayer),
 *   or simply increment the turn counter (for single-player).
 * - Automatically start the next player's turn (Minor Work income, flags reset, etc.).
 */
function endTurn(gameState) {
  if (!gameState) return gameState;

  let state = gameState;

      // --- Pro: Fame Check must happen before you can end turn ---
  const activeBefore = getActivePlayer(state);
  if (activeBefore && activeBefore.stage === STAGE_PRO) {
    const f = activeBefore.flags || {};
    if (!f.didProMaintenanceThisTurn) {
      // Block END_TURN; leave the player active.
      return updateActivePlayer(state, (p) => ({
        ...p,
        flags: {
          ...(p.flags || {}),
          proMaintenanceRequired: true
        }
      }));
    }
  }


  // --- Work skip / firing logic for the active player ---
  const activePlayer = getActivePlayer(state);

  if (activePlayer && activePlayer.jobId) {
    const flags = activePlayer.flags || {};
    const hasWorkedThisTurn = !!flags.hasWorkedThisTurn;

    const cfg = state.config && state.config.amateur;
    const jobLossSkipCount =
      (cfg && typeof cfg.jobLossSkipCount === 'number'
        ? cfg.jobLossSkipCount
        : 3);

    if (!hasWorkedThisTurn && jobLossSkipCount > 0) {
  const currentSkipped = activePlayer.skippedWorkCount || 0;
  const newSkipped = currentSkipped + 1;

  // Track which job (if any) was fired this END_TURN so we can return it to the market.
let firedJobId = null;

state = updateActivePlayer(state, (p) => {
  const updated = { ...p };

  updated.skippedWorkCount = newSkipped;

  // Lose job permanently for THIS player once you hit the skip limit.
  if (newSkipped >= jobLossSkipCount && updated.jobId) {
    firedJobId = updated.jobId;

    // Clear the job
    updated.jobId = null;

    // Record this job in firedJobs (per-player permanent ban)
    const prevFired = Array.isArray(updated.firedJobs) ? updated.firedJobs : [];
    updated.firedJobs = prevFired.includes(firedJobId)
      ? prevFired
      : prevFired.concat(firedJobId);
  }

  return updated;
});

// IMPORTANT: Return the job back to the global market so OTHER players can take it.
if (firedJobId) {
  const deck = Array.isArray(state.jobDeck) ? state.jobDeck : [];
  if (!deck.includes(firedJobId)) {
    state = { ...state, jobDeck: deck.concat(firedJobId) };
  }
}

}
}

  // --- Normal turn-rotation logic (unchanged, but now uses `state`) ---

  const playerCount = state.players.length;
  let { activePlayerIndex, turn } = state;

  let base;

  if (playerCount <= 1) {
    // Single-player: keep activePlayerIndex at 0, just increment turn.
    base = {
      ...state,
      turn: turn + 1
    };
  } else {
    // Multiplayer hotseat version:
    const nextIndex = (activePlayerIndex + 1) % playerCount;
    const wrapped = nextIndex === 0;

    base = {
      ...state,
      activePlayerIndex: nextIndex,
      turn: wrapped ? turn + 1 : turn
    };
  }

  // Auto-start the new active player's turn:
  // - reset timeThisTurn & apply Minor Work income via startTurn
  // The player must explicitly roll Time via a ROLL_TIME action.
  const next = startTurn(base);
  return next;
}

function ensureZeitgeistShape(state) {
  if (state && state.zeitgeist && typeof state.zeitgeist === 'object') return state;
  return {
    ...state,
    zeitgeist: {
      current: null,
      milestones: { dreamer: false, amateur: false, pro: false },
      history: []
    }
  };
}

/**
 * Trigger a Zeitgeist roll the first time ANY player reaches:
 * - Dreamer
 * - Amateur
 * - Pro
 *
 * Replaces the current Zeitgeist each time.
 */
function applyZeitgeistMilestones(prevState, nextState) {
  if (!prevState || !nextState || prevState === nextState) return nextState;

  let state = ensureZeitgeistShape(nextState);

  const prevZ = ensureZeitgeistShape(prevState).zeitgeist;
  const nextZ = state.zeitgeist;

  const milestones = { ...(nextZ.milestones || {}) };

  // Compare player stage transitions (prev -> next)
  const prevPlayers = prevState.players || [];
  const nextPlayers = nextState.players || [];

  const considerTrigger = (phaseKey, stageValue) => {
    if (milestones[phaseKey]) return false;

    for (let i = 0; i < nextPlayers.length; i++) {
      const before = prevPlayers[i];
      const after = nextPlayers[i];
      if (!before || !after) continue;

      if (before.stage !== after.stage && after.stage === stageValue) {
        const roll = rollD6();
        const z = getZeitgeistByRoll(roll);

        if (!z) return false;

        const stamped = {
          ...z,
          phase: phaseKey,                 // 'dreamer'|'amateur'|'pro'
          setAtTurn: nextState.turn || 1,
          triggeredByPlayerId: after.id || null
        };

        const history = Array.isArray(nextZ.history) ? nextZ.history.slice() : [];
        if (nextZ.current) history.push(nextZ.current);

        milestones[phaseKey] = true;

        state = {
          ...state,
          zeitgeist: {
            ...nextZ,
            milestones,
            current: stamped,
            history
          }
        };

        // Stamp for UI/debug
        state = updateActivePlayer(state, (p) => ({
          ...p,
          flags: {
            ...(p.flags || {}),
            lastZeitgeistRoll: roll,
            lastZeitgeistId: z.id,
            lastZeitgeistName: z.name,
            lastZeitgeistPhase: phaseKey
          }
        }));

        return true;
      }
    }

    return false;
  };

  // Trigger order: Dreamer, then Amateur, then Pro
  // (If somehow multiple milestones happen in one action, first match wins.)
  if (considerTrigger('dreamer', 'dreamer')) return state;
  if (considerTrigger('amateur', 'amateur')) return state;
  if (considerTrigger('pro', 'pro')) return state;

  // Preserve previous milestones if next state was missing them
  if (prevZ?.milestones) {
    for (const k of Object.keys(prevZ.milestones)) {
      if (milestones[k] === undefined) milestones[k] = prevZ.milestones[k];
    }
    state = {
      ...state,
      zeitgeist: { ...state.zeitgeist, milestones }
    };
  }

  return state;
}

/**
 * Small centralized Zeitgeist hooks that apply after specific actions.
 * (Avoids wiring effects into every stage reducer.)
 */
function applyZeitgeistPostAction(prevState, nextState, action) {
  if (!prevState || !nextState || prevState === nextState) return nextState;
  if (!action || !action.type) return nextState;

  const zId = nextState.zeitgeist?.current?.id || null;
  if (!zId) return nextState;

  // Never apply these hooks to START_TURN/END_TURN
  if (action.type === ActionTypes.START_TURN || action.type === ActionTypes.END_TURN) {
    return nextState;
  }

  // 4) Gig Economy: Go To Work => +1 Money
  if (zId === 'gig_economy' && action.type === ActionTypes.GO_TO_WORK) {
    return updateActivePlayer(nextState, (p) => ({
      ...p,
      money: (p.money || 0) + 1,
      flags: { ...(p.flags || {}), lastZeitgeistGigMoney: 1 }
    }));
  }

  // 5) Streaming Era: after drawing Social/ProfDev/Pro => refund +1 Time
  if (
    zId === 'streaming_era' &&
    (action.type === ActionTypes.DRAW_SOCIAL_CARD ||
      action.type === ActionTypes.TAKE_PROF_DEV ||
      action.type === ActionTypes.DRAW_PRO_CARD)
  ) {
    return updateActivePlayer(nextState, (p) => ({
      ...p,
      timeThisTurn: (p.timeThisTurn || 0) + 1,
      flags: { ...(p.flags || {}), lastZeitgeistStreamingRefund: 1 }
    }));
  }

  // 6) Culture War: Hit Piece => target gains +1 extra Scandal (only if it actually landed)
  if (zId === 'culture_war' && action.type === ActionTypes.PLANT_HIT_PIECE) {
    const attacker = getActivePlayer(nextState);
    const targetId = attacker?.flags?.lastHitPieceTargetId;
    if (!targetId) return nextState;

    // Only apply if the action did something (attacker used it, target is Pro, etc.)
    // We detect that by checking for lastHitPieceAmount.
    const amount = attacker?.flags?.lastHitPieceAmount;
    if (!Number.isFinite(amount) || amount <= 0) return nextState;

    return updatePlayerById(nextState, targetId, (p) => ({
      ...p,
      scandal: (p.scandal || 0) + 1,
      flags: {
        ...(p.flags || {}),
        lastZeitgeistCultureWarBonus: 1
      }
    }));
  }

  return nextState;
}

/**
 * Zeitgeist: AI Boom
 * Convert 1 Inspiration -> +1 Money/Food/Craft once per turn.
 * action: { type: ZEITGEIST_CONVERT_INSPIRATION, toStat: 'money'|'food'|'craft' }
 */
function zeitgeistConvertInspiration(gameState, action) {
  const zId = gameState.zeitgeist?.current?.id || null;
  if (zId !== 'ai_boom') return gameState;

  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const f = player.flags || {};
  if (f.zeitgeistAIConvertedThisTurn) return gameState;

  if ((player.inspiration || 0) <= 0) return gameState;

  const toStat = String(action.toStat || '').toLowerCase();
  if (toStat !== 'money' && toStat !== 'food' && toStat !== 'craft') return gameState;

  return updateActivePlayer(gameState, (p) => ({
    ...p,
    inspiration: (p.inspiration || 0) - 1,
    [toStat]: (p[toStat] || 0) + 1,
    flags: {
      ...(p.flags || {}),
      zeitgeistAIConvertedThisTurn: true,
      lastZeitgeistAIConvertTo: toStat
    }
  }));
}



