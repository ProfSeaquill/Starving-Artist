// src/engine/stages/dreamer_stage.js

import {
  STAGE_DREAMER,
  STAGE_AMATEUR,
  JOBS,
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
 *  - CHOOSE_JOB (pick a day job, Dreamer-only)
 *  - QUIT_JOB
 *  - GO_TO_WORK (apply job effects; allowed on any stage once you have a job)
 *  - ATTEMPT_ADVANCE_DREAMER
 *
 * Any other action types simply return state unchanged.
 */


export function dreamerReducer(gameState, action) {
    const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const isJobAction =
    action.type === 'CHOOSE_JOB' ||
    action.type === 'GO_TO_WORK';

  // Non-job actions only fire while you're actually in Dreamer.
  if (!isJobAction && player.stage !== STAGE_DREAMER) {
    return gameState;
  }

    switch (action.type) {
    case 'DRAW_SOCIAL_CARD':
      return handleDrawSocialCard(gameState);

    case 'ATTEND_SOCIAL_EVENT':
      return handleResolveSocialEvent(gameState, 'attend');

    case 'SKIP_SOCIAL_EVENT':
      return handleResolveSocialEvent(gameState, 'skip');

    case 'CHOOSE_JOB':
      return handleChooseJob(gameState, action);

    case 'QUIT_JOB':
      return handleQuitJob(gameState);

    case 'GO_TO_WORK':
      return handleGoToWork(gameState);

    case 'ATTEMPT_ADVANCE_DREAMER':
      return handleAttemptAdvanceDreamer(gameState);

    default:
      return gameState;
  }
}

/**
 * CHOOSE_JOB:
 * - Only valid if player.jobId is null.
 * - Only valid if the requested jobId is still in gameState.jobDeck.
 * - Only allowed while the player is in the Dreamer stage.
 * - Assigns the job to the player and removes it from the jobDeck
 *   so no other player can choose it.
 *
 * action: { type: 'CHOOSE_JOB', jobId: 'job_teacher' }
 */
function handleChooseJob(gameState, action) {
  const { jobId } = action;
  if (!jobId) return gameState;

  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  if (player.stage !== STAGE_DREAMER && player.stage !== STAGE_AMATEUR) {
  return gameState;
}


  // Already has a job: cannot choose again.
  if (player.jobId) {
    return gameState;
  }

  const jobIndex = gameState.jobDeck.indexOf(jobId);
  if (jobIndex === -1) {
    // Job not available.
    return gameState;
  }

  // Ensure jobId is a known job.
  const job = JOBS.find(j => j.id === jobId);
  if (!job) {
    return gameState;
  }

  // Remove job from available pool.
  const newJobDeck = gameState.jobDeck.slice();
  newJobDeck.splice(jobIndex, 1);

  const nextState = updateActivePlayer(
    { ...gameState, jobDeck: newJobDeck },
    (p) => ({
      ...p,
      jobId,
      // NEW: when you take a (new) job, your strike count resets.
    skippedWorkCount: 0
    })
  );

  return nextState;
}

/**
 * QUIT_JOB:
 * - Player voluntarily leaves their job.
 * - Requires player.jobId to be set.
 * - Returns the job card to the jobDeck so another player can take it.
 * - Resets skippedWorkCount.
 *
 * action: { type: 'QUIT_JOB' }
 */
function handleQuitJob(gameState) {
  const player = getActivePlayer(gameState);
  if (!player || !player.jobId) return gameState;

  const jobIdToReturn = player.jobId;

  // Put the job back in the market if it somehow isn't there already.
  const jobDeck = gameState.jobDeck.includes(jobIdToReturn)
    ? gameState.jobDeck
    : [...gameState.jobDeck, jobIdToReturn];

  const nextState = {
    ...gameState,
    jobDeck
  };

  return updateActivePlayer(nextState, (p) => ({
    ...p,
    jobId: null,
    skippedWorkCount: 0
  }));
}

/**
 * GO_TO_WORK:
 * - Requires player.jobId to be set.
 * - Applies the job's stat/time deltas.
 * - Does NOT increment skippedWorkCount.
 * - May be used in Dreamer, Amateur, or Pro as long as you still have a job.
 */
function handleGoToWork(gameState) {
  const player = getActivePlayer(gameState);
  if (!player || !player.jobId) {
    return gameState;
  }

  // NEW: hard gate – only once per turn
  const flags = player.flags || {};
  if (flags.hasWorkedThisTurn) {
    // Optional probe:
    // console.log('[dreamer] GO_TO_WORK ignored – already worked this turn');
    return gameState;
  }

  const job = JOBS.find(j => j.id === player.jobId);
  if (!job) {
    return gameState;
  }

  const nextState = updateActivePlayer(gameState, (p) => {
    let updated = { ...p };

    // Apply stat deltas
    updated.money        = (updated.money || 0)        + (job.moneyDelta        || 0);
    updated.inspiration  = (updated.inspiration || 0)  + (job.inspirationDelta  || 0);
    updated.food         = (updated.food || 0)         + (job.foodDelta         || 0);

    // Apply time delta (usually negative, but can be positive, e.g. Student)
    const remainingTime = (updated.timeThisTurn || 0) + (job.timeDelta || 0);
    updated.timeThisTurn = remainingTime < 0 ? 0 : remainingTime;

    const newFlags = {
      ...(updated.flags || {}),
      lastJobId: job.id,
      lastJobName: job.name,
      // NEW: mark that we've worked this turn
      hasWorkedThisTurn: true
    };
    updated.flags = newFlags;

    return updated;
  });

  return nextState;
}

function normalizeArtPath(p) {
  return String(p || '').trim().toLowerCase();
}

function isSocialCardEligibleForArtPath(card, artPath) {
  const p = normalizeArtPath(artPath);
  if (!p) return true;

  const allowed = Array.isArray(card?.allowedPaths)
    ? card.allowedPaths.map(normalizeArtPath).filter(Boolean)
    : [];
  const blocked = Array.isArray(card?.blockedPaths)
    ? card.blockedPaths.map(normalizeArtPath).filter(Boolean)
    : [];

  if (allowed.length) return allowed.includes(p);
  if (blocked.length) return !blocked.includes(p);
  return true;
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

  const { nextState, card } = drawSocialCard(gameState, player.artPath);
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

  const prevFlags = player.flags || {};
  const alreadyAttempted = !!prevFlags.dreamerAdvanceAttemptedThisTurn;

  // Use the new config key, but fall back to the old one so nothing breaks.
  const cost =
    (config && config.dreamer && (config.dreamer.advanceCost || config.dreamer.advanceThresholds)) || {};
  const target = (config && config.dreamer && config.dreamer.advanceRollTarget) || 4;

  const canPay = canPayCost(player, cost);

  // NEW: Only one attempt roll per turn.
  // Preserve your “flags get written” behavior even when blocked,
  // but do NOT roll (and do NOT consume stats).
  if (alreadyAttempted) {
    return updateActivePlayer(gameState, (p) => {
      const updated = { ...p };
      updated.flags = {
        ...(updated.flags || {}),
        dreamerAdvanceCost: cost,              // new name (see note below)
        lastDreamerAdvanceEligible: canPay,
        lastDreamerAdvanceTarget: target,
        lastDreamerAdvanceSuccess: false,
        lastDreamerAdvanceBlockedReason: 'already_attempted'
      };
      return updated;
    });
  }

  // If they can’t pay, don’t roll. (Button should be disabled anyway, but this keeps reducer safe.)
  if (!canPay) {
    return updateActivePlayer(gameState, (p) => {
      const updated = { ...p };
      updated.flags = {
        ...(updated.flags || {}),
        dreamerAdvanceCost: cost,
        lastDreamerAdvanceEligible: false,
        lastDreamerAdvanceTarget: target,
        lastDreamerAdvanceSuccess: false,
        lastDreamerAdvanceBlockedReason: 'cannot_pay'
      };
      return updated;
    });
  }

  const roll = rollD6();
  const success = roll >= target;

  const nextState = updateActivePlayer(gameState, (p) => {
    let updated = { ...p };

    updated.flags = {
      ...(updated.flags || {}),
      dreamerAdvanceCost: cost,               // store the cost for UI/debug
      lastDreamerAdvanceEligible: true,
      lastDreamerAdvanceRoll: roll,
      lastDreamerAdvanceTarget: target,
      lastDreamerAdvanceSuccess: success,
      // NEW: consumes the “1 attempt per turn” only when we actually roll
      dreamerAdvanceAttemptedThisTurn: true
    };

    if (success) {
      // NEW: Pay ONLY on success (not on failure)
      updated = payCost(updated, cost);

      updated.stage = STAGE_AMATEUR;
      updated.timeThisTurn = 0;
      // We still leave minor works as-is.
    }

    return updated;
  });

  return nextState;
}


/**
 * Check if a player meets the Dreamer stat thresholds.
 * cost is an object like { money: 5, inspiration: 5, craft: 3 }.
 */
function canPayCost(player, cost) {
  if (!cost) return true;

  for (const key of Object.keys(cost)) {
    const required = cost[key];
    if (!Number.isFinite(required)) continue;

    const value = Number(player[key] || 0);
    if (value < required) {
      return false;
    }
  }
  return true;
}

function payCost(player, cost) {
  if (!cost) return player;

  const next = { ...player };
  for (const key of Object.keys(cost)) {
    const required = cost[key];
    if (!Number.isFinite(required)) continue;

    next[key] = Number(next[key] || 0) - required;
  }
  return next;
}


/**
 * Draw the top Social card, reshuffling the discard if needed.
 * Returns { nextState, card }.
 */
function drawSocialCard(gameState, artPath) {
  let { socialDeck, socialDiscard } = gameState;

  const pickEligibleFromDeck = () => {
    // We treat the end of the array as the "top" of the deck.
    for (let i = socialDeck.length - 1; i >= 0; i--) {
      const candidate = socialDeck[i];
      if (isSocialCardEligibleForArtPath(candidate, artPath)) {
        const card = candidate;
        const newDeck = socialDeck.slice();
        newDeck.splice(i, 1);
        const newDiscard = socialDiscard.concat(card);
        return { socialDeck: newDeck, socialDiscard: newDiscard, card };
      }
    }
    return null;
  };

  // 1) Try to draw from the current deck.
  let picked = pickEligibleFromDeck();

  // 2) If nothing eligible is in the deck, reshuffle everything once and try again.
  if (!picked && (socialDiscard.length > 0 || socialDeck.length > 0)) {
    socialDeck = shuffleArray(socialDeck.concat(socialDiscard));
    socialDiscard = [];
    picked = pickEligibleFromDeck();
  }

  if (!picked) {
    console.warn(`[dreamer] No eligible Social cards for artPath="${artPath}".`);
    return {
      nextState: { ...gameState, socialDeck, socialDiscard },
      card: null
    };
  }

  return {
    nextState: {
      ...gameState,
      socialDeck: picked.socialDeck,
      socialDiscard: picked.socialDiscard
    },
    card: picked.card
  };
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
        case 'money':        next.money       = (next.money || 0) + delta; break;
        case 'food':         next.food        = (next.food || 0) + delta; break;
        case 'inspiration':  next.inspiration = (next.inspiration || 0) + delta; break;
        case 'craft':        next.craft       = (next.craft || 0) + delta; break;
        default: break;
      }
      continue;
    }

    if (eff.type === 'time') {
      const delta = eff.delta || 0;
      const nextTime = (next.timeThisTurn || 0) + delta;
      next.timeThisTurn = nextTime < 0 ? 0 : nextTime;
      continue;
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
