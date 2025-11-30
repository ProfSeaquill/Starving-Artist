// src/ui/controls.js

import { ActionTypes } from '../engine/actions.js';
import {
  STAGE_HOME,
  STAGE_DREAMER,
  STAGE_AMATEUR,
  STAGE_PRO,
  JOBS
} from '../engine/state.js';

const $ = (id) => document.getElementById(id);

/**
 * Hook up DOM controls to dispatch actions.
 *
 * @param {(action: any) => void} dispatch
 * @param {() => any} getState
 */
export function setupControls(dispatch, getState) {
  // --- Populate job select ---
  const jobSelect = $('#jobSelect');
  if (jobSelect) {
    // Clear any existing options beyond the placeholder
    while (jobSelect.options.length > 1) {
      jobSelect.remove(1);
    }

    for (const job of JOBS) {
      const opt = document.createElement('option');
      opt.value = job.id;
      opt.textContent = job.name;
      jobSelect.appendChild(opt);
    }
  }

  // Helper: get current player + stage
  const getPlayerAndStage = () => {
    const state = getState();
    const player = state.players[state.activePlayerIndex];
    return { state, player, stage: player.stage };
  };

  // --- Turn buttons ---
  $('#rollTimeBtn')?.addEventListener('click', () => {
    const { player } = getPlayerAndStage();
    if (!player) return;
    // Only sensible in Dreamer, Amateur, Pro; reducer will guard anyway.
    dispatch({ type: ActionTypes.ROLL_TIME });
  });

  $('#endTurnBtn')?.addEventListener('click', () => {
    dispatch({ type: ActionTypes.END_TURN });
  });

  // --- Home ---
  $('#drawHomeBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_HOME) return;
    dispatch({ type: ActionTypes.DRAW_HOME_CARD });
  });

  $('#attemptLeaveHomeBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_HOME) return;
    dispatch({ type: ActionTypes.ATTEMPT_LEAVE_HOME });
  });

  // --- Dreamer ---
  $('#attendSocialBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_DREAMER) return;
    dispatch({ type: ActionTypes.ATTEND_SOCIAL_EVENT });
  });

  $('#skipSocialBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_DREAMER) return;
    dispatch({ type: ActionTypes.SKIP_SOCIAL_EVENT });
  });

  $('#attemptAdvanceDreamerBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_DREAMER) return;
    dispatch({ type: ActionTypes.ATTEMPT_ADVANCE_DREAMER });
  });

  // --- Amateur ---
  $('#chooseJobBtn')?.addEventListener('click', () => {
    const { stage, player } = getPlayerAndStage();
    if (stage !== STAGE_AMATEUR) return;
    if (!player || player.jobId) return;

    const select = $('#jobSelect');
    if (!select) return;
    const jobId = select.value;
    if (!jobId) return;

    dispatch({ type: ActionTypes.CHOOSE_JOB, jobId });
  });

  $('#goToWorkBtn')?.addEventListener('click', () => {
    const { stage, player } = getPlayerAndStage();
    if (stage !== STAGE_AMATEUR) return;
    if (!player.jobId) return;
    dispatch({ type: ActionTypes.GO_TO_WORK });
  });

  $('#takeProfDevBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_AMATEUR) return;
    dispatch({ type: ActionTypes.TAKE_PROF_DEV });
  });

  // Simple test button: start a generic minor work
  $('#startMinorWorkBtn')?.addEventListener('click', () => {
    const { stage, player } = getPlayerAndStage();
    if (stage !== STAGE_AMATEUR && stage !== STAGE_PRO) return;
    if (!player) return;

    const idx = (player.minorWorks?.length || 0) + 1;
    const id = `mw_test_${idx}`;
    const name = `Test Minor Work ${idx}`;

    dispatch({
      type: ActionTypes.START_MINOR_WORK,
      minorWork: {
        id,
        name,
        effectsPerTurn: [
          { type: 'stat', stat: 'inspiration', delta: 1 }
        ]
      }
    });
  });

  $('#compilePortfolioBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_AMATEUR) return;
    dispatch({ type: ActionTypes.COMPILE_PORTFOLIO });
  });

  $('#attemptAdvanceProBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_AMATEUR) return;
    dispatch({ type: ActionTypes.ATTEMPT_ADVANCE_PRO });
  });

  // --- Pro ---
  $('#workMasterworkBtn')?.addEventListener('click', () => {
    const { stage, player } = getPlayerAndStage();
    if (stage !== STAGE_PRO) return;
    if (!player) return;

    const timeAvailable = player.timeThisTurn || 0;
    if (timeAvailable <= 0) return;

    // For now: spend all available Time on Masterwork.
    dispatch({
      type: ActionTypes.WORK_ON_MASTERWORK,
      timeSpent: timeAvailable
    });
  });

  $('#drawProCardBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_PRO) return;
    dispatch({ type: ActionTypes.DRAW_PRO_CARD });
  });

  $('#proMaintenanceBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_PRO) return;
    dispatch({ type: ActionTypes.PRO_MAINTENANCE_CHECK });
  });
}
