// src/ui/controls.js

import { ActionTypes } from '../engine/actions.js';
import {
  STAGE_HOME,
  STAGE_DREAMER,
  STAGE_AMATEUR,
  STAGE_PRO,
  JOBS
} from '../engine/state.js';

// Simple DOM helper: accepts "id" or "#id"
const $ = (selector) => {
  if (!selector) return null;
  const id = selector[0] === '#'
    ? selector.slice(1)
    : selector;
  return document.getElementById(id);
};


/**
 * Hook up DOM controls to dispatch actions.
 *
 * @param {(action: any) => void} dispatch
 * @param {() => any} getState
 */
export function setupControls(dispatch, getState) {
  console.log('[controls] setupControls called');

  try {
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
    } else {
      console.warn('[controls] jobSelect element not found');
    }

    // Helper: get current player + stage
    const getPlayerAndStage = () => {
      const state = getState();
      console.log('[controls] getPlayerAndStage state:', state);
      if (!state) return { state: null, player: null, stage: null };
      const player = state.players[state.activePlayerIndex];
      return { state, player, stage: player?.stage ?? null };
    };

    // --- Turn buttons ---
    const rollBtn = $('#rollTimeBtn');
    if (!rollBtn) {
      console.warn('[controls] rollTimeBtn not found');
    } else {
      rollBtn.addEventListener('click', () => {
        console.log('[controls] Roll Time clicked (handler)');
        const { player } = getPlayerAndStage();
        console.log('[controls] current player in handler:', player);
        if (!player) return;
        dispatch({ type: ActionTypes.ROLL_TIME });
      });
    }

    const endBtn = $('#endTurnBtn');
    if (!endBtn) {
      console.warn('[controls] endTurnBtn not found');
    } else {
      endBtn.addEventListener('click', () => {
        console.log('[controls] End Turn clicked (handler)');
        dispatch({ type: ActionTypes.END_TURN });
      });
    }

    // --- Home ---
    const drawHomeBtn = $('#drawHomeBtn');
    if (!drawHomeBtn) {
      console.warn('[controls] drawHomeBtn not found');
    } else {
      drawHomeBtn.addEventListener('click', () => {
        const { stage } = getPlayerAndStage();
        console.log('[controls] Draw Home, stage:', stage);
        if (stage !== STAGE_HOME) return;
        dispatch({ type: ActionTypes.DRAW_HOME_CARD });
      });
    }

        const attemptLeaveHomeBtn = $('#attemptLeaveHomeBtn');
    if (!attemptLeaveHomeBtn) {
      console.warn('[controls] attemptLeaveHomeBtn not found');
    } else {
      attemptLeaveHomeBtn.addEventListener('click', () => {
        const { stage, player } = getPlayerAndStage();
        console.log(
          '[controls] Try to Leave Home clicked. stage =',
          stage,
          'player =',
          player && player.name
        );
        if (stage !== STAGE_HOME) return;
        dispatch({ type: ActionTypes.ATTEMPT_LEAVE_HOME });
      });
    }

  // --- Dreamer ---
  $('#attendSocialBtn')?.addEventListener('click', () => {
  const { stage } = getPlayerAndStage();
  if (stage !== STAGE_DREAMER) return;
  dispatch({ type: ActionTypes.DRAW_SOCIAL_CARD });
});

  $('#attemptAdvanceDreamerBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_DREAMER) return;
    dispatch({ type: ActionTypes.ATTEMPT_ADVANCE_DREAMER });
  });

  // --- Amateur ---
    $('#chooseJobBtn')?.addEventListener('click', () => {
    const { stage, player } = getPlayerAndStage();
    // You can only *pick* a job while Dreamer.
    if (stage !== STAGE_DREAMER) return;
    if (!player || player.jobId) return;

    const select = $('#jobSelect');
    if (!select) return;
    const jobId = select.value;
    if (!jobId) return;

    dispatch({ type: ActionTypes.CHOOSE_JOB, jobId });
  });

    $('#goToWorkBtn')?.addEventListener('click', () => {
    const { stage, player } = getPlayerAndStage();
    if (!player || !player.jobId) return;

    // Allow working in Dreamer, Amateur, or Pro as long as you have a job.
    if (
      stage !== STAGE_DREAMER &&
      stage !== STAGE_AMATEUR &&
      stage !== STAGE_PRO
    ) {
      return;
    }

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
    // Minor Works can only be *started* while Amateur.
    if (stage !== STAGE_AMATEUR) return;
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
    } catch (err) {
    console.error('[controls] ERROR during setupControls:', err);
  }
}
