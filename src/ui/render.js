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


const $ = (selector) => {
  if (!selector) return null;
  const id = selector[0] === '#' ? selector.slice(1) : selector;
  const el = document.getElementById(id);
  if (!el) {
    console.warn('[render] Missing element with id:', selector);
  }
  return el;
};


/**
 * Render the current gameState into the DOM.
 */
export function render(gameState) {
  if (!gameState) return;

  const player = gameState.players[gameState.activePlayerIndex];
  if (!player) return;

  // --- Basic info ---
  $('#turn').textContent = String(gameState.turn);
  $('#artPath').textContent = player.artPath;

  $('#statMoney').textContent = String(player.money || 0);
  $('#statFood').textContent = String(player.food || 0);
  $('#statInspiration').textContent = String(player.inspiration || 0);
  $('#statCraft').textContent = String(player.craft || 0);
  $('#statTime').textContent = String(player.timeThisTurn || 0);

  $('#minorWorksCount').textContent = String(
    (player.minorWorks && player.minorWorks.length) || 0
  );

  $('#portfolioStatus').textContent = player.portfolioBuilt
    ? 'Built'
    : 'Not yet';

  $('#masterworkProgress').textContent = `${player.masterworkProgress || 0} / ${
    gameState.config.pro.masterworkTargetProgress
  }`;

  // --- Stage display ---
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

  stageNameEl.textContent = stageName;
  stageBadgeEl.textContent = stageName;
  stageBadgeEl.className = `badge ${badgeClass}`;

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

  // --- Culture info (placeholder) ---
  const cultureInfoEl = $('#cultureInfo');
  if (gameState.currentCultureCard) {
    cultureInfoEl.textContent = `${gameState.currentCultureCard.name}: ${gameState.currentCultureCard.text}`;
  } else {
    cultureInfoEl.textContent = 'None (not implemented yet)';
  }

  // --- Game over banner ---
  const banner = $('#gameOverBanner');
  if (gameState.status === STATUS_WON) {
    banner.style.display = 'block';
    banner.textContent = '🎉 You completed your Masterwork! You win.';
  } else if (gameState.status === STATUS_LOST) {
    banner.style.display = 'block';
    banner.textContent = `💀 Game Over: ${gameState.lossReason || 'lost'}`;
  } else {
    banner.style.display = 'none';
    banner.textContent = '';
  }

  // --- Minor works list ---
  const minorListEl = $('#minorWorksList');
  minorListEl.textContent = '';
  if (Array.isArray(player.minorWorks) && player.minorWorks.length > 0) {
    const lines = player.minorWorks.map((mw, idx) => {
      const effects =
        Array.isArray(mw.effectsPerTurn) && mw.effectsPerTurn.length
          ? mw.effectsPerTurn
              .map((eff) =>
                eff.type === 'stat' ? `${eff.stat} ${eff.delta >= 0 ? '+' : ''}${eff.delta}` : ''
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

  // --- Last card / rolls info ---
  const cardInfoEl = $('#cardInfo');
  const flags = player.flags || {};
  const lines = [];

  if (flags.lastHomeCard) {
    lines.push(
      `Home Card: ${flags.lastHomeCard.name} — ${flags.lastHomeCard.text || ''}`
    );
  }
  if (flags.lastHomeRoll !== undefined) {
    lines.push(
      `Home roll: ${flags.lastHomeRoll} vs >${flags.lastHomeRollRequired} — ${
        flags.lastHomeRollSuccess ? 'success' : 'fail'
      }`
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
      } — ${flags.lastDreamerAdvanceSuccess ? 'success' : 'fail'}`
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
      `Masterwork: spent ${flags.lastMasterworkTimeSpent} Time (progress ${flags.lastMasterworkProgress}/${flags.masterworkTarget})`
    );
  }
  if (flags.lastProMaintenanceRoll !== undefined) {
    lines.push(
      `Pro maintenance roll: ${flags.lastProMaintenanceRoll} vs ≥${flags.lastProMaintenanceTarget} — ${
        flags.lastProMaintenanceSuccess ? 'stay Pro' : 'demoted to Amateur'
      }`
    );
  }
  if (flags.lastTimeRoll !== undefined) {
    lines.push(`Time roll: ${flags.lastTimeRoll}`);
  }

  cardInfoEl.textContent = lines.length ? lines.join('\n') : 'No recent events yet.';

  // --- Debug log (just dump JSON for now) ---
  const debugLogEl = $('#debugLog');
  debugLogEl.textContent = JSON.stringify(gameState, null, 2);
}
