// src/ui/render.js

import {
  STAGE_HOME,
  STAGE_DREAMER,
  STAGE_AMATEUR,
  STAGE_PRO,
  STATUS_WON,
  STATUS_LOST,
  JOBS
} from '../engine/state.js';

// Simple helper for DOM lookups by id
const $ = (selector) => {
  if (!selector) return null;
  const id = selector[0] === '#' ? selector.slice(1) : selector;
  const el = document.getElementById(id);
  if (!el) {
    console.warn('[render] Missing element with id:', selector);
  }
  return el;
};

// Colors for player tokens / markers (up to 6 players)
const PLAYER_COLORS = [
  '#e74c3c', // red
  '#3498db', // blue
  '#f1c40f', // yellow
  '#2ecc71', // green
  '#9b59b6', // purple
  '#e67e22'  // orange
];

function getPlayerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

// --- Board rendering helpers ---

function renderStagePlayers(gameState, stage, containerId) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = '';

  gameState.players.forEach((p, idx) => {
    if (p.stage !== stage) return;
    const marker = document.createElement('span');
    marker.className = 'player-marker';
    marker.style.backgroundColor = getPlayerColor(idx);
    marker.title = p.name;
    marker.textContent = String(idx + 1);
    container.appendChild(marker);
  });
}

/**
 * Home path: 3-step visual per player, showing how many successful rolls
 * they've made toward leaving Home.
 */
function renderHomePathTrack(gameState) {
  const container = $('#homePathTrack');
  if (!container) return;

  const steps = gameState.config?.home?.rollSequence?.length ?? 3;
  container.innerHTML = '';

  gameState.players.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'track-row';

    const label = document.createElement('div');
    label.className = 'track-row-label';
    label.textContent = p.name;
    row.appendChild(label);

    const cells = document.createElement('div');
    cells.className = 'track-row-cells';

    const progress = p.homeProgress || 0;

    for (let i = 0; i < steps; i++) {
      const cell = document.createElement('div');
      cell.className = 'track-cell';
      if (i < progress) {
        cell.classList.add('filled');
      }
      cells.appendChild(cell);
    }

    row.appendChild(cells);
    container.appendChild(row);
  });
}

/**
 * Minor Works ladder: global track for all players.
 * Players are placed at the step equal to their minorWorks.length,
 * clamped to maxMinorWorks from config.
 */
function renderMinorWorksTrack(gameState) {
  const container = $('#minorWorksTrack');
  if (!container) return;

  const maxSteps = gameState.config?.amateur?.maxMinorWorks ?? 3;
  container.innerHTML = '';

  const stepsContainer = document.createElement('div');
  stepsContainer.className = 'track-steps';

  // Create steps 0..maxSteps
  for (let step = 0; step <= maxSteps; step++) {
    const stepEl = document.createElement('div');
    stepEl.className = 'track-step';
    stepEl.dataset.step = String(step);

    const label = document.createElement('div');
    label.className = 'track-step-label';
    label.textContent = String(step);

    const tokens = document.createElement('div');
    tokens.className = 'track-step-tokens';

    stepEl.appendChild(label);
    stepEl.appendChild(tokens);
    stepsContainer.appendChild(stepEl);
  }

  container.appendChild(stepsContainer);

  // Place player tokens
  gameState.players.forEach((p, idx) => {
    const count = Array.isArray(p.minorWorks) ? p.minorWorks.length : 0;
    const clamped = Math.max(0, Math.min(count, maxSteps));
    const stepEl = stepsContainer.querySelector(
      `.track-step[data-step="${clamped}"]`
    );
    if (!stepEl) return;
    const tokensEl = stepEl.querySelector('.track-step-tokens');
    if (!tokensEl) return;

    const token = document.createElement('span');
    token.className = 'player-token';
    token.style.backgroundColor = getPlayerColor(idx);
    token.title = `${p.name} (${count} minor works)`;
    tokensEl.appendChild(token);
  });
}

/**
 * Job market: show all jobs, but grey out ones that are already taken.
 */
function renderJobMarket(gameState) {
  const container = $('#jobMarket');
  if (!container) return;

  container.innerHTML = '';

  const players = gameState.players || [];

  // Map jobId -> player who took it
  const takenByMap = new Map();
  for (const p of players) {
    if (p && typeof p.jobId === 'string' && p.jobId.length > 0) {
      takenByMap.set(p.jobId, p);
    }
  }

  if (!JOBS || !JOBS.length) {
    const empty = document.createElement('div');
    empty.className = 'job-card-empty';
    empty.textContent = 'No jobs configured';
    container.appendChild(empty);
    return;
  }

  const allTaken = JOBS.every((job) => takenByMap.has(job.id));
  if (allTaken) {
    const note = document.createElement('div');
    note.className = 'job-card-empty';
    note.textContent = 'All jobs taken';
    container.appendChild(note);
  }

  for (const job of JOBS) {
    const takenBy = takenByMap.get(job.id);

    const card = document.createElement('div');
    card.className = 'job-card';
    if (takenBy) {
      card.classList.add('job-card--taken');
    }

    const title = document.createElement('div');
    title.className = 'job-card-title';

    let titleText = job.name;
    if (takenBy) {
      titleText += ` (taken by ${takenBy.name || 'another player'})`;
    }
    title.textContent = titleText;
    card.appendChild(title);

    const effects = document.createElement('div');
    effects.className = 'job-card-effects';

    const parts = [];
    if (job.moneyDelta) {
      parts.push(`Money ${job.moneyDelta > 0 ? '+' : ''}${job.moneyDelta}`);
    }
    if (job.foodDelta) {
      parts.push(`Food ${job.foodDelta > 0 ? '+' : ''}${job.foodDelta}`);
    }
    if (job.inspirationDelta) {
      parts.push(
        `Insp ${job.inspirationDelta > 0 ? '+' : ''}${job.inspirationDelta}`
      );
    }
    if (job.timeDelta) {
      parts.push(`Time ${job.timeDelta > 0 ? '+' : ''}${job.timeDelta}`);
    }

    effects.textContent = parts.length ? parts.join(', ') : 'No effect';
    card.appendChild(effects);

    container.appendChild(card);
  }
}

/**
 * Job select dropdown: only show jobs that are not yet taken.
 * Also disables the select if the active player already has a job
 * or is not in Dreamer stage.
 */
function renderJobSelect(gameState) {
  const select = $('#jobSelect');
  if (!select) return;

  // Preserve placeholder at index 0, blow away everything else.
  while (select.options.length > 1) {
    select.remove(1);
  }

  const players = gameState.players || [];
  const takenIds = new Set(
    players
      .map((p) => p.jobId)
      .filter((id) => typeof id === 'string' && id.length > 0)
  );

  // Add one option per available job
  for (const job of JOBS) {
    if (takenIds.has(job.id)) continue;
    const opt = document.createElement('option');
    opt.value = job.id;
    opt.textContent = job.name;
    select.appendChild(opt);
  }

  const active = players[gameState.activePlayerIndex];
  const isDreamer = active && active.stage === STAGE_DREAMER;

  if (active && active.jobId) {
    // Already employed: keep select on placeholder + disabled.
    select.value = '';
    select.disabled = true;
  } else {
    // Only enable in Dreamer; elsewhere we keep it disabled.
    select.disabled = !isDreamer;
  }
}

/**
 * Masterwork track: global track for all players, showing progress toward
 * masterworkTargetProgress.
 */
function renderMasterworkTrack(gameState) {
  const container = $('#masterworkTrack');
  if (!container) return;

  const target = gameState.config?.pro?.masterworkTargetProgress ?? 10;
  container.innerHTML = '';

  const stepsContainer = document.createElement('div');
  stepsContainer.className = 'track-steps';

  // We show 0..target
  for (let step = 0; step <= target; step++) {
    const stepEl = document.createElement('div');
    stepEl.className = 'track-step';
    stepEl.dataset.step = String(step);

    const label = document.createElement('div');
    label.className = 'track-step-label';
    label.textContent = String(step);

    const tokens = document.createElement('div');
    tokens.className = 'track-step-tokens';

    stepEl.appendChild(label);
    stepEl.appendChild(tokens);
    stepsContainer.appendChild(stepEl);
  }

  container.appendChild(stepsContainer);

  // Place player tokens
  gameState.players.forEach((p, idx) => {
    const progress = p.masterworkProgress || 0;
    const clamped = Math.max(0, Math.min(progress, target));
    const stepEl = stepsContainer.querySelector(
      `.track-step[data-step="${clamped}"]`
    );
    if (!stepEl) return;
    const tokensEl = stepEl.querySelector('.track-step-tokens');
    if (!tokensEl) return;

    const token = document.createElement('span');
    token.className = 'player-token';
    token.style.backgroundColor = getPlayerColor(idx);
    token.title = `${p.name} (progress ${progress}/${target})`;
    tokensEl.appendChild(token);
  });
}

/**
 * Promotion / advancement rules per stage, based on config.
 */
function renderPromotionRules(gameState) {
  // Home → Dreamer
  const homeEl = $('#homePromotion');
  if (homeEl) {
    const seq = gameState.config?.home?.rollSequence || [];
    const parts = seq.map((v) => `>${v}`);
    if (seq.length) {
      homeEl.textContent = `Home → Dreamer: succeed ${seq.length} rolls (${parts.join(', ')}).`;
    } else {
      homeEl.textContent = 'Home → Dreamer: succeed the required Home rolls.';
    }
  }

  // Dreamer → Amateur
  const dreamerEl = $('#dreamerPromotion');
  if (dreamerEl) {
    const thresholds = gameState.config?.dreamer?.advanceThresholds || {};
    const tParts = Object.entries(thresholds).map(
      ([stat, val]) => `${stat} ≥ ${val}`
    );
    const rollTarget = gameState.config?.dreamer?.advanceRollTarget;
    let text = 'Dreamer → Amateur: ';
    if (tParts.length) {
      text += `need ${tParts.join(', ')}`;
    } else {
      text += 'meet the Dreamer thresholds';
    }
    if (rollTarget !== undefined) {
      text += `, then roll ≥ ${rollTarget}.`;
    } else {
      text += '.';
    }
    dreamerEl.textContent = text;
  }

  // Amateur → Pro
  const amateurEl = $('#amateurPromotion');
  if (amateurEl) {
    const maxMinor = gameState.config?.amateur?.maxMinorWorks ?? 3;
    const portfolioCost = gameState.config?.amateur?.portfolioCost || {};
    const costParts = Object.entries(portfolioCost).map(
      ([stat, val]) => `${val} ${stat}`
    );
    const rollTarget = gameState.config?.amateur?.proAdvanceRollTarget;
    let text = `Amateur → Pro: build a Portfolio of ${maxMinor} Minor Works`;
    if (costParts.length) {
      text += ` (pay ${costParts.join(', ')})`;
    }
    if (rollTarget !== undefined) {
      text += `, then roll ≥ ${rollTarget}.`;
    } else {
      text += '.';
    }
    amateurEl.textContent = text;
  }

  // Pro win condition
  const proEl = $('#proPromotion');
  if (proEl) {
    const target = gameState.config?.pro?.masterworkTargetProgress ?? 10;
    proEl.textContent = `Pro: complete your Masterwork (${target} progress) to win.`;
  }
}

function updateStagePanelVisibility(stage) {
  // Hide all stage-specific action blocks by default
  const allStageBlocks = document.querySelectorAll('.stage-actions');
  allStageBlocks.forEach((el) => {
    el.style.display = 'none';
  });

  // Show only the block(s) relevant to the current stage
  let selector = '';
  switch (stage) {
    case STAGE_HOME:
      selector = '.stage-home-only';
      break;
    case STAGE_DREAMER:
      selector = '.stage-dreamer-only';
      break;
    case STAGE_AMATEUR:
      selector = '.stage-amateur-only';
      break;
    case STAGE_PRO:
      selector = '.stage-pro-only';
      break;
    default:
      selector = '';
  }

  if (selector) {
    document.querySelectorAll(selector).forEach((el) => {
      el.style.display = '';
    });
  }

  // Job & Culture only matters once you're Amateur or Pro
  const jobSection = document.querySelector('.player-job-section');
  if (jobSection) {
    if (stage === STAGE_AMATEUR || stage === STAGE_PRO) {
      jobSection.style.display = '';
    } else {
      jobSection.style.display = 'none';
    }
  }

    // Highlight the stage band the active player is currently on
  const allStageBands = document.querySelectorAll('.stage-band');
  allStageBands.forEach((el) => {
    el.classList.remove('stage-active');
  });

  let activeSelector = '';
  switch (stage) {
    case STAGE_HOME:
      activeSelector = '.stage-band.stage-home';
      break;
    case STAGE_DREAMER:
      activeSelector = '.stage-band.stage-dreamer';
      break;
    case STAGE_AMATEUR:
      activeSelector = '.stage-band.stage-amateur';
      break;
    case STAGE_PRO:
      activeSelector = '.stage-band.stage-pro';
      break;
    default:
      activeSelector = '';
  }

  if (activeSelector) {
    const activeStageEl = document.querySelector(activeSelector);
    if (activeStageEl) {
      activeStageEl.classList.add('stage-active');
    }
  }
}


// Helper: set a two-line label on a button, with smaller cost/effect text.
function setButtonLabelWithCost(btn, mainLabel, costText) {
  if (!btn) return;

  if (costText) {
    btn.innerHTML = `
      <span class="btn-main-label">${mainLabel}</span>
      <span class="btn-sub-label">${costText}</span>
    `;
  } else {
    // No cost/effect line — just show the main label.
    btn.textContent = mainLabel;
  }
}

// Update labels on stage + downtime buttons to show Time cost and buffs.
function updateActionButtonLabels(gameState, player) {
  if (!gameState || !player) return;

  // --- Stage draw-card buttons (non-Home) ---

  // IDs taken directly from index.html:
  //   - <button id="drawProCardBtn">Draw Pro Card</button>
  //   - <button id="takeProfDevBtn">Draw Prof Dev Card</button>
  //   - <button id="attendSocialBtn">Draw Social Card</button>

  const proBtn = $('#drawProCardBtn');
  setButtonLabelWithCost(proBtn, 'Draw Pro Card', '-3 Time');

  const profDevBtn = $('#takeProfDevBtn');
  setButtonLabelWithCost(profDevBtn, 'Draw Prof Dev Card', '-2 Time');

  const socialBtn = $('#attendSocialBtn');
  setButtonLabelWithCost(socialBtn, 'Draw Social Card', '-1 Time');

  // Home's Draw Home Card intentionally keeps its simple single-line label.

  // --- Go To Work: derive from the actual job stats ---

  const goToWorkBtn = $('#goToWorkBtn');
  if (goToWorkBtn) {
    const job = JOBS.find((j) => j.id === player.jobId);

    if (!job) {
      setButtonLabelWithCost(goToWorkBtn, 'Go To Work', '');
    } else {
      const parts = [];

      if (job.moneyDelta) {
        parts.push(`Money ${job.moneyDelta > 0 ? '+' : ''}${job.moneyDelta}`);
      }
      if (job.foodDelta) {
        parts.push(`Food ${job.foodDelta > 0 ? '+' : ''}${job.foodDelta}`);
      }
      if (job.inspirationDelta) {
        parts.push(
          `Insp ${job.inspirationDelta > 0 ? '+' : ''}${job.inspirationDelta}`
        );
      }
      if (job.timeDelta) {
        parts.push(`Time ${job.timeDelta > 0 ? '+' : ''}${job.timeDelta}`);
      }

      const effectsText = parts.length ? parts.join(', ') : 'No effect';
      setButtonLabelWithCost(goToWorkBtn, 'Go To Work', effectsText);
    }
  }

  // --- Work on Masterwork: show how much progress you'll gain ---

  const workMasterBtn = $('#workMasterworkBtn');
  if (workMasterBtn) {
    const timeAvailable = player.timeThisTurn || 0;

    if (timeAvailable > 0) {
      const costLine = `Spend ${timeAvailable} Time → +${timeAvailable} progress`;
      setButtonLabelWithCost(workMasterBtn, 'Work on Masterwork', costLine);
    } else {
      setButtonLabelWithCost(workMasterBtn, 'Work on Masterwork', '');
    }
  }

  // --- Downtime buttons (Practice / Sleep / Eat at Home) ---

  // NOTE: adjust these lines to match your actual rules in home_stage.js.

  const practiceBtn = $('#practiceBtn');
  if (practiceBtn) {
    // Example: Practice = Craft +1, Time -1
    setButtonLabelWithCost(practiceBtn, 'Practice', 'Craft +1, Time -1');
  }

  const sleepBtn = $('#sleepBtn');
  if (sleepBtn) {
    // Example: Sleep = Time +2, Food -1
    setButtonLabelWithCost(sleepBtn, 'Sleep', 'Inspiration +1, Time -1');
  }

  const eatAtHomeBtn = $('#eatAtHomeBtn');
  if (eatAtHomeBtn) {
    // Example: Eat at Home = Food +2, Time -1, Money -1
    setButtonLabelWithCost(
      eatAtHomeBtn,
      'Eat at Home', 'Food +1, Time -1' );
  }
}

/**
 * Render the current gameState into the DOM.
 */
export function render(gameState) {
  if (!gameState) return;

  const player = gameState.players[gameState.activePlayerIndex];
  if (!player) return;

  // Cache flags once for this render pass
  const pFlags = player.flags || {};

  // --- Basic header info ---
  $('#turn').textContent = String(gameState.turn);
  $('#artPath').textContent = player.artPath;

  // Player name & art path in the player panel
  $('#playerName').textContent = player.name;
  $('#playerArtPath').textContent = player.artPath;

  // --- Stats ---
    $('#statMoney').textContent = String(player.money || 0);
  $('#statFood').textContent = String(player.food || 0);
  $('#statInspiration').textContent = String(player.inspiration || 0);
  $('#statCraft').textContent = String(player.craft || 0);

  const timeValue = player.timeThisTurn || 0;

  // Update numeric Time text
  const statTimeEl = $('#statTime');
  if (statTimeEl) {
    statTimeEl.textContent = String(timeValue);
  }

  // Update time bar segments
  const timeBar = $('#timeBar');
  if (timeBar) {
    const segments = timeBar.querySelectorAll('.time-segment');
    const maxSegs = segments.length || 6;
    const clamped = Math.max(0, Math.min(maxSegs, timeValue));

    segments.forEach((seg, idx) => {
      seg.classList.toggle('filled', idx < clamped);
    });
  }


    // --- Guided button highlighting & per-turn disables ---

  // Roll Time
  const stageAllowsTimeRoll =
    player.stage === STAGE_DREAMER ||
    player.stage === STAGE_AMATEUR ||
    player.stage === STAGE_PRO;

  const hasRolledThisTurn = !!pFlags.hasRolledTimeThisTurn;
  const rerollsRemaining = pFlags.timeRerollsRemaining || 0;
  const canRollTime =
    stageAllowsTimeRoll &&
    (!hasRolledThisTurn || rerollsRemaining > 0);

  const rollTimeBtn = $('#rollTimeBtn');
  if (rollTimeBtn) {
    rollTimeBtn.disabled = !canRollTime;

    // Highlight at the beginning of each Dreamer turn,
    // before the first roll.
    const shouldHighlightRoll =
      player.stage === STAGE_DREAMER &&
      !hasRolledThisTurn;
    rollTimeBtn.classList.toggle('guided-btn', !!shouldHighlightRoll);
  }

  // Go To Work
  const stageAllowsWork =
    player.stage === STAGE_DREAMER ||
    player.stage === STAGE_AMATEUR ||
    player.stage === STAGE_PRO;

  const hasWorkedThisTurn = !!pFlags.hasWorkedThisTurn;
  const canWork =
    stageAllowsWork &&
    !!player.jobId &&
    !hasWorkedThisTurn;

  const goToWorkBtn = $('#goToWorkBtn');
  if (goToWorkBtn) {
    goToWorkBtn.disabled = !canWork;

    // Highlight after rolling time, while in Dreamer,
    // as long as you have a job and haven't worked yet.
    const shouldHighlightWork =
      player.stage === STAGE_DREAMER &&
      hasRolledThisTurn &&
      !hasWorkedThisTurn &&
      !!player.jobId;
    goToWorkBtn.classList.toggle('guided-btn', !!shouldHighlightWork);
  }

  // Draw Home card – 1 per turn (no Time required while at Home)
const drawHomeBtn = $('#drawHomeBtn');
if (drawHomeBtn) {
  const homeCardDrawn = !!pFlags.homeCardDrawnThisTurn;
  drawHomeBtn.disabled =
    player.stage !== STAGE_HOME ||
    homeCardDrawn;

  // NEW: Guided highlight at Home: draw your card first
  const shouldHighlightHomeDraw =
    player.stage === STAGE_HOME && !homeCardDrawn;
  drawHomeBtn.classList.toggle('guided-btn', !!shouldHighlightHomeDraw);
}

    // NEW: downtime buttons – 1 use per turn & require Time > 0
  const dtFlags = pFlags;

  const practiceBtn = $('#practiceBtn');
  if (practiceBtn) {
    practiceBtn.disabled =
      !timeValue || dtFlags.usedPracticeThisTurn;
  }

  const sleepBtn = $('#sleepBtn');
  if (sleepBtn) {
    sleepBtn.disabled =
      !timeValue || dtFlags.usedSleepThisTurn;
  }

  const eatAtHomeBtn = $('#eatAtHomeBtn');
  if (eatAtHomeBtn) {
    eatAtHomeBtn.disabled =
      !timeValue || dtFlags.usedEatAtHomeThisTurn;
  }

    // After all enable/disable logic, update button labels to show costs/buffs.
  updateActionButtonLabels(gameState, player);


  // --- Advancement button gating ---

  // Home → Dreamer: only meaningful while on the Home track
  const attemptLeaveHomeBtn = $('#attemptLeaveHomeBtn');
if (attemptLeaveHomeBtn) {
  const homeCardDrawn = !!pFlags.homeCardDrawnThisTurn;
  const leaveAttempted = !!pFlags.leaveHomeAttemptedThisTurn;

  attemptLeaveHomeBtn.disabled =
    player.stage !== STAGE_HOME ||
    leaveAttempted;

  // NEW: Guided highlight at Home: after drawing, try to leave (once)
  const shouldHighlightLeave =
    player.stage === STAGE_HOME && homeCardDrawn && !leaveAttempted;
  attemptLeaveHomeBtn.classList.toggle('guided-btn', !!shouldHighlightLeave);
}


  // Dreamer → Amateur: require stat thresholds from config.dreamer.advanceThresholds
  const attemptAdvanceDreamerBtn = $('#attemptAdvanceDreamerBtn');
  if (attemptAdvanceDreamerBtn) {
    const thresholds = gameState.config?.dreamer?.advanceThresholds || {};
    let meetsThresholds = true;

    for (const [stat, required] of Object.entries(thresholds)) {
      const requiredNum = Number(required);
      if (!Number.isFinite(requiredNum)) continue; // ignore weird values

      const value = Number(player[stat] ?? 0);
      if (value < requiredNum) {
        meetsThresholds = false;
        break;
      }
    }

    attemptAdvanceDreamerBtn.disabled =
      player.stage !== STAGE_DREAMER || !meetsThresholds;
  }

  // Amateur → Pro: require Portfolio before attempting to advance
  const attemptAdvanceProBtn = $('#attemptAdvanceProBtn');
  if (attemptAdvanceProBtn) {
    attemptAdvanceProBtn.disabled =
      player.stage !== STAGE_AMATEUR || !player.portfolioBuilt;
  }

  const minorCount =
    (player.minorWorks && player.minorWorks.length) || 0;
  $('#minorWorksCount').textContent = String(minorCount);

  $('#portfolioStatus').textContent = player.portfolioBuilt
    ? 'Built'
    : 'Not yet';

  $('#masterworkProgress').textContent = `${player.masterworkProgress || 0} / ${
    gameState.config.pro.masterworkTargetProgress
  }`;

    // --- Home Path track (board-level) ---
  const homePathTrackEl = $('#homePathTrack');
  if (homePathTrackEl) {
    const cfg = gameState.config || {};
    const seq =
      (cfg.home && Array.isArray(cfg.home.rollSequence)
        ? cfg.home.rollSequence
        : []);
    const steps = seq.length || 3;

    const playersAtHome = gameState.players.filter(
      (p) => p.stage === STAGE_HOME
    );

    const cellsHtml = [];
    for (let i = 0; i < steps; i++) {
      const cellPlayers = playersAtHome.filter((p) => {
        const raw = p.homeProgress || 0;
        const idx = Math.min(raw, steps - 1); // clamp just in case
        return idx === i;
      });

      const tokensHtml = cellPlayers
        .map(
          (p) =>
            `<div class="player-token" title="${(p.name || '')
              .replace(/"/g, '&quot;')}"></div>`
        )
        .join('');

      cellsHtml.push(`<div class="track-cell">${tokensHtml}</div>`);
    }

    homePathTrackEl.innerHTML = `
      <div class="track-row">
        <div class="track-row-label">Progress</div>
        <div class="track-row-cells">
          ${cellsHtml.join('')}
        </div>
      </div>
    `;
  }

  // --- Stage display for the active player ---
  const stageNameEl = $('#stageName');
  const stageBadgeEl = $('#stageBadge');
  let stageName = '';
  let badgeClass = '';

  switch (player.stage) {
    case STAGE_HOME:
      stageName = 'Home';
      badgeClass = 'home';
      break;
    case STAGE_DREAMER:
      stageName = 'Dreamer';
      badgeClass = 'dreamer';
      break;
    case STAGE_AMATEUR:
      stageName = 'Amateur';
      badgeClass = 'amateur';
      break;
    case STAGE_PRO:
      stageName = 'Pro';
      badgeClass = 'pro';
      break;
    default:
      stageName = player.stage;
      badgeClass = '';
  }

    if (stageNameEl) {
    stageNameEl.textContent = stageName;
  }

  if (stageBadgeEl) {
    stageBadgeEl.textContent = stageName;
    stageBadgeEl.className = `badge ${badgeClass}`;
  }

  // Stage-aware player panel UI (show only relevant action groups)
  updateStagePanelVisibility(player.stage);



  // --- Job info ---
  const jobInfoEl = $('#jobInfo');
  if (player.jobId) {
    const job = JOBS.find((j) => j.id === player.jobId);
    const jobName = job ? job.name : player.jobId;
    jobInfoEl.textContent = `${jobName} (skipped: ${
      player.skippedWorkCount || 0
    })`;
  } else {
    jobInfoEl.textContent = 'No job (or lost job)';
  }

      // --- Job select / button UI ---
  const jobSelectEl = $('#jobSelect');
  const chooseJobBtnEl = $('#chooseJobBtn');

  if (jobSelectEl && chooseJobBtnEl) {
    if (player.stage === STAGE_DREAMER) {
      if (player.jobId) {
        chooseJobBtnEl.textContent = 'Quit Job';
        jobSelectEl.disabled = true;
      } else {
        chooseJobBtnEl.textContent = 'Choose Job';
        jobSelectEl.disabled = false;
      }
    } else {
      // Outside Dreamer, keep things in a neutral state
      chooseJobBtnEl.textContent = 'Choose Job';
      jobSelectEl.disabled = true;
    }

    // Guided highlight for "Choose Job" in Dreamer:
    // after you've rolled, before you have a job, and before working.
    const hasRolledThisTurn = !!pFlags.hasRolledTimeThisTurn;
    const hasWorkedThisTurn = !!pFlags.hasWorkedThisTurn;

    const shouldHighlightChooseJob =
      player.stage === STAGE_DREAMER &&
      hasRolledThisTurn &&
      !hasWorkedThisTurn &&
      !player.jobId; // only if we *don't* have a job yet

    chooseJobBtnEl.classList.toggle('guided-btn', !!shouldHighlightChooseJob);
  }


  // --- Culture info (placeholder) ---
  const cultureInfoEl = $('#cultureInfo');
  if (gameState.currentCultureCard) {
    cultureInfoEl.textContent = `${gameState.currentCultureCard.name}: ${gameState.currentCultureCard.text}`;
  } else {
    cultureInfoEl.textContent = 'None (not implemented yet)';
  }

  // --- Minor works list (per player) ---
  const minorListEl = $('#minorWorksList');
  minorListEl.textContent = '';
  if (Array.isArray(player.minorWorks) && player.minorWorks.length > 0) {
    const lines = player.minorWorks.map((mw, idx) => {
      const effects =
        Array.isArray(mw.effectsPerTurn) && mw.effectsPerTurn.length
          ? mw.effectsPerTurn
              .map((eff) =>
                eff.type === 'stat'
                  ? `${eff.stat} ${
                      eff.delta >= 0 ? '+' : ''
                    }${eff.delta}`
                  : ''
              )
              .filter(Boolean)
              .join(', ')
          : 'no per-turn effects';

      return `${idx + 1}. ${mw.name} (${effects})`;
    });
    minorListEl.textContent = lines.join('\n');
  } else {
    minorListEl.textContent = 'None yet.';
  }

  // --- Current / recent card info (per player) ---
  const cardInfoEl = $('#cardInfo');
  const flags = pFlags;
  const lines = [];

  if (flags.lastTurnStartedAtTurn !== undefined) {
    lines.push(`Turn ${flags.lastTurnStartedAtTurn} started.`);
  }

  if (flags.lastHomeCard) {
  const card = flags.lastHomeCard;

  let line = `Home Card: ${card.name} — ${card.text || ''}`;

  // Show only actual stat changes, like "money +2, food -1"
  if (Array.isArray(card.effects) && card.effects.length) {
    const effectsText = card.effects
      .map((eff) =>
        eff.type === 'stat'
          ? `${eff.stat} ${eff.delta >= 0 ? '+' : ''}${eff.delta}`
          : ''
      )
      .filter(Boolean)
      .join(', ');

    if (effectsText) {
      line += ` (Effects: ${effectsText})`;
    }
  }

  lines.push(line);
}

  if (flags.lastHomeRoll !== undefined) {
    lines.push(
      `Home roll: ${flags.lastHomeRoll} vs >${
        flags.lastHomeRollRequired
      } — ${flags.lastHomeRollSuccess ? 'success' : 'fail'}`
    );
  }
  if (flags.lastSocialEventCard) {
    lines.push(
      `Social Event (${flags.lastSocialEventChoice}): ${flags.lastSocialEventCard.name}`
    );
  }
  if (flags.lastDreamerAdvanceRoll !== undefined) {
    lines.push(
      `Dreamer→Amateur roll: ${flags.lastDreamerAdvanceRoll} vs ≥${
        flags.lastDreamerAdvanceTarget
      } — ${
        flags.lastDreamerAdvanceSuccess ? 'success' : 'fail'
      }`
    );
  }
  if (flags.lastJobName) {
    lines.push(`Last job worked: ${flags.lastJobName}`);
  }
  if (flags.lastProCard) {
    lines.push(`Pro Card: ${flags.lastProCard.name}`);
  }
  if (flags.lastMasterworkTimeSpent !== undefined) {
    lines.push(
      `Masterwork: spent ${
        flags.lastMasterworkTimeSpent
      } Time (progress ${flags.lastMasterworkProgress}/${flags.masterworkTarget})`
    );
  }
  if (flags.lastProMaintenanceRoll !== undefined) {
    lines.push(
      `Pro maintenance roll: ${
        flags.lastProMaintenanceRoll
      } vs ≥${flags.lastProMaintenanceTarget} — ${
        flags.lastProMaintenanceSuccess ? 'stay Pro' : 'demoted to Amateur'
      }`
    );
  }

  cardInfoEl.textContent = lines.length
    ? lines.join('\n')
    : 'No recent events yet.';

  // --- Board visuals (all players) ---
  renderStagePlayers(gameState, STAGE_HOME, 'homeStagePlayers');
  renderStagePlayers(gameState, STAGE_DREAMER, 'dreamerStagePlayers');
  renderStagePlayers(gameState, STAGE_AMATEUR, 'amateurStagePlayers');
  renderStagePlayers(gameState, STAGE_PRO, 'proStagePlayers');

  renderHomePathTrack(gameState);
  renderMinorWorksTrack(gameState);
  renderJobMarket(gameState);
  renderJobSelect(gameState);
  renderMasterworkTrack(gameState);

    // Promotion / advancement rules for each stage
  renderPromotionRules(gameState);

  // Dev note:
  // We no longer auto-dump the full JSON here; the dev tools
  // panel will write to #debugLog only when needed so the UI
  // isn’t a wall of code.
}
