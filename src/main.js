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



// --- Sample card data (for testing only) ---
// You will eventually load this from JSON files.

const SAMPLE_SOCIAL_CARDS = [
  {
    id: 'dreamer_001',
    name: 'Gallery Opening',
    timeCost: 1,
    attend: {
      text: 'Pay 1 Food, gain 2 Inspiration, 1 Craft.',
      effects: [
        { type: 'stat', stat: 'food', delta: -1 },
        { type: 'stat', stat: 'inspiration', delta: 2 },
        { type: 'stat', stat: 'craft', delta: 1 }
      ]
    },
    skip: {
      text: 'Stay home and rest. Gain 1 Food.',
      effects: [{ type: 'stat', stat: 'food', delta: 1 }]
    }
  },
  {
    id: 'dreamer_002',
    name: 'Open Mic Night',
    timeCost: 1,
    attend: {
      text: 'Gain 1 Inspiration, 1 Craft.',
      effects: [
        { type: 'stat', stat: 'inspiration', delta: 1 },
        { type: 'stat', stat: 'craft', delta: 1 }
      ]
    },
    skip: {
      text: 'You doomscroll. Nothing happens.',
      effects: []
    }
  }
];

const SAMPLE_PROF_DEV_CARDS = [
  {
    id: 'prof_001',
    name: 'Online Masterclass',
    timeCost: 2,
    effects: [
      { type: 'stat', stat: 'craft', delta: 2 },
      { type: 'stat', stat: 'inspiration', delta: 1 }
    ]
  },
  {
    id: 'prof_002',
    name: 'Launch a Patreon',
    timeCost: 2,
    effects: [
      { type: 'stat', stat: 'inspiration', delta: 1 }
    ],
    minorWork: {
      id: 'mw_patreon',
      name: 'Patreon Supporters',
      effectsPerTurn: [
        { type: 'stat', stat: 'money', delta: 2 }
      ]
    }
  }
];

const SAMPLE_PRO_CARDS = [
  {
    id: 'pro_001',
    name: 'International Festival',
    timeCost: 3,
    effects: [
      { type: 'stat', stat: 'money', delta: 3 },
      { type: 'stat', stat: 'inspiration', delta: 2 },
      { type: 'masterwork', delta: 2 }
    ]
  },
  {
    id: 'pro_002',
    name: 'Tough Critic Review',
    timeCost: 3,
    effects: [
      { type: 'stat', stat: 'inspiration', delta: -1 },
      { type: 'stat', stat: 'craft', delta: 1 }
    ]
  }
];


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
  const player = state.players[state.activePlayerIndex];
  if (!player) return;

  // Ensure flags exists
  player.flags = player.flags || {};
  const flags = player.flags;

  const currentTurn = state.turn || 1;

  let card = null;
  let label = '';
  let bodyText = '';
  let cardName = '';
  let overlayConfig = null;

  switch (action.type) {
            case ActionTypes.DRAW_SOCIAL_CARD: {
      card = flags.lastSocialEventCard;
      if (!card) return;
      flags.lastSocialEventTurn = currentTurn; // remember this turn
      label = 'Social Event';
      cardName = card.name || '(Social Event)';

      const attendText = card.attend && card.attend.text;
      const skipText   = card.skip && card.skip.text;

      const parts = [];

      // Overall flavor / description from CSV (flavor column → card.text)
      if (card.text) {
        parts.push(card.text);
      }

      // Choice texts, if present
      if (attendText) parts.push('Attend: ' + attendText);
      if (skipText)   parts.push('Skip: '   + skipText);

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



    case ActionTypes.DRAW_SOCIAL_CARD: {
  card = flags.lastSocialEventCard;
  if (!card) return;
  flags.lastSocialEventTurn = currentTurn; // remember this turn
  label = 'Social Event';
  cardName = card.name || '(Social Event)';
  const attendText = card.attend && card.attend.text;
  const skipText   = card.skip && card.skip.text;
  const parts = [];
  if (attendText) parts.push('Attend: ' + attendText);
  if (skipText)   parts.push('Skip: '   + skipText);
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
      return;
  }

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

function showDiceRollAnimation(finalValue) {
  const overlay = document.getElementById('diceOverlay');
  const face = document.getElementById('diceFace');
  const okBtn = document.getElementById('diceOkButton');
  if (!overlay || !face || !okBtn) return;

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
  if (action.type !== ActionTypes.ROLL_TIME) return;

  const player = state.players[state.activePlayerIndex];
  if (!player || !player.flags) return;

  const roll = player.flags.lastTimeRoll;
  if (roll === undefined || roll === null) return;

  showDiceRollAnimation(roll);
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

// --- Kick off UI ---
setupControls(dispatch, () => gameState);
render(gameState);

// Consider the game ready at Turn 1 with no Time yet.
// The player explicitly starts their turn by clicking "Roll Time".
dispatch({ type: ActionTypes.START_TURN });
// Show Home tutorial once at game start (optional).
maybeShowStageTutorial(null);
// (no auto ROLL_TIME here)

// --- Debug panel toggle ---
const toggleBtn = document.getElementById('toggleDebug');
const debugLogEl = document.getElementById('debugLog');

if (toggleBtn && debugLogEl) {
  toggleBtn.addEventListener('click', () => {
    const isHidden = debugLogEl.style.display === 'none';
    debugLogEl.style.display = isHidden ? 'block' : 'none';
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



