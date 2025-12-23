// src/main.js

import { createInitialGame } from './engine/state.js';
import { applyAction } from './engine/rules.js';
import { setupControls } from './ui/controls.js';
import { render } from './ui/render.js';

import { ActionTypes } from './engine/actions.js';
import {
  loadHomeDeckFromCsv,
  loadSocialDeckFromCsv,
  loadProfDevDeckFromCsv,
  loadProDeckFromCsv
} from './engine/cards.js';



// --- Load decks from CSV (with fallback to SAMPLE_* arrays) ---
let HOME_DECK_SOURCE = [];
let SOCIAL_DECK_SOURCE    = [];
let PROF_DEV_DECK_SOURCE  = [];
let PRO_DECK_SOURCE       = [];

try {
  HOME_DECK_SOURCE = await loadHomeDeckFromCsv('./data/cards/home_deck.csv');
  console.log('[cards] Loaded Home deck from CSV:', HOME_DECK_SOURCE.length);
} catch (err) {
  console.error(
    '[cards] Failed to load home_deck.csv; starting with an empty Home deck.',
    err
  );
}

try {
  SOCIAL_DECK_SOURCE = await loadSocialDeckFromCsv('./data/cards/social_deck.csv');
  console.log('[cards] Loaded Social deck from CSV:', SOCIAL_DECK_SOURCE.length);
} catch (err) {
  console.error(
    '[cards] Failed to load home_deck.csv; starting with an empty Social deck.',
    err
  );
}

try {
  PROF_DEV_DECK_SOURCE = await loadProfDevDeckFromCsv('./data/cards/prof_dev_deck.csv');
  console.log('[cards] Loaded Prof Dev deck from CSV:', PROF_DEV_DECK_SOURCE.length);
} catch (err) {
  console.error(
    '[cards] Failed to load home_deck.csv; starting with an empty Prof Dev deck.',
    err
  );
}

try {
  PRO_DECK_SOURCE = await loadProDeckFromCsv('./data/cards/pro_deck.csv');
  console.log('[cards] Loaded Pro deck from CSV:', PRO_DECK_SOURCE.length);
} catch (err) {
  console.error(
    '[cards] Failed to load home_deck.csv; starting with an empty Pro deck.',
    err
  );
}


// Small helper for shuffling
function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- Game setup ---
let gameState = createInitialGame({
  numPlayers: 1,
  artPaths: ['author'] // or 'painter', etc.
});

// Seed decks with CSV data where available (fallback: SAMPLE_* arrays)
gameState = {
  ...gameState,
  homeDeck: shuffleArray(HOME_DECK_SOURCE),
  homeDiscard: [],
  socialDeck: shuffleArray(SOCIAL_DECK_SOURCE),
  socialDiscard: [],
  profDevDeck: shuffleArray(PROF_DEV_DECK_SOURCE),
  profDevDiscard: [],
  proDeck: shuffleArray(PRO_DECK_SOURCE),
  proDiscard: []
};

// --- Dev helpers (mutate active player & log) ---

function devLog(message) {
  const debugLogEl = document.getElementById('debugLog');
  if (!debugLogEl) return;

  const maxLines = 40;
  const existing = (debugLogEl.textContent || '').split('\n').filter(Boolean);
  existing.push(String(message));
  debugLogEl.textContent = existing.slice(-maxLines).join('\n');
}

function devUpdateActivePlayer(updater) {
  if (!gameState || !Array.isArray(gameState.players) || gameState.players.length === 0) {
    return;
  }

  const idx = gameState.activePlayerIndex || 0;
  const players = gameState.players.slice();
  const current = players[idx];
  if (!current) return;

  const updated = updater(current) || current;
  players[idx] = updated;

  gameState = { ...gameState, players };
  render(gameState);
}

/**
 * Wire up the on-page Dev Tools panel.
 * - All cheats apply to the *active* player.
 * - Card draws still go through dispatch/applyAction.
 */
function setupDevPanel(dispatch) {
  // --- Stage jump ---
  const stageSelect = document.getElementById('devStageSelect');
  const stageBtn = document.getElementById('devSetStageBtn');
  if (stageSelect && stageBtn) {
    stageBtn.addEventListener('click', () => {
      const value = stageSelect.value;
      if (!value) return;

      devUpdateActivePlayer((p) => ({
        ...p,
        stage: value
      }));
      devLog(`[dev] Set stage to "${value}".`);
    });
  }

  // --- Stats: Money / Food / Inspiration / Craft ---
  const statSelect = document.getElementById('devStatSelect');
  const statInput  = document.getElementById('devStatValue');
  const setStatBtn = document.getElementById('devSetStatBtn');
  const addStatBtn = document.getElementById('devAddStatBtn');

  const validStats = ['money', 'food', 'inspiration', 'craft'];

  const parseNumber = (inputEl) => {
    if (!inputEl) return 0;
    const raw = inputEl.value.trim();
    if (!raw) return 0;
    const num = Number.parseInt(raw, 10);
    return Number.isFinite(num) ? num : 0;
  };

  if (statSelect && statInput && setStatBtn) {
    setStatBtn.addEventListener('click', () => {
      const stat = statSelect.value;
      if (!validStats.includes(stat)) return;
      const value = parseNumber(statInput);

      devUpdateActivePlayer((p) => ({
        ...p,
        [stat]: value
      }));

      devLog(`[dev] Set ${stat} = ${value}.`);
    });
  }

  if (statSelect && statInput && addStatBtn) {
    addStatBtn.addEventListener('click', () => {
      const stat = statSelect.value;
      if (!validStats.includes(stat)) return;
      const delta = parseNumber(statInput);

      devUpdateActivePlayer((p) => ({
        ...p,
        [stat]: (p[stat] || 0) + delta
      }));

      devLog(`[dev] Added ${delta} to ${stat}.`);
    });
  }

  // --- Time this turn ---
  const timeInput    = document.getElementById('devTimeValue');
  const setTimeBtn   = document.getElementById('devSetTimeBtn');
  const clearTimeBtn = document.getElementById('devClearTimeBtn');

  const parseTime = () => {
    if (!timeInput) return 0;
    const raw = timeInput.value.trim();
    if (!raw) return 0;
    const num = Number.parseInt(raw, 10);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, num);
  };

  if (setTimeBtn && timeInput) {
    setTimeBtn.addEventListener('click', () => {
      const t = parseTime();

      devUpdateActivePlayer((p) => {
        const flags = p.flags || {};
        return {
          ...p,
          timeThisTurn: t,
          flags: {
            ...flags,
            lastTimeRoll: t,
            hasRolledTimeThisTurn: true
          }
        };
      });

      devLog(`[dev] Set timeThisTurn = ${t}.`);
    });
  }

  if (clearTimeBtn) {
    clearTimeBtn.addEventListener('click', () => {
      devUpdateActivePlayer((p) => {
        const flags = p.flags || {};
        const { lastTimeRoll, hasRolledTimeThisTurn, ...rest } = flags;
        return {
          ...p,
          timeThisTurn: 0,
          flags: {
            ...rest,
            hasRolledTimeThisTurn: false
          }
        };
      });

      devLog('[dev] Cleared timeThisTurn.');
    });
  }

  // --- Dev card draw buttons (still respect per-turn limits) ---
  const devDrawButtons = [
    { id: 'devDrawHomeBtn',    type: ActionTypes.DRAW_HOME_CARD,    label: 'Home' },
    { id: 'devDrawSocialBtn',  type: ActionTypes.DRAW_SOCIAL_CARD,  label: 'Social' },
    { id: 'devDrawProfDevBtn', type: ActionTypes.TAKE_PROF_DEV,     label: 'Prof Dev' },
    { id: 'devDrawProBtn',     type: ActionTypes.DRAW_PRO_CARD,     label: 'Pro' }
  ];

  for (const { id, type, label } of devDrawButtons) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    btn.addEventListener('click', () => {
      devLog(`[dev] dispatch ${label} card (${type}).`);
      dispatch({ type });
    });
  }
}

// --- Stage tutorial content & tracking ---
// Stages are simple strings set by the engine: 'home', 'dreamer', 'amateur', 'pro'.
const STAGE_TUTORIALS = {
  home: {
    title: 'Home Stage',
    name: 'Goal & Rules',
    body:
      'Goal: Survive early life and get out of the house.\n\n' +
      'On your Home turns you:\n' +
      '• Draw a Home card and apply its effects.\n' +
      '• Try to roll high enough to leave Home.\n' +
      'If you meet the exit conditions, you can move on to the Dreamer track.'
  },
  dreamer: {
    title: 'Dreamer Stage',
    name: 'Goal & Rules',
    body:
      'Goal: Explore your creative life and qualify for Amateur.\n\n' +
      'On your Dreamer turns you:\n' +
      '• Roll for Time.\n' +
      '• Attend or skip Social Events to adjust Money, Food, Inspiration, and Craft.\n' +
      '• Once your stats are high enough, you can attempt to advance to Amateur.'
  },
  amateur: {
    title: 'Amateur Stage',
    name: 'Goal & Rules',
    body:
      'Goal: Build a Portfolio of Minor Works.\n\n' +
      'On your Amateur turns you:\n' +
      '• Take a job to earn Money / Food / Inspiration / Craft.\n' +
      '• Spend Time and resources to start and complete Minor Works.\n' +
      '• When you have enough Minor Works, compile a Portfolio and attempt to advance to Pro.'
  },
  pro: {
    title: 'Pro Stage',
    name: 'Goal & Rules',
    body:
      'Goal: Finish your Masterwork and stay afloat.\n\n' +
      'On your Pro turns you:\n' +
      '• Spend Time on your Masterwork to reach the required progress.\n' +
      '• Draw Pro cards that can help or hinder you.\n' +
      '• Pass Pro Maintenance checks to avoid being demoted back to Amateur.\n' +
      'Complete your Masterwork while staying Pro to win.'
  }
};

// player.id -> Set of stages they’ve already seen tutorials for.
const tutorialSeenByPlayerId = new Map();

function hasSeenStageTutorial(player, stage) {
  const set = tutorialSeenByPlayerId.get(player.id);
  return !!(set && set.has(stage));
}

function markStageTutorialSeen(player, stage) {
  let set = tutorialSeenByPlayerId.get(player.id);
  if (!set) {
    set = new Set();
    tutorialSeenByPlayerId.set(player.id, set);
  }
  set.add(stage);
}

// prevStage is the stage the active player had *before* the action.
function maybeShowStageTutorial(prevStage) {
  const player = gameState.players[gameState.activePlayerIndex];
  if (!player) return;

  const nextStage = player.stage;
  if (!nextStage || nextStage === prevStage) {
    return; // no change
  }

  // Only show each tutorial once per player per stage.
  if (hasSeenStageTutorial(player, nextStage)) {
    return;
  }

  const tutorial = STAGE_TUTORIALS[nextStage];
  if (!tutorial) {
    // Stage has no tutorial defined; mark as seen so we don't keep checking.
    markStageTutorialSeen(player, nextStage);
    return;
  }

  showCardOverlay(tutorial.title, tutorial.name, tutorial.body);
  markStageTutorialSeen(player, nextStage);
}


let cardOverlayPrimaryAction = null;
let cardOverlaySecondaryAction = null;

function showCardOverlay(title, name, bodyText, config = {}) {
  const overlay = document.getElementById('cardOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('cardOverlayTitle');
  const nameEl  = document.getElementById('cardOverlayName');
  const bodyEl  = document.getElementById('cardOverlayBody');
  const primaryBtn = document.getElementById('cardOverlayClose');
  const secondaryBtn = document.getElementById('cardOverlaySkip');
  if (!titleEl || !nameEl || !bodyEl) return;

  titleEl.textContent = title || '';
  nameEl.textContent  = name || '';
  bodyEl.textContent  = bodyText || '';

  const primaryLabel =
    config && typeof config.primaryLabel === 'string'
      ? config.primaryLabel
      : 'OK';
  if (primaryBtn) {
    primaryBtn.textContent = primaryLabel;
  }

  if (secondaryBtn) {
    if (config && typeof config.secondaryLabel === 'string') {
      secondaryBtn.textContent = config.secondaryLabel;
      secondaryBtn.style.display = '';
    } else {
      secondaryBtn.style.display = 'none';
    }
  }

  cardOverlayPrimaryAction =
    config && typeof config.onPrimary === 'function' ? config.onPrimary : null;
  cardOverlaySecondaryAction =
    config && typeof config.onSecondary === 'function' ? config.onSecondary : null;

  overlay.classList.add('visible');
}


function formatStatEffects(effects) {
  if (!Array.isArray(effects)) return '';

  const parts = effects
    .filter(
      (eff) =>
        eff &&
        eff.type === 'stat' &&
        typeof eff.delta === 'number' &&
        eff.delta !== 0
    )
    .map((eff) => {
      const label = eff.stat
        ? eff.stat.charAt(0).toUpperCase() + eff.stat.slice(1)
        : 'Stat';
      const sign = eff.delta >= 0 ? '+' : '';
      return `${label} ${sign}${eff.delta}`;
    });

  return parts.join(', ');
}

function maybeShowCardPopup(state, action) {
  console.log('[popup] called with action:', action.type);

  const player = state.players[state.activePlayerIndex];
  if (!player) return;

  // Ensure flags exists
  player.flags = player.flags || {};
  const flags = player.flags;

  console.log('[popup] flags snapshot:', JSON.parse(JSON.stringify(flags)));

  const currentTurn = state.turn || 1;

  let card = null;
  let label = '';
  let bodyText = '';
  let cardName = '';
  let overlayConfig = null;

  switch (action.type) {
    case ActionTypes.DRAW_HOME_CARD: {
      card = flags.lastHomeCard;
      console.log('[popup] DRAW_HOME_CARD: lastHomeCard =', card);
      if (!card) return;

      // Remember that we drew a Home card this turn
      flags.lastHomeCardTurn = currentTurn;

      label = 'Home Card';
      cardName = card.name || '(Home Card)';

      const parts = [];

      // Main rules / flavor text, if present
      if (card.text) {
        parts.push(card.text);
      }

      // Stat effects like "Money +2, Food -1"
      const effText = formatStatEffects(card.effects || []);
      if (effText) {
        if (parts.length) parts.push(''); // blank line between text and effects
        parts.push(`Effects: ${effText}`);
      }

      bodyText = parts.join('\n') || '(No rules text yet.)';
      // Simple popup: just an OK button (default label)
      break;
    }

    case ActionTypes.DRAW_SOCIAL_CARD: {
      card = flags.lastSocialEventCard;
      if (!card) return;
      flags.lastSocialEventTurn = currentTurn; // remember this turn
      label = 'Social Event';
      cardName = card.name || '(Social Event)';

      const attendText = card.attend && card.attend.text;
      const skipText   = card.skip && card.skip.text;

      const attendEffText = card.attend
        ? formatStatEffects(card.attend.effects)
        : '';
      const skipEffText = card.skip
        ? formatStatEffects(card.skip.effects)
        : '';

      const parts = [];

      // Optional overall flavor / description (from CSV flavor → card.text)
      if (card.text) {
        parts.push(card.text);
      }

      // Attend line: include rules text and effects
      if (attendText || attendEffText) {
        let line = 'Attend';
        if (attendText) {
          line += ': ' + attendText;
        }
        if (attendEffText) {
          // add effects in parentheses at the end
          line += attendText ? ' ' : ': ';
          line += `(Effects: ${attendEffText})`;
        }
        parts.push(line);
      }

      // Skip line: include rules text and effects
      if (skipText || skipEffText) {
        let line = 'Skip';
        if (skipText) {
          line += ': ' + skipText;
        }
        if (skipEffText) {
          line += skipText ? ' ' : ': ';
          line += `(Effects: ${skipEffText})`;
        }
        parts.push(line);
      }

      bodyText = parts.join('\n\n') || '(No rules text yet.)';

      overlayConfig = {
        primaryLabel: 'Attend',
        secondaryLabel: 'Skip',
        onPrimary: () => {
          dispatch({ type: ActionTypes.ATTEND_SOCIAL_EVENT });
        },
        onSecondary: () => {
          dispatch({ type: ActionTypes.SKIP_SOCIAL_EVENT });
        }
      };
      break;
    }

    case ActionTypes.TAKE_PROF_DEV: {
  card = flags.lastProfDevCard;
  if (!card) return;

  flags.lastProfDevCardTurn = currentTurn;

  label = 'Prof Dev';
  cardName = card.name || '(Prof Dev Card)';

  const parts = [];
  if (card.text) parts.push(card.text);

  const effText = formatStatEffects(card.effects || []);
  if (effText) {
    if (parts.length) parts.push('');
    parts.push(`Effects: ${effText}`);
  }

  bodyText = parts.join('\n\n') || '(No rules text yet.)';
  break;
}

    case ActionTypes.DRAW_PRO_CARD: {
      card = flags.lastProCard;
      if (!card) return;
      flags.lastProCardTurn = currentTurn; // remember this turn
      label = 'Pro Card';
      cardName = card.name || '(Unnamed Pro card)';

      const lines = [];
      if (card.text) {
        lines.push(card.text);
      }
      if (Array.isArray(card.effects) && card.effects.length) {
        const effLines = card.effects
          .map((eff) => {
            if (eff.type === 'stat') {
              const sign = eff.delta >= 0 ? '+' : '';
              return `${eff.stat} ${sign}${eff.delta}`;
            }
            if (eff.type === 'masterwork') {
              const sign = eff.delta >= 0 ? '+' : '';
              return `Masterwork ${sign}${eff.delta}`;
            }
            return '';
          })
          .filter(Boolean);
        if (effLines.length) {
          lines.push('Effects: ' + effLines.join(', '));
        }
      }
      bodyText = lines.join('\n\n') || '(No rules text yet.)';
      break;
    }

    case ActionTypes.DRAW_CULTURE_CARD: {
      // Future-proof: when you wire Culture cards, set flags.lastCultureCard.
      card = flags.lastCultureCard;
      if (!card) return;
      flags.lastCultureCardTurn = currentTurn; // remember this turn
      label = 'Culture Card';
      cardName = card.name || '(Culture Card)';
      bodyText = card.text || '';
      break;
    }

    default:
      // Not a card-draw action we care about
      return;
  }

  console.log('[popup] showing overlay:', { label, cardName, bodyText });
  showCardOverlay(label, cardName, bodyText, overlayConfig || undefined);
}

function getCardDrawDenyReason(state, action) {
  const player = state.players[state.activePlayerIndex];
  if (!player) return null;

  const flags = player.flags || {};
  const currentTurn = state.turn || 1;

  switch (action.type) {
    case ActionTypes.DRAW_HOME_CARD:
      if (flags.lastHomeCardTurn === currentTurn) {
        return 'You already drew a Home card this turn.';
      }
      return null;

    case ActionTypes.DRAW_SOCIAL_CARD:
  if (flags.lastSocialEventTurn === currentTurn) {
    return 'You already resolved a Social Event this turn.';
  }
  return null;


    case ActionTypes.DRAW_PRO_CARD:
      if (flags.lastProCardTurn === currentTurn) {
        return 'You already drew a Pro card this turn.';
      }
      return null;

    case ActionTypes.DRAW_CULTURE_CARD:
      if (flags.lastCultureCardTurn === currentTurn) {
        return 'You already drew a Culture card this turn.';
      }
      return null;

    default:
      return null;
  }
}

function showDiceRollAnimation(finalValue, titleText = '') {
  const overlay = document.getElementById('diceOverlay');
  const face = document.getElementById('diceFace');
  const okBtn = document.getElementById('diceOkButton');
  const titleEl = document.getElementById('diceOverlayTitle');
  if (!overlay || !face || !okBtn) return;

  // Optional title (set to "" to hide)
  if (titleEl) {
    titleEl.textContent = titleText || '';
    titleEl.style.display = titleText ? '' : 'none';
  }

  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('visible');
    face.classList.remove('rolling');
    overlay.removeEventListener('click', onBackdropClick);
    okBtn.removeEventListener('click', close);
  };

  const onBackdropClick = (evt) => {
    if (evt.target === overlay) {
      close();
    }
  };

  overlay.addEventListener('click', onBackdropClick);
  okBtn.addEventListener('click', close);

  overlay.classList.add('visible');
  face.classList.add('rolling');

  let ticks = 15;        // how many “fake” rolls
  const intervalMs = 40; // speed of rolling

  const timer = setInterval(() => {
    if (ticks-- <= 0) {
      clearInterval(timer);
      face.classList.remove('rolling');
      face.textContent = String(finalValue);
      return;
    }
    const fake = 1 + Math.floor(Math.random() * 6);
    face.textContent = String(fake);
  }, intervalMs);
}

function maybeShowDiceRoll(state, action) {
  const player = state.players[state.activePlayerIndex];
  if (!player || !player.flags) return;

  // Use a generic label for both, or set "" to hide it entirely.
  const title = 'Dice Roll'; // <-- or '' to leave unlabeled

  if (action.type === ActionTypes.ROLL_TIME) {
    const roll = player.flags.lastTimeRoll;
    if (roll === undefined || roll === null) return;
    showDiceRollAnimation(roll, title);
    return;
  }

  if (action.type === ActionTypes.ATTEMPT_LEAVE_HOME) {
    const roll = player.flags.lastHomeRoll;
    if (roll === undefined || roll === null) return;
    showDiceRollAnimation(roll, title);
    return;
  }
}

// --- Dispatch wrapper with diagnostics ---
function dispatch(action) {
  // 0) Card draw guard: block extra draws this turn.
  const denyReason = getCardDrawDenyReason(gameState, action);
  if (denyReason) {
    showCardOverlay('No more cards this turn', '', denyReason);
    return;
  }

  console.log('[dispatch] about to apply action:', action);
  let nextState;

  // 1) Snapshot active player's stage BEFORE the action (for tutorials).
  const prevState = gameState;
  const prevPlayer =
    prevState && prevState.players
      ? prevState.players[prevState.activePlayerIndex]
      : null;
  const prevStage = prevPlayer ? prevPlayer.stage : null;

  try {
    nextState = applyAction(gameState, action);
  } catch (err) {
    console.error('[dispatch] ERROR while applying action:', action, err);

    const debugLogEl = document.getElementById('debugLog');
    if (debugLogEl) {
      debugLogEl.style.display = 'block';
      debugLogEl.textContent =
        'Dispatch error for action:\n' +
        JSON.stringify(action, null, 2) +
        '\n\n' +
        (err && err.stack ? err.stack : String(err));
    }

    // Don’t mutate gameState if something broke.
    return;
  }

  if (!nextState) {
    console.warn(
      '[dispatch] applyAction returned a falsy state; leaving gameState unchanged.',
      action
    );
    return;
  }

    // 2) Commit new state + render.
  gameState = nextState;
  console.log('[dispatch] new state:', gameState);
  render(gameState);

  // 3) Show a card popup if this action drew/resolved a card.
  maybeShowCardPopup(gameState, action);

  // 4) Show dice animation if we just rolled Time.
  maybeShowDiceRoll(gameState, action);

  // 5) Show stage tutorial if the active player's stage changed.
  maybeShowStageTutorial(prevStage);
}




// For debugging in console if you like:
window._starvingArtistState = () => gameState;
window._starvingArtistDispatch = dispatch;
window._starvingArtistShowCardOverlay = showCardOverlay;


// --- Kick off UI ---
setupControls(dispatch, () => gameState);
setupDevPanel(dispatch);
render(gameState);

// Consider the game ready at Turn 1 with no Time yet.
// The player explicitly starts their turn by clicking "Roll Time".
dispatch({ type: ActionTypes.START_TURN });
// Show Home tutorial once at game start (optional).
maybeShowStageTutorial(null);
// (no auto ROLL_TIME here)

// --- Dev panel toggle (repurpose the old "Toggle JSON" button) ---
const devToggleBtn = document.getElementById('toggleDebug');   // same button
const devPanelEl   = document.getElementById('debugPanel');    // whole panel
const debugLogEl   = document.getElementById('debugLog');      // optional, for legacy JSON

if (devToggleBtn && devPanelEl) {
  devToggleBtn.addEventListener('click', () => {
    const isHidden =
      devPanelEl.style.display === 'none' ||
      getComputedStyle(devPanelEl).display === 'none';

    // Show/hide the entire dev panel
    devPanelEl.style.display = isHidden ? 'block' : 'none';

    // OPTIONAL: if your raw JSON bar lives somewhere *outside* the panel,
    // you can still hide/show it in lockstep:
    if (debugLogEl && !devPanelEl.contains(debugLogEl)) {
      debugLogEl.style.display = isHidden ? 'block' : 'none';
    }

    // OPTIONAL: update label so it reads like a panel toggle instead of JSON toggle
    devToggleBtn.textContent = isHidden ? 'Hide Dev Panel' : 'Show Dev Panel';

    console.log(
      '[main] Dev panel toggle clicked. Panel now',
      isHidden ? 'visible' : 'hidden'
    );
  });
}


// --- Card overlay wiring ---
const cardOverlay = document.getElementById('cardOverlay');
const cardOverlayClose = document.getElementById('cardOverlayClose');
const cardOverlaySkip = document.getElementById('cardOverlaySkip');

if (cardOverlay && cardOverlayClose) {
  const hideOverlay = () => {
    cardOverlay.classList.remove('visible');
  };

  cardOverlayClose.addEventListener('click', () => {
    if (typeof cardOverlayPrimaryAction === 'function') {
      cardOverlayPrimaryAction();
    }
    hideOverlay();
  });

  if (cardOverlaySkip) {
    cardOverlaySkip.addEventListener('click', () => {
      if (typeof cardOverlaySecondaryAction === 'function') {
        cardOverlaySecondaryAction();
      }
      hideOverlay();
    });
  }

  // Click on the dark backdrop (but not the card itself) to close (no action)
  cardOverlay.addEventListener('click', (evt) => {
    if (evt.target === cardOverlay) {
      hideOverlay();
    }
  });

  // Escape key also closes the popup (no action)
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && cardOverlay.classList.contains('visible')) {
      hideOverlay();
    }
  });
}



