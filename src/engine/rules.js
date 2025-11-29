// src/engine/rules.js

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

    // Home stage actions
    case ActionTypes.DRAW_HOME_CARD:
    case ActionTypes.ATTEMPT_LEAVE_HOME:
      return homeReducer(gameState, action);

    // Dreamer stage actions
    case ActionTypes.ATTEND_SOCIAL_EVENT:
    case ActionTypes.SKIP_SOCIAL_EVENT:
    case ActionTypes.ATTEMPT_ADVANCE_DREAMER:
      return dreamerReducer(gameState, action);

    // TODO: Amateur & Pro actions will be wired here later.

    default:
      return gameState;
  }
}

/**
 * START_TURN:
 * - Reset timeThisTurn for the active player.
 * - (Later) Rotate Culture cards, apply start-of-turn effects, etc.
 */
function startTurn(gameState) {
  const next = updateActivePlayer(gameState, (player) => {
    return {
      ...player,
      timeThisTurn: 0
    };
  });

  // TODO: draw or rotate Culture cards at the start of each full round.
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
