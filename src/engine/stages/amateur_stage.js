// src/engine/stages/amateur_stage.js

import {
  STAGE_AMATEUR,
  STAGE_PRO,
  getActivePlayer,
  updateActivePlayer
} from '../state.js';

import {
  getMinorWorkTemplatesForArtPath,
  MINOR_WORK_KINDS,
  PLATFORM_BONUS_AMOUNT
} from '../minor_works.js';

import { rollD6 } from '../dice.js';

/**
 * Amateur stage reducer.
 * Handles:
 *  - TAKE_PROF_DEV
 *  - START_MINOR_WORK
 *  - COMPILE_PORTFOLIO
 *  - ATTEMPT_ADVANCE_PRO
 */

export function amateurReducer(gameState, action) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  if (player.stage !== STAGE_AMATEUR) {
    return gameState;
  }

    switch (action.type) {
    case 'TAKE_PROF_DEV':
      return handleTakeProfDev(gameState);

    case 'START_MINOR_WORK':
      return handleStartMinorWork(gameState, action);

    case 'COMPILE_PORTFOLIO':
      return handleCompilePortfolio(gameState);

    case 'PROGRESS_MINOR_WORK':
      return handleProgressMinorWork(gameState, action); 
        
    case 'ATTEMPT_ADVANCE_PRO':
      return handleAttemptAdvancePro(gameState);

        
    // PROGRESS_MINOR_WORK is left as a future extension for multi-step works.
    default:
      return gameState;
  }
}

function findTemplateForWorkId(artPath, workId) {
  const templates = getMinorWorkTemplatesForArtPath(artPath) || [];
  return templates.find(t => t && t.id === workId) || null;
}


/**
 * TAKE_PROF_DEV:
 * - Spend time on professional development instead of other actions.
 * - Costs Time (card.timeCost, default 2).
 * - Draws a Professional Dev card, applies its effects, and may create a Minor Work.
 *
 * NOTE:
 * - The punishment for skipping work (incrementing skippedWorkCount and firing)
 *   is handled globally in END_TURN whenever you finish a turn without
 *   having gone to work.
 */

function handleTakeProfDev(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

    // Must have enough time to take Prof Dev (default cost is 2)
  const available = player.timeThisTurn || 0;

  // Peek the top card to know the true cost without drawing it
  const top = gameState.profDevDeck && gameState.profDevDeck.length
    ? gameState.profDevDeck[gameState.profDevDeck.length - 1]
    : null;

  const cost = top && Number.isFinite(top.timeCost) ? top.timeCost : 2;
  if (available < cost) return gameState;

  const { nextState, card } = drawProfDevCard(gameState);
  if (!card) return gameState;

  const defaultTimeCost = 2;
  const timeCost = Number.isFinite(card.timeCost) ? card.timeCost : defaultTimeCost;

  return updateActivePlayer(nextState, (p) => {
    let updated = applyProfDevEffectsToPlayer(p, card, config);

    console.log(
      '[profDev] before skip =', p.skippedWorkCount,
      'after skip =', updated.skippedWorkCount,
      'jobId =', updated.jobId
    );

    // Deduct Time
    const remainingTime = (updated.timeThisTurn || 0) - timeCost;
    updated.timeThisTurn = remainingTime < 0 ? 0 : remainingTime;

    updated.flags = {
      ...(updated.flags || {}),
      lastProfDevCard: card,
      lastProfDevTurn: gameState.turn || 1
    };

    return updated;
  });
}



/**
 * START_MINOR_WORK:
 * - Generic action to start a Minor Work without a card, if you want that.
 * - In v0.1 we keep it simple:
 *   - Requires free slot (< config.amateur.maxMinorWorks).
 *   - Requires an "inline" description from the action payload:
 *       { type: 'START_MINOR_WORK', minorWork: { id, name, effectsPerTurn: [...] } }
 *   - (You can choose to enforce costs in the UI or in this reducer later.)
 */
function handleStartMinorWork(gameState, action) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const workId = action.workId;
  if (!workId) return gameState;

  // Only one in progress at a time
  if (player.minorWorkInProgressId) return gameState;

  const maxMinor = (config && config.amateur && config.amateur.maxMinorWorks) || 3;
  const completedCount = Array.isArray(player.minorWorks) ? player.minorWorks.length : 0;
  if (completedCount >= maxMinor) return gameState;

  const template = findTemplateForWorkId(player.artPath, workId);
  if (!template) return gameState;

  return updateActivePlayer(gameState, (p) => {
    const progressById = { ...(p.minorWorkProgressById || {}) };
    if (!Number.isFinite(progressById[workId])) progressById[workId] = 0;

    return {
      ...p,
      minorWorkInProgressId: workId,
      minorWorkProgressById: progressById,
      flags: {
        ...(p.flags || {}),
        lastMinorWorkStartedId: workId
      }
    };
  });
}



function handleProgressMinorWork(gameState, action) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const workId = player.minorWorkInProgressId;
  if (!workId) return gameState;

  // Must have time to spend
  if (!player.timeThisTurn || player.timeThisTurn <= 0) return gameState;

  const template = findTemplateForWorkId(player.artPath, workId);
  if (!template) return gameState;

  const target = Number.isFinite(template.progressTarget) ? template.progressTarget : 1;

  return updateActivePlayer(gameState, (p) => {
    const progressById = { ...(p.minorWorkProgressById || {}) };
    const current = Number.isFinite(progressById[workId]) ? progressById[workId] : 0;
    const nextProgress = current + 1;

    // Spend 1 time
    const nextTime = (p.timeThisTurn || 0) - 1;

    // Completed?
    if (nextProgress >= target) {
      const completedWorks = Array.isArray(p.minorWorks) ? p.minorWorks.slice() : [];

      // Push into completed list (this is what your startTurn() already reads)
      completedWorks.push({
        id: template.id,
        name: template.name,
        kind: template.kind, // optional, but useful
        effectsPerTurn: Array.isArray(template.effectsPerTurn) ? template.effectsPerTurn.slice() : [],
        meta: template.meta || {}
      });

      // Apply one-time completion effects (if any)
      let out = { ...p };
      if (Array.isArray(template.onCompleteEffects)) {
        for (const eff of template.onCompleteEffects) {
          if (!eff || eff.type !== 'stat') continue;
          const stat = eff.stat;
          const delta = eff.delta || 0;
          const ALLOWED_STATS = new Set(['money', 'food', 'inspiration', 'craft']);
            if (!ALLOWED_STATS.has(stat)) continue;
            out[stat] = (out[stat] || 0) + delta;

        }
      }

      // Clear “in progress”
      delete progressById[workId];

      return {
        ...out,
        timeThisTurn: nextTime < 0 ? 0 : nextTime,
        minorWorks: completedWorks,
        minorWorkInProgressId: null,
        minorWorkProgressById: progressById,
        flags: {
          ...(out.flags || {}),
          lastMinorWorkCompletedId: template.id,
          lastMinorWorkCompletedName: template.name
        }
      };
    }

    // Not completed yet: just store progress
    progressById[workId] = nextProgress;

    return {
      ...p,
      timeThisTurn: nextTime < 0 ? 0 : nextTime,
      minorWorkProgressById: progressById,
      flags: {
        ...(p.flags || {}),
        lastMinorWorkProgressId: workId,
        lastMinorWorkProgress: nextProgress,
        lastMinorWorkProgressTarget: target
      }
    };
  });
}


/**
 * COMPILE_PORTFOLIO:
 * - Requires enough Minor Works (>= portfolioMinorWorkCount, default = maxMinorWorks).
 * - Requires paying portfolioCost from config.amateur.portfolioCost.
 * - On success, sets portfolioBuilt = true.
 */
function handleCompilePortfolio(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  if (player.portfolioBuilt) {
    return gameState;
  }

  const maxMinor = (config && config.amateur && config.amateur.maxMinorWorks) || 3;
  const requiredMinor = (config && config.amateur && config.amateur.portfolioMinorWorkCount) || maxMinor;

  const minorCount = Array.isArray(player.minorWorks) ? player.minorWorks.length : 0;
  if (minorCount < requiredMinor) {
    return gameState;
  }

  const cost = (config && config.amateur && config.amateur.portfolioCost) || {};
  const canPay = canPayCost(player, cost);

  if (!canPay) {
    return gameState;
  }

  const nextState = updateActivePlayer(gameState, (p) => {
    let updated = payCost(p, cost);
    updated.portfolioBuilt = true;

    const flags = {
      ...(updated.flags || {}),
      lastPortfolioCost: cost
    };
    updated.flags = flags;

    return updated;
  });

  return nextState;
}

/**
 * ATTEMPT_ADVANCE_PRO:
 * - Requires portfolioBuilt = true.
 * - Rolls a d6 and compares to config.amateur.proAdvanceRollTarget.
 * - On success, move player to Pro.
 */
function handleAttemptAdvancePro(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  if (!player.portfolioBuilt) {
    return gameState;
  }

  const target = (config && config.amateur && config.amateur.proAdvanceRollTarget) || 4;
  const roll = rollD6();
  const success = roll >= target;

  const nextState = updateActivePlayer(gameState, (p) => {
    let updated = { ...p };

    const flags = {
      ...(updated.flags || {}),
      lastProAdvanceRoll: roll,
      lastProAdvanceTarget: target,
      lastProAdvanceSuccess: success
    };
    updated.flags = flags;

    if (success) {
      updated.stage = STAGE_PRO;
      updated.timeThisTurn = 0;
      // MasterworkProgress starts at 0 (already initialized in state.js).
    }

    return updated;
  });

  return nextState;
}

/**
 * Draw a Professional Dev card, reshuffling discard if needed.
 * Returns { nextState, card }.
 */
function drawProfDevCard(gameState) {
  let { profDevDeck, profDevDiscard } = gameState;

  if (profDevDeck.length === 0 && profDevDiscard.length > 0) {
    profDevDeck = shuffleArray(profDevDiscard);
    profDevDiscard = [];
  }

  if (profDevDeck.length === 0) {
    console.warn('No Professional Dev cards available to draw.');
    return { nextState: gameState, card: null };
  }

  const card = profDevDeck[profDevDeck.length - 1];
  const newDeck = profDevDeck.slice(0, -1);
  const newDiscard = profDevDiscard.concat(card);

  const nextState = {
    ...gameState,
    profDevDeck: newDeck,
    profDevDiscard: newDiscard
  };

  return { nextState, card };
}

/**
 * Apply a Professional Dev card to the player:
 * - effects[]: immediate stat changes.
 * - minorWork: optional progress boost (never completes).
 */
function applyProfDevEffectsToPlayer(player, card, config) {
  let next = { ...player };

  // Immediate effects
  if (Array.isArray(card.effects)) {
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
      }
    }
  }

  // Optional Minor Work progress boost (never completes)
  if (card.minorWork && card.minorWork.id) {
    const bump = Number.isFinite(card.minorWork.progressDelta) ? card.minorWork.progressDelta : 1;

    // If there’s already a work in progress, boost that.
    // Otherwise, start the card’s work and boost it.
    const desiredId = card.minorWork.id;
    const workId = next.minorWorkInProgressId || desiredId;

    // If we’re about to start a new one, respect maxMinor
    if (!next.minorWorkInProgressId) {
      const maxMinor = (config && config.amateur && config.amateur.maxMinorWorks) || 3;
      const completedCount = Array.isArray(next.minorWorks) ? next.minorWorks.length : 0;
      if (completedCount < maxMinor) {
        // Only start if template exists
        const t = findTemplateForWorkId(next.artPath, workId);
        if (t) next.minorWorkInProgressId = workId;
      }
    }

    if (next.minorWorkInProgressId) {
      const t = findTemplateForWorkId(next.artPath, next.minorWorkInProgressId);
      if (t) {
        const target = Number.isFinite(t.progressTarget) ? t.progressTarget : 1;
        const cap = Math.max(0, target - 1);

        const progressById = { ...(next.minorWorkProgressById || {}) };
        const cur = Number.isFinite(progressById[workId]) ? progressById[workId] : 0;
        const boosted = Math.min(cur + bump, cap);

        progressById[workId] = boosted;
        next.minorWorkProgressById = progressById;

        next.flags = {
          ...(next.flags || {}),
          lastProfDevMinorWorkBoostId: workId,
          lastProfDevMinorWorkBoostTo: boosted,
          lastProfDevMinorWorkBoostCap: cap
        };
      }
    }
  }

  return next;
}


/**
 * Check if player can pay a cost object like:
 *  { money: 5, inspiration: 3, craft: 2 }
 */
function canPayCost(player, cost) {
  if (!cost) return true;
  const moneyReq = cost.money || 0;
  const inspReq  = cost.inspiration || 0;
  const craftReq = cost.craft || 0;

  if ((player.money || 0) < moneyReq) return false;
  if ((player.inspiration || 0) < inspReq) return false;
  if ((player.craft || 0) < craftReq) return false;

  return true;
}

/**
 * Subtract the given cost from the player.
 */
function payCost(player, cost) {
  if (!cost) return player;
  let next = { ...player };

  next.money        = (next.money || 0)        - (cost.money        || 0);
  next.inspiration  = (next.inspiration || 0)  - (cost.inspiration  || 0);
  next.craft        = (next.craft || 0)        - (cost.craft        || 0);

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
