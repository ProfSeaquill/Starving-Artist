import { ActionTypes } from './actions.js';
import {
  getActivePlayer,
  updateActivePlayer,
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

/**
 * Main reducer. Takes the current gameState and an action,
 * returns the next gameState (pure function).
 */
export function applyAction(gameState, action) {
  if (!gameState || isGameOver(gameState)) {
    // Once game is over, ignore further actions (for now).
    return gameState;
  }

  switch (action.type) {
    case ActionTypes.START_TURN:
      return startTurn(gameState);

    case ActionTypes.END_TURN:
      return endTurn(gameState);

    case ActionTypes.ROLL_TIME:
      return rollTime(gameState);

    case ActionTypes.DOWNTIME_PRACTICE:
    case ActionTypes.DOWNTIME_SLEEP:
    case ActionTypes.DOWNTIME_EAT_AT_HOME:
      return applyDowntimeAction(gameState, action.type);
      
    // Home
    case ActionTypes.DRAW_HOME_CARD:
    case ActionTypes.ATTEMPT_LEAVE_HOME:
      return homeReducer(gameState, action);

        // Dreamer
    case ActionTypes.DRAW_SOCIAL_CARD:
    case ActionTypes.ATTEND_SOCIAL_EVENT:
    case ActionTypes.SKIP_SOCIAL_EVENT:
    case ActionTypes.CHOOSE_JOB:
    case ActionTypes.QUIT_JOB:
    case ActionTypes.GO_TO_WORK:
    case ActionTypes.ATTEMPT_ADVANCE_DREAMER:
      return dreamerReducer(gameState, action);


        // Amateur
    case ActionTypes.TAKE_PROF_DEV:
    case ActionTypes.START_MINOR_WORK:
    case ActionTypes.COMPILE_PORTFOLIO:
    case ActionTypes.ATTEMPT_ADVANCE_PRO:
      return amateurReducer(gameState, action);


    // Pro
    case ActionTypes.WORK_ON_MASTERWORK:
    case ActionTypes.DRAW_PRO_CARD:
    case ActionTypes.PRO_MAINTENANCE_CHECK:
      return proReducer(gameState, action);

    // Culture, etc. will go here later.

    default:
      return gameState;
  }
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
      // Reset per-turn downtime usage
      usedPracticeThisTurn: false,
      usedSleepThisTurn: false,
      usedEatAtHomeThisTurn: false
    };

    // Clear per-turn Home flags
    const flags = { ...baseFlags };
    delete flags.homeCardDrawnThisTurn;
    delete flags.leaveHomeAttemptedThisTurn; // NEW

    if (player.stage !== STAGE_AMATEUR && player.stage !== STAGE_PRO) {
      // No Minor Work income at Home or Dreamer (for now).
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

    return {
      ...p,
      timeThisTurn: roll,
      flags: newFlags
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

  state = updateActivePlayer(state, (p) => {
    const updated = { ...p };

    updated.skippedWorkCount = newSkipped;

    // Lose job permanently once you hit the skip limit.
    if (newSkipped >= jobLossSkipCount && updated.jobId) {
      const firedJobId = updated.jobId;

      // Clear the job
      updated.jobId = null;

      // Record this job in firedJobs
      const prevFired = Array.isArray(updated.firedJobs)
        ? updated.firedJobs
        : [];

      // Avoid duplicates if somehow fired twice from same job
      if (!prevFired.includes(firedJobId)) {
        updated.firedJobs = prevFired.concat(firedJobId);
      } else {
        updated.firedJobs = prevFired;
      }

      // (Optionally, you could also reset skippedWorkCount here,
      //  but since you now reset it in CHOOSE_JOB, it's fine to
      //  leave it as a lifetime tally.)
    }

    return updated;
  });
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


