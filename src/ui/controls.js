// src/ui/controls.js

import { ActionTypes } from '../engine/actions.js';
import {
  STAGE_HOME,
  STAGE_DREAMER,
  STAGE_AMATEUR,
  STAGE_PRO,
  JOBS
} from '../engine/state.js';
import { getMinorWorkTemplatesForArtPath, MINOR_WORK_KINDS } from '../engine/minor_works.js';


// Simple DOM helper: accepts "id" or "#id"
const $ = (selector) => {
  if (!selector) return null;
  const id = selector[0] === '#'
    ? selector.slice(1)
    : selector;
  return document.getElementById(id);
};

function canLayLowNow(state, player) {
  const f = player?.flags || {};
  return (
    !!state &&
    !!player &&
    player.stage === STAGE_PRO &&
    (player.scandal || 0) > 0 &&
    !!f.canLayLowThisTurn &&
    !f.hasRolledTimeThisTurn &&
    !f.hasActedThisTurn
  );
}

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
    
    // NEW: Lay Low replaces End Turn only if it's the very first thing you do (no roll, no actions).
    if (canLayLowNow(state, player)) {
      dispatch({ type: ActionTypes.LAY_LOW });
      return;
    }

    // --- Pro: Fame Check required before ending turn ---
if (player?.stage === STAGE_PRO) {
  const f = player.flags || {};
  if (!f.didProMaintenanceThisTurn) {
    const showOverlay = window._starvingArtistShowCardOverlay;

    const bodyText =
      "You're in the Pro stage.\n\n" +
      "Before you can end your turn, you must complete a Fame Check.";

    if (typeof showOverlay === 'function') {
      showOverlay(
        'Fame Check Required',
        'Finish your turn',
        bodyText,
        {
          primaryLabel: 'Ok',
          onPrimary: () => {}
        }
      );
    } else {
      // Fallback if the overlay isn’t wired for some reason
      window.alert(bodyText.replace(/\n\n/g, '\n'));
    }

    return; // critical: don’t dispatch END_TURN yet
  }
}

    console.log('[endTurn] jobId =', player?.jobId);
    console.log('[endTurn] skippedWorkCount =', player?.skippedWorkCount);
    console.log(
      '[endTurn] flags.hasWorkedThisTurn =',
      (player?.flags || {}).hasWorkedThisTurn
    );

    // If no state, no player, or no job → just end the turn normally.
    if (!state || !player || !player.jobId) {
      dispatch({ type: ActionTypes.END_TURN });
      return;
    }

        // --- Pro: End Turn should force a Fame Check first ---
    if (player?.stage === STAGE_PRO) {
      const f = player.flags || {};
      if (!f.didProMaintenanceThisTurn) {
        dispatch({ type: ActionTypes.PRO_MAINTENANCE_CHECK });
        return;
      }
    }

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

      // How many skips will they have AFTER confirming this "End Turn"?
      const newSkippedIfTheyConfirm = currentSkipped + 1;

      // Will this END_TURN actually fire them according to the rules?
      const willBeFiredByThisEndTurn =
        jobLossSkipCount > 0 &&
        newSkippedIfTheyConfirm >= jobLossSkipCount;

      // How many extra future skips do they have AFTER this turn resolves?
      const remainingAfterThisTurn =
        jobLossSkipCount > 0
          ? Math.max(jobLossSkipCount - newSkippedIfTheyConfirm, 0)
          : 0;

      // For flavor text: which job is this?
      const job = JOBS.find(j => j.id === player.jobId);
      const jobName = job ? job.name : '';

      let countdownLine;
      if (willBeFiredByThisEndTurn) {
        // This click will immediately push them over the limit.
        countdownLine =
          `If you end your turn without working, you'll be fired from your job **right now**.`;
      } else if (remainingAfterThisTurn === 1) {
        countdownLine =
          `After this, you can skip work 1 more time before you're fired.`;
      } else {
        countdownLine =
          `After this, you can skip work ${remainingAfterThisTurn} more times before you're fired.`;
      }

      const bodyText =
        `You didn't go to work this turn.\n\n` +
        countdownLine +
        `\n\nEnd your turn anyway?`;

      const showOverlay = window._starvingArtistShowCardOverlay;

      // Capture which player & job we’re talking about so we can compare after dispatch.
      const playerIndex = state.activePlayerIndex;
      const previousJobId = player.jobId;

      if (typeof showOverlay === 'function') {
        // Fancy card-style popup path
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

              // After END_TURN runs, check if THIS player just lost their job.
              const afterState = getState && getState();
              if (!afterState || previousJobId == null) {
                return;
              }

              const players = afterState.players || [];
              const affectedPlayer = players[playerIndex];

              const justLostJob =
                affectedPlayer &&
                previousJobId &&
                !affectedPlayer.jobId;

              if (justLostJob) {
                const showOverlay2 = window._starvingArtistShowCardOverlay;
                if (typeof showOverlay2 === 'function') {
                  const firedJob = JOBS.find(j => j.id === previousJobId);
                  const firedJobName =
                    firedJob ? firedJob.name : 'Lost Job';

                  showOverlay2(
                    "You're fired!",
                    firedJobName,
                    `You skipped work too many times and lost your job.`,
                    {
                      primaryLabel: 'Ouch',
                      onPrimary: () => {
                        // no-op; just close
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

        // IMPORTANT: don’t fall through to default dispatch; wait for overlay choice.
        return;
      }

      // Fallback: native confirm if overlay somehow isn’t wired up
      const confirmed = window.confirm(bodyText.replace(/\n\n/g, '\n'));
      if (!confirmed) {
        return; // Player cancelled, so they can still go work this turn.
      }

      // Native confirm path: end the turn, then check if they were fired.
      dispatch({ type: ActionTypes.END_TURN });

      const afterState = getState && getState();
      if (!afterState || previousJobId == null) {
        return;
      }
      const players = afterState.players || [];
      const affectedPlayer = players[playerIndex];

      const justLostJob =
        affectedPlayer &&
        previousJobId &&
        !affectedPlayer.jobId;

      if (justLostJob) {
        const showOverlay2 = window._starvingArtistShowCardOverlay;
        if (typeof showOverlay2 === 'function') {
          const firedJob = JOBS.find(j => j.id === previousJobId);
          const firedJobName =
            firedJob ? firedJob.name : 'Lost Job';

          showOverlay2(
            "You're fired!",
            firedJobName,
            `You skipped work too many times and lost your job.`,
            {
              primaryLabel: 'Ouch',
              onPrimary: () => {}
            }
          );
        } else {
          // Last-ditch fallback
          window.alert(
            'You skipped work too many times and lost your job.'
          );
        }
      }

      return; // do not fall through to default END_TURN
    }

    // If they *did* work this turn, or no job-loss logic applies,
    // just end the turn normally.
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
    const { state, stage, player } = getPlayerAndStage();
    if (!state || !player) return;

    // Allow picking a job in Dreamer OR Amateur.
if (stage !== STAGE_DREAMER && stage !== STAGE_AMATEUR) return;


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

    // Is this job still in the global jobDeck?
    const inDeck =
      Array.isArray(state.jobDeck) && state.jobDeck.includes(jobId);

    // Has THIS player been fired from this job before?
    const firedJobs = Array.isArray(player.firedJobs)
      ? player.firedJobs
      : [];
    const wasFiredFromThisJob = firedJobs.includes(jobId);

    if (!inDeck) {
      // The game state says this job is no longer available.
      const showOverlay = window._starvingArtistShowCardOverlay;
      const job = JOBS.find((j) => j.id === jobId);
      const jobName = job ? job.name : 'This job';

      let bodyText;
      if (wasFiredFromThisJob) {
        bodyText =
          `Your old manager recognizes you and laughs at your job application until you leave.were fired from this job earlier.`; 
      } else {
        // Fallback: job is gone, but not specifically tied to this player.
        bodyText =
          `This job is not accepting applications. Sorry!`;
      }

      if (typeof showOverlay === 'function') {
        showOverlay(
          'How Embarrassing',
          jobName,
          bodyText,
          {
            primaryLabel: 'Got it',
            onPrimary: () => {
              // no-op, just close
            }
          }
        );
      } else {
        // Safety fallback if overlay isn't wired
        window.alert(bodyText.replace(/\n/g, '\n'));
      }

      return; // don’t dispatch CHOOSE_JOB
    }

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
  function pickMinorWorkId(player, kind) {
  const templates = getMinorWorkTemplatesForArtPath(player.artPath) || [];
  const t = templates.find((x) => x && x.kind === kind);
  return t ? t.id : null;
}
    
  $('#takeProfDevBtn')?.addEventListener('click', () => {
    const { stage } = getPlayerAndStage();
    if (stage !== STAGE_AMATEUR) return;
    dispatch({ type: ActionTypes.TAKE_PROF_DEV });
  });

    $('#startMinorQuickBtn')?.addEventListener('click', () => {
  const { stage, player } = getPlayerAndStage();
  if (stage !== STAGE_AMATEUR || !player) return;

  const workId = pickMinorWorkId(player, MINOR_WORK_KINDS.QUICK);
  if (!workId) return;

  dispatch({ type: ActionTypes.START_MINOR_WORK, workId });
});

$('#startMinorCareerBtn')?.addEventListener('click', () => {
  const { stage, player } = getPlayerAndStage();
  if (stage !== STAGE_AMATEUR || !player) return;

  const workId = pickMinorWorkId(player, MINOR_WORK_KINDS.CAREER);
  if (!workId) return;

  dispatch({ type: ActionTypes.START_MINOR_WORK, workId });
});

$('#startMinorSpotlightBtn')?.addEventListener('click', () => {
  const { stage, player } = getPlayerAndStage();
  if (stage !== STAGE_AMATEUR || !player) return;

  const workId = pickMinorWorkId(player, MINOR_WORK_KINDS.SPOTLIGHT);
  if (!workId) return;

  dispatch({ type: ActionTypes.START_MINOR_WORK, workId });
});

$('#progressMinorWorkBtn')?.addEventListener('click', () => {
  const { stage } = getPlayerAndStage();
  if (stage !== STAGE_AMATEUR) return;
  dispatch({ type: ActionTypes.PROGRESS_MINOR_WORK });
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

  // --- PR / Scandal ---
  $('#prHitPieceBtn')?.addEventListener('click', () => {
    const { state, player } = getPlayerAndStage();
    if (!state || !player) return;

    const targetId = $('#prTargetSelect')?.value;
    if (!targetId) return;

    const amtRaw = Number($('#prSpendTime')?.value);
    const amount = Number.isFinite(amtRaw) ? amtRaw : (player.timeThisTurn || 0);

    dispatch({
      type: ActionTypes.PLANT_HIT_PIECE,
      targetPlayerId: targetId,
      amount
    });
  });

  $('#buyoutScandalBtn')?.addEventListener('click', () => {
    const { player } = getPlayerAndStage();
    if (!player) return;

    const amtRaw = Number($('#buyoutAmount')?.value);
    const amount = Number.isFinite(amtRaw) ? amtRaw : undefined;

    dispatch({
      type: ActionTypes.BUYOUT_SCANDAL,
      amount
    });
  });

} catch (err) {
  console.error('[controls] ERROR during setupControls:', err);
}
}
