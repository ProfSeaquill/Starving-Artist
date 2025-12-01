// src/engine/stages/dreamer_stage.js

import {
  STAGE_DREAMER,
  STAGE_AMATEUR,
  getActivePlayer,
  updateActivePlayer
} from '../state.js';

import { rollD6 } from '../dice.js';

/**
 * Dreamer stage reducer.
 * Handles:
 *  - DRAW_SOCIAL_CARD (draw + show choice)
 *  - ATTEND_SOCIAL_EVENT (resolve pending Social as 'attend')
 *  - SKIP_SOCIAL_EVENT (resolve pending Social as 'skip')
 *  - ATTEMPT_ADVANCE_DREAMER
 *
 * Any other action types simply return state unchanged.
 */

export function dreamerReducer(gameState, action) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  // Only respond if the active player is currently in Dreamer.
  if (player.stage !== STAGE_DREAMER) {
    return gameState;
  }

    switch (action.type) {
    case 'DRAW_SOCIAL_CARD':
      return handleDrawSocialCard(gameState);

    case 'ATTEND_SOCIAL_EVENT':
      return handleResolveSocialEvent(gameState, 'attend');

    case 'SKIP_SOCIAL_EVENT':
      return handleResolveSocialEvent(gameState, 'skip');

    case 'ATTEMPT_ADVANCE_DREAMER':
      return handleAttemptAdvanceDreamer(gameState);

    default:
      return gameState;
  }
}


/**
 * DRAW_SOCIAL_CARD:
 * - Draws the top Social card (with reshuffle if needed).
 * - Does NOT immediately apply attend/skip effects.
 * - Stores the card + time cost in flags as a pending Social event.
 *   (The UI will then show the popup and let the player choose attend/skip.)
 */
function handleDrawSocialCard(gameState) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  // Must have some Time available to even consider a Social event.
  if ((player.timeThisTurn || 0) <= 0) {
    return gameState;
  }

  const { nextState, card } = drawSocialCard(gameState);
  if (!card) {
    // No card available; nothing happens.
    return gameState;
  }

  const timeCost = Number.isFinite(card.timeCost) ? card.timeCost : 1;

  return updateActivePlayer(nextState, (p) => {
    const flags = {
      ...(p.flags || {}),
      pendingSocialEventCard: card,
      pendingSocialEventTimeCost: timeCost,
      // Also mirror into "last" so the debug panel / recent events log
      // knows which Social card was drawn.
      lastSocialEventCard: card,
      lastSocialEventChoice: null
    };

    return {
      ...p,
      flags
    };
  });
}

/**
 * Resolve the currently pending Social event with the given choice.
 * choice is either 'attend' or 'skip'.
 *
 * This:
 *  - Applies the chosen branch's effects.
 *  - Deducts the stored time cost (or falls back to card.timeCost / 1).
 *  - Clears the pendingSocialEvent* flags.
 *  - Updates lastSocialEventCard / lastSocialEventChoice so the UI can show
 *    the result in the "Recent events" panel.
 */
function handleResolveSocialEvent(gameState, choice) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const flags = player.flags || {};
  const card = flags.pendingSocialEventCard;

  if (!card) {
    // No pending Social event – nothing to resolve.
    return gameState;
  }

  const storedCost = flags.pendingSocialEventTimeCost;
  const timeCost = Number.isFinite(storedCost)
    ? storedCost
    : (Number.isFinite(card.timeCost) ? card.timeCost : 1);

  const nextState = updateActivePlayer(gameState, (p) => {
    let updated = applySocialChoiceEffects(p, card, choice);

    const remainingTime = (updated.timeThisTurn || 0) - timeCost;
    updated.timeThisTurn = remainingTime < 0 ? 0 : remainingTime;

    const newFlags = {
      ...(updated.flags || {}),
      lastSocialEventCard: card,
      lastSocialEventChoice: choice
    };
    delete newFlags.pendingSocialEventCard;
    delete newFlags.pendingSocialEventTimeCost;

    updated.flags = newFlags;
    return updated;
  });

  return nextState;
}


/**
 * ATTEMPT_ADVANCE_DREAMER:
 * - Check stat thresholds from config.dreamer.advanceThresholds.
 * - If not met, do nothing (but record in flags that you were ineligible).
 * - If met, roll a d6 and compare to config.dreamer.advanceRollTarget.
 * - On success, move player to Amateur.
 * - Store roll + success/fail in flags for UI.
 */
function handleAttemptAdvanceDreamer(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const thresholds = (config && config.dreamer && config.dreamer.advanceThresholds) || {};
  const target = (config && config.dreamer && config.dreamer.advanceRollTarget) || 4;

  const meets = meetsDreamerThresholds(player, thresholds);

  const roll = rollD6();
  const success = meets && roll >= target;

  const nextState = updateActivePlayer(gameState, (p) => {
    let updated = { ...p };

    const flags = {
      ...(updated.flags || {}),
      dreamerAdvanceThresholds: thresholds,
      lastDreamerAdvanceEligible: meets,
      lastDreamerAdvanceRoll: roll,
      lastDreamerAdvanceTarget: target,
      lastDreamerAdvanceSuccess: success
    };
    updated.flags = flags;

    if (success) {
      updated.stage = STAGE_AMATEUR;
      // Reset per-turn stuff when entering Amateur.
      updated.timeThisTurn = 0;
      // We leave stats/minor works as-is.
    }

    return updated;
  });

  return nextState;
}

/**
 * Check if a player meets the Dreamer stat thresholds.
 * thresholds is an object like { money: 5, inspiration: 5, craft: 3 }.
 */
function meetsDreamerThresholds(player, thresholds) {
  if (!thresholds) return true;

  for (const key of Object.keys(thresholds)) {
    const required = thresholds[key];
    if (!Number.isFinite(required)) continue;

    const value = Number(player[key] || 0);
    if (value < required) {
      return false;
    }
  }
  return true;
}

/**
 * Draw the top Social card, reshuffling the discard if needed.
 * Returns { nextState, card }.
 */
function drawSocialCard(gameState) {
  let { socialDeck, socialDiscard } = gameState;

  if (socialDeck.length === 0 && socialDiscard.length > 0) {
    socialDeck = shuffleArray(socialDiscard);
    socialDiscard = [];
  }

  if (socialDeck.length === 0) {
    console.warn('No Social cards available to draw.');
    return { nextState: gameState, card: null };
  }

  const card = socialDeck[socialDeck.length - 1];
  const newDeck = socialDeck.slice(0, -1);
  const newDiscard = socialDiscard.concat(card);

  const nextState = {
    ...gameState,
    socialDeck: newDeck,
    socialDiscard: newDiscard
  };

  return { nextState, card };
}

/**
 * Apply either the 'attend' or 'skip' branch of a Social card to the player.
 * choice is either 'attend' or 'skip'.
 */
function applySocialChoiceEffects(player, card, choice) {
  const branch = card && card[choice];
  if (!branch || !Array.isArray(branch.effects)) {
    return player;
  }

  let next = { ...player };

  for (const eff of branch.effects) {
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
          // Unknown stat; ignore for now.
          break;
      }
    }

    // Future: handle other effect types (extra draws, rerolls, etc.).
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
