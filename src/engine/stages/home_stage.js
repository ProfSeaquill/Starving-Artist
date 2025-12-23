// src/engine/stages/stage_home.js

import {
  STAGE_HOME,
  STAGE_DREAMER,
  getActivePlayer,
  updateActivePlayer
} from '../state.js';

import { rollD6 } from '../dice.js';

/**
 * Home stage reducer.
 * Handles:
 *  - DRAW_HOME_CARD
 *  - ATTEMPT_LEAVE_HOME
 *
 * Any other action types simply return state unchanged.
 */
export function homeReducer(gameState, action) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  // If the active player is not on the Home track, do nothing.
  if (player.stage !== STAGE_HOME) {
    return gameState;
  }

  switch (action.type) {
    case 'DRAW_HOME_CARD':
      return handleDrawHomeCard(gameState);

    case 'ATTEMPT_LEAVE_HOME':
      return handleAttemptLeaveHome(gameState);

    default:
      return gameState;
  }
}

/**
 * DRAW_HOME_CARD:
 * - Draw the top Home card (with reshuffle if needed).
 * - Apply its effects to the active player (stats).
 * - Store the card in player.flags.lastHomeCard for UI purposes.
 */
function handleDrawHomeCard(gameState) {
  // NEW: respect "one Home card per turn"
  const active = getActivePlayer(gameState);
  if (!active) return gameState;

  if (active.flags && active.flags.homeCardDrawnThisTurn) {
    // Already drew a Home card this turn; ignore.
    console.warn('Home card draw ignored: already drew a Home card this turn.');
    return gameState;
  }

  let { homeDeck, homeDiscard } = gameState;

  // If deck is empty but discard has cards, reshuffle.
  if (homeDeck.length === 0 && homeDiscard.length > 0) {
    homeDeck = shuffleArray(homeDiscard);
    homeDiscard = [];
  }

  // If still no cards, we can't draw. In v0.1 we just no-op.
  if (homeDeck.length === 0) {
    // You may want to track an error flag here.
    console.warn('No Home cards available to draw.');
    return gameState;
  }

  // Draw the "top" card (end of array)
  const card = homeDeck[homeDeck.length - 1];
  const newHomeDeck = homeDeck.slice(0, -1);
  const newHomeDiscard = homeDiscard.concat(card);

  // Apply effects to the active player.
  const nextGameState = updateActivePlayer(
    { ...gameState, homeDeck: newHomeDeck, homeDiscard: newHomeDiscard },
    (player) => {
      let updated = applyCardEffectsToPlayer(player, card);

      // Store last drawn Home card in flags for UI rendering.
      const flags = {
        ...(updated.flags || {}),
        lastHomeCard: card,
        homeCardDrawnThisTurn: true   // NEW: mark that we've drawn this turn
      };
      updated = { ...updated, flags };

      return updated;
    }
  );

  return nextGameState;
}


/**
 * ATTEMPT_LEAVE_HOME:
 * - Roll a d6.
 * - Compare to the current step in config.home.rollSequence.
 * - On success, increment homeProgress.
 * - If homeProgress reaches the length of the sequence, move player to Dreamer.
 * - Record last roll + success/fail in player.flags for UI.
 */
function handleAttemptLeaveHome(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  // NEW: only 1 Leave Home attempt per turn
  if (player.flags && player.flags.leaveHomeAttemptedThisTurn) {
    console.warn('Leave Home ignored: already attempted this turn.');
    return gameState;
  }

  const seq = config.home.rollSequence || [];
  const step = player.homeProgress || 0;

  // If already done with Home progression, do nothing.
  if (step >= seq.length) {
    return gameState;
  }

  const roll = rollD6();
  const required = seq[step];

  // Design: sequence entry is the "must roll > value".
  // e.g. 4 means "roll > 4" → 5 or 6 on a d6.
  const success = roll >= required;

  const nextGameState = updateActivePlayer(gameState, (p) => {
    let next = { ...p };

    // Store roll info for UI/debugging.
    const flags = {
      ...(next.flags || {}),
      lastHomeRoll: roll,
      lastHomeRollRequired: required,
      lastHomeRollSuccess: success,
      leaveHomeAttemptedThisTurn: true
    };
    next.flags = flags;

    if (success) {
      const newProgress = (next.homeProgress || 0) + 1;
      next.homeProgress = newProgress;

      // If we've completed all steps, advance to Dreamer.
      if (newProgress >= seq.length) {
        next.stage = STAGE_DREAMER;
        // Reset any stage-specific stuff here if needed.
        // timeThisTurn is already not used in Home, but we can clear it explicitly:
        next.timeThisTurn = 0;
      }
    }

    return next;
  });

  return nextGameState;
}

/**
 * Apply a card's effects to the player's stats.
 * 
 * Expects card.effects to be an array of effect objects like:
 *   { type: 'stat', stat: 'money', delta: 2 }
 * 
 * You can expand this later to handle other effect types.
 */
function applyCardEffectsToPlayer(player, card) {
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
          // Unknown stat, ignore for now.
          break;
      }
    }

    // Future: other types like 'draw', 'advance_stage', etc.
  }

  return next;
}

/**
 * Simple Fisher–Yates shuffle.
 * Used when we reshuffle the Home discard back into the Home deck.
 */
function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
