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
        // --- Job select is now populated by renderJobSelect(gameState) in render.js ---
    const jobSelect = $('#jobSelect');
    if (!jobSelect) {
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

        const { state, player } = getPlayerAndStage();
        console.log('[endTurn] jobId =', player?.jobId);
console.log('[endTurn] skippedWorkCount =', player?.skippedWorkCount);
console.log('[endTurn] flags.hasWorkedThisTurn =', (player?.flags || {}).hasWorkedThisTurn);

        if (state && player && player.jobId) {
          const flags = player.flags || {};
          const hasWorkedThisTurn = !!flags.hasWorkedThisTurn;

          // Only warn if they have a job and did NOT work this turn.
          if (!hasWorkedThisTurn) {
            const cfg = state.config && state.config.amateur;
            const jobLossSkipCount =
              (cfg && typeof cfg.jobLossSkipCount === 'number'
                ? cfg.jobLossSkipCount
                : 3);

            const currentSkipped = player.skippedWorkCount || 0;
            const remaining = Math.max(jobLossSkipCount - currentSkipped, 0);
            const isFinalSkip = remaining === 1;

            // Optional: show job name in the popup subtitle
            const job = JOBS.find(j => j.id === player.jobId);
            const jobName = job ? job.name : '';

            let countdownLine;
            if (remaining > 1) {
              countdownLine =
                `If you skip work [${remaining}] more times, you'll be fired!`;
            } else if (remaining === 1) {
              countdownLine =
                `If you skip work [1] more time, you'll be fired!`;
            } else {
              // Just in case config changes mid-game and you're already over the limit.
              countdownLine =
                `If you end your turn without working, you'll be fired from your job.`;
            }

            const bodyText =
              `You didn't go to work this turn.\n\n` +
              countdownLine +
              `\n\nEnd your turn anyway?`;

            const showOverlay = window._starvingArtistShowCardOverlay;

            if (typeof showOverlay === 'function') {
              // Use the same card overlay format as other popups
              showOverlay(
                'Skip Work Warning',
                jobName || 'End Turn',
                bodyText,
                {
                  primaryLabel: 'End Turn',
                  secondaryLabel: 'Go Back',
                  onPrimary: () => {
                    // Actually end the turn
                    dispatch({ type: ActionTypes.END_TURN });

                    // If this was the final allowed skip, show a "You're fired!" popup.
                    if (isFinalSkip) {
                      const showOverlay2 = window._starvingArtistShowCardOverlay;
                      if (typeof showOverlay2 === 'function') {
                        showOverlay2(
                          "You're fired!",
                          jobName || 'Lost Job',
                          `You skipped work too many times and lost your job.`,
                          {
                            primaryLabel: 'Ouch',
                            onPrimary: () => {
                              // No-op; just close the popup.
                            }
                          }
                        );
                      }
                    }
                  },
                  onSecondary: () => {
                    // Do nothing; player returns to their turn.
                  }
                }
              );
              // IMPORTANT: don't end the turn immediately; wait for overlay choice.
              return;
            }

            // Fallback (in case overlay isn't wired up for some reason)
            const confirmed = window.confirm(bodyText.replace(/\n\n/g, '\n'));
            if (!confirmed) {
              // Player cancelled: let them go back and choose to work instead.
              return;
            }

            // Native confirm path: also show "You're fired!" if this was the final skip.
            dispatch({ type: ActionTypes.END_TURN });
            if (isFinalSkip) {
              const showOverlay2 = window._starvingArtistShowCardOverlay;
              if (typeof showOverlay2 === 'function') {
                showOverlay2(
                  "You're fired!",
                  jobName || 'Lost Job',
                  `You skipped work too many times and lost your job.`,
                  {
                    primaryLabel: 'Ouch',
                    onPrimary: () => {}
                  }
                );
              }
            }
            return;
          }
        }

        // Default path: no warning needed, or user already confirmed & handled firing.
        dispatch({ type: ActionTypes.END_TURN });
      });
    }




    // --- Downtime buttons (Practice / Sleep / Eat at Home) ---
    const practiceBtn = $('#practiceBtn');
    if (!practiceBtn) {
      console.warn('[controls] practiceBtn not found');
    } else {
      practiceBtn.addEventListener('click', () => {
        const { player } = getPlayerAndStage();
        if (!player || player.timeThisTurn <= 0) return;
        dispatch({ type: ActionTypes.DOWNTIME_PRACTICE });
      });
    }

    const sleepBtn = $('#sleepBtn');
    if (!sleepBtn) {
      console.warn('[controls] sleepBtn not found');
    } else {
      sleepBtn.addEventListener('click', () => {
        const { player } = getPlayerAndStage();
        if (!player || player.timeThisTurn <= 0) return;
        dispatch({ type: ActionTypes.DOWNTIME_SLEEP });
      });
    }

    const eatAtHomeBtn = $('#eatAtHomeBtn');
    if (!eatAtHomeBtn) {
      console.warn('[controls] eatAtHomeBtn not found');
    } else {
      eatAtHomeBtn.addEventListener('click', () => {
        const { player } = getPlayerAndStage();
        if (!player || player.timeThisTurn <= 0) return;
        dispatch({ type: ActionTypes.DOWNTIME_EAT_AT_HOME });
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

    $('#chooseJobBtn')?.addEventListener('click', () => {
    const { stage, player } = getPlayerAndStage();
    // You can only *pick* a job while Dreamer.
    if (stage !== STAGE_DREAMER) return;
    if (!player) return;

    // If we already have a job, this button acts as "Quit Job"
    if (player.jobId) {
      dispatch({ type: ActionTypes.QUIT_JOB });
      return;
    }

    // Otherwise, it's "Choose Job"
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
  // --- Amateur ---
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
