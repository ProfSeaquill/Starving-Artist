// src/main.js

import { createInitialGame } from './engine/state.js';
import { applyAction } from './engine/rules.js';
import { setupControls } from './ui/controls.js';
import { render } from './ui/render.js';

import { ActionTypes } from './engine/actions.js';

// --- Sample card data (for testing only) ---
// You will eventually load this from JSON files.

const SAMPLE_HOME_CARDS = [
  {
    id: 'home_001',
    name: 'Gift from Grandma',
    text: '+2 Money, +1 Food.',
    effects: [
      { type: 'stat', stat: 'money', delta: 2 },
      { type: 'stat', stat: 'food', delta: 1 }
    ]
  },
  {
    id: 'home_002',
    name: 'Old Sketchbook',
    text: '+2 Inspiration.',
    effects: [
      { type: 'stat', stat: 'inspiration', delta: 2 }
    ]
  },
  {
    id: 'home_003',
    name: 'Supportive Parent',
    text: '+1 Food, +1 Craft.',
    effects: [
      { type: 'stat', stat: 'food', delta: 1 },
      { type: 'stat', stat: 'craft', delta: 1 }
    ]
  }
];

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

// Seed decks with sample data
gameState = {
  ...gameState,
  homeDeck: shuffleArray(SAMPLE_HOME_CARDS),
  homeDiscard: [],
  socialDeck: shuffleArray(SAMPLE_SOCIAL_CARDS),
  socialDiscard: [],
  profDevDeck: shuffleArray(SAMPLE_PROF_DEV_CARDS),
  profDevDiscard: [],
  proDeck: shuffleArray(SAMPLE_PRO_CARDS),
  proDiscard: []
};

function maybeShowCardPopup(state, action) {
  const overlay = document.getElementById('cardOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('cardOverlayTitle');
  const nameEl  = document.getElementById('cardOverlayName');
  const bodyEl  = document.getElementById('cardOverlayBody');
  if (!titleEl || !nameEl || !bodyEl) return;

  const player = state.players[state.activePlayerIndex];
  if (!player || !player.flags) return;
  const flags = player.flags;

  let card = null;
  let label = '';
  let bodyText = '';

  switch (action.type) {
    case ActionTypes.DRAW_HOME_CARD: {
      card = flags.lastHomeCard;
      label = 'Home Card';
      if (card && card.text) {
        bodyText = card.text;
      }
      break;
    }

    case ActionTypes.ATTEND_SOCIAL_EVENT:
    case ActionTypes.SKIP_SOCIAL_EVENT: {
      card = flags.lastSocialEventCard;
      label = 'Social Event';
      if (card) {
        const attendText = card.attend && card.attend.text;
        const skipText   = card.skip && card.skip.text;
        const parts = [];
        if (attendText) parts.push('Attend: ' + attendText);
        if (skipText)   parts.push('Skip: '   + skipText);
        bodyText = parts.join('\n\n');
      }
      break;
    }

    case ActionTypes.DRAW_PRO_CARD: {
      card = flags.lastProCard;
      label = 'Pro Card';
      if (card) {
        const lines = [];
        if (card.text) lines.push(card.text);
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
        bodyText = lines.join('\n\n');
      }
      break;
    }

    case ActionTypes.DRAW_CULTURE_CARD: {
      // Future-proofing: when Culture cards are wired, just set flags.lastCultureCard
      card = flags.lastCultureCard;
      label = 'Culture Card';
      if (card && card.text) {
        bodyText = card.text;
      }
      break;
    }

    default:
      return; // Not a card-draw action; bail.
  }

  if (!card) return;

  titleEl.textContent = label;
  nameEl.textContent  = card.name || '(Unnamed card)';
  bodyEl.textContent  = bodyText || '(No rules text yet.)';

  overlay.classList.add('visible');
}

// --- Dispatch wrapper with diagnostics ---
function dispatch(action) {
  console.log('[dispatch] about to apply action:', action);
  let nextState;

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

  gameState = nextState;
  console.log('[dispatch] new state:', gameState);
  render(gameState);
  maybeShowCardPopup(gameState, action);
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

if (cardOverlay && cardOverlayClose) {
  const hideOverlay = () => {
    cardOverlay.classList.remove('visible');
  };

  cardOverlayClose.addEventListener('click', hideOverlay);

  // Click on the dark backdrop (but not the card itself) to close
  cardOverlay.addEventListener('click', (evt) => {
    if (evt.target === cardOverlay) {
      hideOverlay();
    }
  });

  // Escape key also closes the popup
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && cardOverlay.classList.contains('visible')) {
      hideOverlay();
    }
  });
}


