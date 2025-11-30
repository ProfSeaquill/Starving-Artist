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

    // Home
    case ActionTypes.DRAW_HOME_CARD:
    case ActionTypes.ATTEMPT_LEAVE_HOME:
      return homeReducer(gameState, action);

    // Dreamer
    case ActionTypes.ATTEND_SOCIAL_EVENT:
    case ActionTypes.SKIP_SOCIAL_EVENT:
    case ActionTypes.ATTEMPT_ADVANCE_DREAMER:
      return dreamerReducer(gameState, action);

    // Amateur
    case ActionTypes.CHOOSE_JOB:
    case ActionTypes.GO_TO_WORK:
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
    const flags = {
      ...(player.flags || {}),
      // For UI: which turn did we start last?
      lastTurnStartedAtTurn: gameState.turn
    };

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

/**
 * ROLL_TIME:
 * - Roll a d6 and set timeThisTurn for the active player.
 * - Only applies in Dreamer, Amateur, or Pro stages.
 */
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

  const roll = rollD6();

  const next = updateActivePlayer(gameState, (p) => {
    const flags = {
      ...(p.flags || {}),
      lastTimeRoll: roll
    };
    return {
      ...p,
      timeThisTurn: roll,
      flags
    };
  });

  return next;
}

/**
 * END_TURN:
 * - Advance to the next player in turn order (for multiplayer),
 *   or simply increment the turn counter (for single-player).
 * - (Later) Check for loss conditions (starvation, maxTurns).
 */
function endTurn(gameState) {
  const playerCount = gameState.players.length;
  let { activePlayerIndex, turn } = gameState;

  if (playerCount <= 1) {
    // Single-player: keep activePlayerIndex at 0, just increment turn.
    return {
      ...gameState,
      turn: turn + 1
    };
  }

  // Multiplayer hotseat version:
  const nextIndex = (activePlayerIndex + 1) % playerCount;
  const wrapped = nextIndex === 0;

  return {
    ...gameState,
    activePlayerIndex: nextIndex,
    turn: wrapped ? turn + 1 : turn
  };
}
