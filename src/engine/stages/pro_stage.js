// src/engine/stages/pro_stage.js

import {
  STAGE_AMATEUR,
  STAGE_PRO,
  STATUS_WON,
  getActivePlayer,
  updateActivePlayer
} from '../state.js';

import { rollD6 } from '../dice.js';

/**
 * Pro stage reducer.
 * Handles:
 *  - WORK_ON_MASTERWORK
 *  - DRAW_PRO_CARD
 *  - PRO_MAINTENANCE_CHECK
 *
 * (RESOLVE_PRO_CARD_CHOICE is left for a future, more complex card structure.)
 */
export function proReducer(gameState, action) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  if (player.stage !== STAGE_PRO) {
    return gameState;
  }

  switch (action.type) {
    case 'WORK_ON_MASTERWORK':
      return handleWorkOnMasterwork(gameState, action);

    case 'DRAW_PRO_CARD':
      return handleDrawProCard(gameState);

    case 'PRO_MAINTENANCE_CHECK':
      return handleProMaintenanceCheck(gameState);

    default:
      return gameState;
  }
}

/**
 * WORK_ON_MASTERWORK:
 * - Spend Time this turn to advance masterworkProgress.
 * - timeSpent comes from action.timeSpent; if omitted, we use all available Time.
 * - For v0.1: 1 Time → 1 progress.
 * - If masterworkProgress >= target, the game is WON.
 *
 * action: { type: 'WORK_ON_MASTERWORK', timeSpent?: number }
 */
function handleWorkOnMasterwork(gameState, action) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const availableTime = player.timeThisTurn || 0;
  if (availableTime <= 0) {
    // Nothing to spend.
    return gameState;
  }

  let timeSpent = Number.isFinite(action.timeSpent)
    ? action.timeSpent
    : availableTime;

  if (timeSpent < 0) timeSpent = 0;
  if (timeSpent > availableTime) timeSpent = availableTime;

  const targetProgress =
    (config &&
      config.pro &&
      config.pro.masterworkTargetProgress) ||
    10;

  // First update the player (time + progress).
  let updatedState = updateActivePlayer(gameState, (p) => {
    let updated = { ...p };

    updated.timeThisTurn = (updated.timeThisTurn || 0) - timeSpent;
    if (updated.timeThisTurn < 0) updated.timeThisTurn = 0;

    // Simple rule: 1 Time → 1 progress.
    updated.masterworkProgress =
      (updated.masterworkProgress || 0) + timeSpent;

    const flags = {
      ...(updated.flags || {}),
      lastMasterworkTimeSpent: timeSpent,
      lastMasterworkProgress: updated.masterworkProgress,
      masterworkTarget: targetProgress
    };
    updated.flags = flags;

    return updated;
  });

  // Check win condition after update.
  const updatedPlayer = getActivePlayer(updatedState);
  if (
    updatedPlayer &&
    (updatedPlayer.masterworkProgress || 0) >= targetProgress
  ) {
    updatedState = {
      ...updatedState,
      status: STATUS_WON
    };
  }

  return updatedState;
}

/**
 * DRAW_PRO_CARD:
 * - Draws a Pro card (reshuffle discard if needed).
 * - Costs Time (card.timeCost, default 3).
 * - Applies the card's effects:
 *    - type: 'stat' → modifies money/food/inspiration/craft
 *    - type: 'masterwork' → modifies masterworkProgress
 * - If masterworkProgress >= target after effects, the game is WON.
 */
function handleDrawProCard(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const { nextState, card } = drawProCard(gameState);
  if (!card) return gameState;

  const defaultTimeCost = 3;
  const timeCost = Number.isFinite(card.timeCost)
    ? card.timeCost
    : defaultTimeCost;

  const targetProgress =
    (config &&
      config.pro &&
      config.pro.masterworkTargetProgress) ||
    10;

  // Apply effects + deduct Time.
  let withEffects = updateActivePlayer(nextState, (p) => {
    let updated = applyProCardToPlayer(p, card);

    const remainingTime = (updated.timeThisTurn || 0) - timeCost;
    updated.timeThisTurn = remainingTime < 0 ? 0 : remainingTime;

    const flags = {
      ...(updated.flags || {}),
      lastProCard: card
    };
    updated.flags = flags;

    return updated;
  });

  // Check win condition after card effects.
  const updatedPlayer = getActivePlayer(withEffects);
  if (
    updatedPlayer &&
    (updatedPlayer.masterworkProgress || 0) >= targetProgress
  ) {
    withEffects = {
      ...withEffects,
      status: STATUS_WON
    };
  }

  return withEffects;
}

/**
 * PRO_MAINTENANCE_CHECK:
 * - At the end of each Pro turn, you must pass a maintenance roll to stay Pro.
 * - Roll a d6 and compare to config.pro.maintenanceRollTarget (>= target = success).
 * - On fail, the player is demoted back to Amateur (stats & works remain).
 */
function handleProMaintenanceCheck(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const target =
    (config &&
      config.pro &&
      config.pro.maintenanceRollTarget) ||
    4;

  const roll = rollD6();
  const success = roll >= target;

  const nextState = updateActivePlayer(gameState, (p) => {
    let updated = { ...p };

    const flags = {
      ...(updated.flags || {}),
      lastProMaintenanceRoll: roll,
      lastProMaintenanceTarget: target,
      lastProMaintenanceSuccess: success
    };
    updated.flags = flags;

    if (!success) {
      // Demote to Amateur, but keep stats, minor works, portfolio, etc.
      updated.stage = STAGE_AMATEUR;
      updated.timeThisTurn = 0;
    }

    return updated;
  });

  return nextState;
}

/**
 * Draw a Pro card, reshuffling discard if needed.
 * Returns { nextState, card }.
 */
function drawProCard(gameState) {
  let { proDeck, proDiscard } = gameState;

  if (proDeck.length === 0 && proDiscard.length > 0) {
    proDeck = shuffleArray(proDiscard);
    proDiscard = [];
  }

  if (proDeck.length === 0) {
    console.warn('No Pro cards available to draw.');
    return { nextState: gameState, card: null };
  }

  const card = proDeck[proDeck.length - 1];
  const newDeck = proDeck.slice(0, -1);
  const newDiscard = proDiscard.concat(card);

  const nextState = {
    ...gameState,
    proDeck: newDeck,
    proDiscard: newDiscard
  };

  return { nextState, card };
}

/**
 * Apply a Pro card's effects to the player.
 * Supported effect types:
 *  - { type: 'stat', stat: 'money' | 'food' | 'inspiration' | 'craft', delta: number }
 *  - { type: 'masterwork', delta: number }
 */
function applyProCardToPlayer(player, card) {
  if (!card || !Array.isArray(card.effects)) {
    return player;
  }

  let next = { ...player };

  for (const eff of card.effects) {
    if (!eff || typeof eff !== 'object') continue;

    if (eff.type === 'stat') {
      const stat = eff.stat;
      const delta = eff.delta || 0;

      switch (stat) {
        case 'money':
          next.money = (next.money || 0) + delta;
          break;
        case 'food':
          next.food = (next.food || 0) + delta;
          break;
        case 'inspiration':
          next.inspiration = (next.inspiration || 0) + delta;
          break;
        case 'craft':
          next.craft = (next.craft || 0) + delta;
          break;
        default:
          break;
      }
    } else if (eff.type === 'masterwork') {
      const delta = eff.delta || 0;
      next.masterworkProgress =
        (next.masterworkProgress || 0) + delta;
    }
  }

  return next;
}

/**
 * Simple Fisher–Yates shuffle.
 */
function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
