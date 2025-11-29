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

// --- Dispatch wrapper ---
function dispatch(action) {
  gameState = applyAction(gameState, action);
  render(gameState);
}

// For debugging in console if you like:
window._starvingArtistState = () => gameState;
window._starvingArtistDispatch = dispatch;

// --- Kick off UI ---
setupControls(dispatch, () => gameState);
render(gameState);

// Optional: one "auto" step so it feels alive.
// e.g. automatically START_TURN at load:
dispatch({ type: ActionTypes.START_TURN });
