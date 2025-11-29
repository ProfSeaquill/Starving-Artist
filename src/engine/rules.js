// src/engine/rules.js

import { ActionTypes } from './actions.js';
import {
  getActivePlayer,
  updateActivePlayer,
  isGameOver
} from './state.js';

import { homeReducer } from './stage_home.js';

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

    // Home stage actions
    case ActionTypes.DRAW_HOME_CARD:
    case ActionTypes.ATTEMPT_LEAVE_HOME:
      return homeReducer(gameState, action);

    // Other actions (Dreamer, Amateur, Pro, etc.) will get their own reducers later.
    default:
      return gameState;
  }
}

/**
 * START_TURN:
 * - Reset timeThisTurn for the active player.
 * - (Later) Rotate culture cards, apply start-of-turn effects, etc.
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
