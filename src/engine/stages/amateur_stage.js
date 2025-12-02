// src/engine/stages/amateur_stage.js

import {
  STAGE_AMATEUR,
  STAGE_PRO,
  getActivePlayer,
  updateActivePlayer
} from '../state.js';

import { rollD6 } from '../dice.js';

/**
 * Amateur stage reducer.
 * Handles:
 *  - CHOOSE_JOB
 *  - GO_TO_WORK
 *  - TAKE_PROF_DEV
 *  - START_MINOR_WORK
 *  - COMPILE_PORTFOLIO
 *  - ATTEMPT_ADVANCE_PRO
 *
 * Any other action types simply return state unchanged.
 */
export function amateurReducer(gameState, action) {
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  if (player.stage !== STAGE_AMATEUR) {
    return gameState;
  }

  switch (action.type) {
    case 'CHOOSE_JOB':
      return handleChooseJob(gameState, action);

    case 'GO_TO_WORK':
      return handleGoToWork(gameState);

    case 'TAKE_PROF_DEV':
      return handleTakeProfDev(gameState);

    case 'START_MINOR_WORK':
      return handleStartMinorWork(gameState, action);

    case 'COMPILE_PORTFOLIO':
      return handleCompilePortfolio(gameState);

    case 'ATTEMPT_ADVANCE_PRO':
      return handleAttemptAdvancePro(gameState);

    // PROGRESS_MINOR_WORK is left as a future extension for multi-step works.
    default:
      return gameState;
  }
}

/**
 * CHOOSE_JOB:
 * - Only valid if player.jobId is null.
 * - Only valid if the requested jobId is still in gameState.jobDeck.
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
      jobId
    })
  );

  return nextState;
}

/**
 * GO_TO_WORK:
 * - Requires player.jobId to be set.
 * - Applies the job's stat/time deltas.
 * - Does NOT increment skippedWorkCount.
 */
function handleGoToWork(gameState) {
  const player = getActivePlayer(gameState);
  if (!player || !player.jobId) {
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

    const flags = {
      ...(updated.flags || {}),
      lastJobId: job.id,
      lastJobName: job.name
    };
    updated.flags = flags;

    return updated;
  });

  return nextState;
}

/**
 * TAKE_PROF_DEV:
 * - Represents skipping work this turn.
 * - Costs Time (card.timeCost, default 2).
 * - Draws a Professional Dev card, applies its effects, and may create a Minor Work.
 * - Increments skippedWorkCount; if it reaches config.amateur.jobLossSkipCount,
 *   the player loses their job permanently (jobId set to null).
 */
function handleTakeProfDev(gameState) {
  const { config } = gameState;
  const player = getActivePlayer(gameState);
  if (!player) return gameState;

  const { nextState, card } = drawProfDevCard(gameState);
  if (!card) return gameState;

  const defaultTimeCost = 2;
  const timeCost = Number.isFinite(card.timeCost) ? card.timeCost : defaultTimeCost;

  const withEffects = updateActivePlayer(nextState, (p) => {
    let updated = applyProfDevEffectsToPlayer(p, card, config);

    // Deduct Time
    const remainingTime = (updated.timeThisTurn || 0) - timeCost;
    updated.timeThisTurn = remainingTime < 0 ? 0 : remainingTime;

    // Increment skipped work count
    const maxSkips = (config && config.amateur && config.amateur.jobLossSkipCount) || 3;
    updated.skippedWorkCount = (updated.skippedWorkCount || 0) + 1;

    // Lose job permanently if we hit the skip limit
    if (updated.skippedWorkCount >= maxSkips && updated.jobId) {
      updated.jobId = null;
      // We do NOT put the job back in jobDeck; it's gone.
    }

    const flags = {
      ...(updated.flags || {}),
      lastProfDevCard: card
    };
    updated.flags = flags;

    return updated;
  });

  return withEffects;
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

  const maxMinor = (config && config.amateur && config.amateur.maxMinorWorks) || 3;
  const currentMinor = Array.isArray(player.minorWorks) ? player.minorWorks.length : 0;

  if (currentMinor >= maxMinor) {
    return gameState;
  }

  const minorWork = action.minorWork;
  if (!minorWork || !minorWork.id || !minorWork.name) {
    return gameState;
  }

  const nextState = updateActivePlayer(gameState, (p) => {
    const works = Array.isArray(p.minorWorks) ? p.minorWorks.slice() : [];

    works.push({
      id: minorWork.id,
      name: minorWork.name,
      // effects applied at start of each turn (Amateur/Pro)
      effectsPerTurn: Array.isArray(minorWork.effectsPerTurn)
        ? minorWork.effectsPerTurn.slice()
        : [],
      // For future: track progress/cost etc.
      meta: minorWork.meta || {}
    });

    return {
      ...p,
      minorWorks: works
    };
  });

  return nextState;
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
 * - minorWork: optional creation of a new Minor Work (if free slots).
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

  // Optional Minor Work creation
  if (card.minorWork) {
    const maxMinor = (config && config.amateur && config.amateur.maxMinorWorks) || 3;
    const works = Array.isArray(next.minorWorks) ? next.minorWorks.slice() : [];

    if (works.length < maxMinor) {
      const mw = card.minorWork;
      works.push({
        id: mw.id,
        name: mw.name,
        effectsPerTurn: Array.isArray(mw.effectsPerTurn)
          ? mw.effectsPerTurn.slice()
          : [],
        meta: mw.meta || {}
      });
      next.minorWorks = works;
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
