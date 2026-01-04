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
let gameState = null;
let gameStarted = false;

// Seed decks with CSV data where available (fallback: SAMPLE_* arrays)
function seedDecks(state) {
  if (!state) return state;
  return {
    ...state,
    homeDeck: shuffleArray(HOME_DECK_SOURCE),
    homeDiscard: [],
    socialDeck: shuffleArray(SOCIAL_DECK_SOURCE),
    socialDiscard: [],
    profDevDeck: shuffleArray(PROF_DEV_DECK_SOURCE),
    profDevDiscard: [],
    proDeck: shuffleArray(PRO_DECK_SOURCE),
    proDiscard: []
  };
}

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
    title: '🏠 Home — Getting Out',
    name: '',
    body: `You've got ambitions that require you to leave your childhood bedroom.

Goal: Nurture your talents and develop foundational skills before going out to the wider world.

On your turn:

1) Draw a Home card.
2) Try to Leave Home (one attempt per turn).
3) End Turn.`
  },

  dreamer: {
    title: '🌠 Dreamer — Balancing Work and Ambition',
    name: '',
    body: `You're out of your parent's house and on your first step to becoming a legend!

Goal: Meet the requirements to advance into the Amateur stage.

On your turn:

1) Roll Time.
2) If you don’t have a Job, choose one.
3) Go To Work (once per turn) to gain stats.
4) Go to Social events and/or use Downtime (Practice, Sleep, Eat at Home).
5) When you’re ready, try to advance to Amateur.
6) End Turn.`
  },

  amateur: {
    title: '🎓 AMATEUR STAGE',
    name: '“This Is Starting to Count.”',
    body: `Prove your creative talents: make your art and share it with the world, laying the foundation for your future stardom.

Your goal: Compile your portfolio and successfully go Pro.

On your turn:

1) Roll Time.
2) Go To Work (once per turn) if you have a Job.
3) Start Minor Work and spend Time to progress it.
4) Draw a Prof Dev card.
5) (Optional) PR actions.
6) After you complete 3 Minor Works, try to advance to Pro.
7) End Turn.`
  },

  pro: {
    title: '🏆 PRO STAGE',
    name: '“Now It’s Serious.”',
    body: `Navigate the chaos and thrill of a professional career, establishing a legacy that will last long after you're gone.

Your goal: Be the first player to complete a Masterwork and win the game.

On your turn:

1) Roll Time (Scandal reduces your roll).
2) Go To Work (once per turn) if you still have a Job.
3) Spend Time on Masterwork Progress.
4) Draw Pro cards.
5) Take your Fame Check (required before End Turn).
6) (Optional) PR actions / Bury Scandal.
7) End Turn.`
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

const pendingTutorialByPlayerId = new Map();

function isCardOverlayVisible() {
  const el = document.getElementById('cardOverlay');
  return !!(el && el.classList.contains('visible'));
}

function queueStageTutorial(player, stage) {
  if (!player || !player.id || !stage) return;
  pendingTutorialByPlayerId.set(player.id, stage);
}

function maybeShowPendingStageTutorial() {
  const player = gameState?.players?.[gameState.activePlayerIndex];
  if (!player) return;

  const stage = pendingTutorialByPlayerId.get(player.id);
  if (!stage) return;

  if (hasSeenStageTutorial(player, stage)) {
    pendingTutorialByPlayerId.delete(player.id);
    return;
  }

  const tutorial = STAGE_TUTORIALS[stage];
  if (!tutorial) {
    pendingTutorialByPlayerId.delete(player.id);
    markStageTutorialSeen(player, stage);
    return;
  }

  showCardOverlay(tutorial.title, tutorial.name, tutorial.body);
  markStageTutorialSeen(player, stage);
  pendingTutorialByPlayerId.delete(player.id);
}

// prevStage is the stage the active player had *before* the action.
function maybeShowStageTutorial(prevStage) {
  const player = gameState.players[gameState.activePlayerIndex];
  if (!player) return;

  const nextStage = player.stage;
  if (!nextStage || nextStage === prevStage) return;

  if (hasSeenStageTutorial(player, nextStage)) return;

  // NEW: if another popup is already showing, defer the tutorial
  if (isCardOverlayVisible()) {
    queueStageTutorial(player, nextStage);
    return;
  }

  const tutorial = STAGE_TUTORIALS[nextStage];
  if (!tutorial) {
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


// --- Hotseat (pass-the-device) overlay -----------------------------------
let pendingHotseatStageTutorial = false;

function showHotseatOverlayForNextPlayer(nextPlayer) {
  const overlay = document.getElementById('hotseatOverlay');
  if (!overlay || !nextPlayer) return;

  const titleEl = document.getElementById('hotseatTitle');
  const bodyEl  = document.getElementById('hotseatBody');
  const btn     = document.getElementById('hotseatContinueBtn');

  if (titleEl) titleEl.textContent = 'Pass the device';
  if (bodyEl)  bodyEl.textContent = `${nextPlayer.name}, you're up.`;

  pendingHotseatStageTutorial = true;
  overlay.classList.add('visible');

  if (btn) {
    try { btn.focus(); } catch (_) {}
  }
}

function closeHotseatOverlay() {
  const overlay = document.getElementById('hotseatOverlay');
  if (!overlay) return;

  overlay.classList.remove('visible');

  if (pendingHotseatStageTutorial) {
    pendingHotseatStageTutorial = false;
    // Show the active player's stage tutorial (only if they haven't seen it)
    maybeShowStageTutorial(null);
  }
}

function formatStatEffects(effects) {
  if (!Array.isArray(effects)) return '';

  const parts = effects
    .filter((eff) => eff && typeof eff.delta === 'number' && eff.delta !== 0)
    .map((eff) => {
      const sign = eff.delta >= 0 ? '+' : '';
      if (eff.type === 'stat') {
        const label = eff.stat
          ? eff.stat.charAt(0).toUpperCase() + eff.stat.slice(1)
          : 'Stat';
        return `${label} ${sign}${eff.delta}`;
      }
      if (eff.type === 'masterwork') {
        return `Masterwork ${sign}${eff.delta}`;
      }
      if (eff.type === 'time') {
        return `Time ${sign}${eff.delta}`;
      }
      return '';
    })
    .filter(Boolean);

  return parts.join(', ');
}


function labelWithEffects(baseLabel, effects) {
  const effText = formatStatEffects(effects || []);
  return effText ? `${baseLabel} (${effText})` : baseLabel;
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

  // --- Non-card popup: Pro maintenance failure ---
  if (action.type === ActionTypes.PRO_MAINTENANCE_CHECK) {
    // Show only on failure, and only once per turn.
    if (flags.lastProMaintenanceSuccess === false &&
        flags.lastProMaintenanceFailPopupTurn !== currentTurn) {
      flags.lastProMaintenanceFailPopupTurn = currentTurn;

      showCardOverlay(
        'Fame Check',
        "You've been canceled!",
        "The paparazzi photographed you littering. Return to Amateur."
      );
    }
    return;
  }


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

      // Attend line (no stat effects here)
if (attendText) parts.push(`Attend: ${attendText}`);
else parts.push('Attend');

// Skip line (no stat effects here)
if (skipText) parts.push(`Skip: ${skipText}`);
else parts.push('Skip');


      bodyText = parts.join('\n\n') || '(No rules text yet.)';

      overlayConfig = {
  primaryLabel: labelWithEffects('Attend', card.attend?.effects),
  secondaryLabel: labelWithEffects('Skip', card.skip?.effects),
  onPrimary: () => dispatch({ type: ActionTypes.ATTEND_SOCIAL_EVENT }),
  onSecondary: () => dispatch({ type: ActionTypes.SKIP_SOCIAL_EVENT })
};
      break;
    }

    case ActionTypes.TAKE_PROF_DEV: {
  card = flags.pendingProfDevCard || flags.lastProfDevCard;
  if (!card) return;

  flags.lastProfDevCardTurn = currentTurn;

  label = 'Prof Dev';
  cardName = card.name || '(Prof Dev Card)';

  const parts = [];
  if (card.text) parts.push(card.text);

  const hasChoices = !!(card.choiceA || card.choiceB);
  if (hasChoices) {
    const a = card.choiceA || {};
    const b = card.choiceB || {};

    const aText = (a.text || '').trim() || 'Option A';
    const bText = (b.text || '').trim() || 'Option B';
    const aEffText = formatStatEffects(a.effects || []);
    const bEffText = formatStatEffects(b.effects || []);

    if (parts.length) parts.push('');

    let lineA = `A) ${aText}`;
    if (aEffText) lineA += ` (Effects: ${aEffText})`;
    parts.push(lineA);

    let lineB = `B) ${bText}`;
    if (bEffText) lineB += ` (Effects: ${bEffText})`;
    parts.push(lineB);

    overlayConfig = {
      primaryLabel: labelWithEffects(aText, a.effects),
      secondaryLabel: labelWithEffects(bText, b.effects),
      onPrimary: () => dispatch({ type: ActionTypes.RESOLVE_PROF_DEV_CHOICE, choice: 'A' }),
      onSecondary: () => dispatch({ type: ActionTypes.RESOLVE_PROF_DEV_CHOICE, choice: 'B' })
    };
  } else {
    const effText = formatStatEffects(card.effects || []);
    if (effText) {
      if (parts.length) parts.push('');
      parts.push(`Effects: ${effText}`);
    }
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
      // --- NEW: show minigame metadata (so success/fail makes sense) ---
if (card.minigameType || card.participants) {
  const pretty = {
    roll_off: 'Roll-off (D6 threshold)',
    skill_check: 'Skill check',
    push_your_luck: 'Push your luck',
    resource_bid: 'Resource bid',
    choice: 'Choice'
  }[card.minigameType] || card.minigameType || '—';

  const who = card.participants ? ` — ${card.participants}` : '';
}

      const hasOutcome =
  (Array.isArray(card.successEffects) && card.successEffects.length) ||
  (Array.isArray(card.failEffects) && card.failEffects.length);

if (hasOutcome) {
  overlayConfig = {
    primaryLabel: labelWithEffects('Success', card.successEffects),
    secondaryLabel: labelWithEffects('Fail', card.failEffects),
    onPrimary: () =>
      dispatch({ type: ActionTypes.RESOLVE_PRO_CARD_CHOICE, outcome: 'success' }),
    onSecondary: () =>
      dispatch({ type: ActionTypes.RESOLVE_PRO_CARD_CHOICE, outcome: 'fail' })
  };
}

if (card.notes) {
  lines.push(`Minigame: ${card.notes}`);
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
  return null;

    case ActionTypes.TAKE_PROF_DEV:
  return null;

    case ActionTypes.DRAW_PRO_CARD:
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

function maybeShowDiceRoll(state, action, prevState) {
  if (!state || !action) return;

  const prevIdx =
    prevState && typeof prevState.activePlayerIndex === 'number'
      ? prevState.activePlayerIndex
      : state.activePlayerIndex;

  const prevPlayer = prevState?.players?.[prevIdx] || null;

  // Helper to safely fetch the "actor" (the player who actually rolled),
  // even if the action auto-ended the turn and advanced the active player.
  const getActor = (idx) => state?.players?.[idx] || null;

  // Generic label for non-specific rolls
  const genericTitle = 'Dice Roll';

  // ---- Time Roll ----
  if (action.type === ActionTypes.ROLL_TIME) {
    const player = state.players[state.activePlayerIndex];
    const roll = player?.flags?.lastTimeRoll;
    if (roll === undefined || roll === null) return;
    showDiceRollAnimation(roll, genericTitle);
    return;
  }

  // ---- Leave Home roll ----
  if (action.type === ActionTypes.ATTEMPT_LEAVE_HOME) {
    const player = state.players[state.activePlayerIndex];
    const roll = player?.flags?.lastHomeRoll;
    if (roll === undefined || roll === null) return;
    showDiceRollAnimation(roll, genericTitle);
    return;
  }

    // ---- Go Pro roll ----
if (action.type === ActionTypes.ATTEMPT_ADVANCE_PRO) {
  // Use the actor index (prevIdx) to be robust in case active player ever changes.
  const actor = getActor(prevIdx);
  const roll = actor?.flags?.lastProAdvanceRoll;
  if (roll === undefined || roll === null) return;
  showDiceRollAnimation(roll, 'Go Pro Roll');
  return;
}



  // ---- Lay Low roll (Lay Low auto-ends the turn, so actor is prevIdx) ----
  if (action.type === ActionTypes.LAY_LOW) {
    const actor = getActor(prevIdx);
    const roll = actor?.flags?.lastLayLowRoll;
    if (roll === undefined || roll === null) return;
    showDiceRollAnimation(roll, 'Lay Low');
    return;
  }

  // ---- Fame Check roll (manual click) ----
  if (action.type === ActionTypes.PRO_MAINTENANCE_CHECK) {
    const player = state.players[state.activePlayerIndex];
    const roll = player?.flags?.lastProMaintenanceRoll;
    if (roll === undefined || roll === null) return;
    showDiceRollAnimation(roll, 'Fame Check');
    return;
  }

  // ---- Fame Check roll (auto-run during END_TURN) ----
  // If your rules.js triggers PRO_MAINTENANCE_CHECK inside endTurn(),
  // dispatch() sees END_TURN, not PRO_MAINTENANCE_CHECK — so detect it.
  if (action.type === ActionTypes.END_TURN) {
    if (!prevPlayer || prevPlayer.stage !== 'pro') return;

    const beforeFlags = prevPlayer.flags || {};
    const actor = getActor(prevIdx);
    const afterFlags = actor?.flags || {};

    const ranThisEndTurn =
      !beforeFlags.didProMaintenanceThisTurn &&
      !!afterFlags.didProMaintenanceThisTurn;

    if (!ranThisEndTurn) return;

    const roll = afterFlags.lastProMaintenanceRoll;
    if (roll === undefined || roll === null) return;

    showDiceRollAnimation(roll, 'Fame Check');
    return;
  }
}



// --- Card affordability guard (stage cards only) -----------------------------

function getMoneySpendFromEffects(effects) {
  if (!Array.isArray(effects)) return 0;

  let spend = 0;
  for (const eff of effects) {
    if (!eff || eff.type !== 'stat' || eff.stat !== 'money') continue;
    const d = Number(eff.delta);
    if (!Number.isFinite(d)) continue;
    if (d < 0) spend += -d; // count required money as a positive “cost”
  }
  return spend;
}

function getCardMoneyRequirementForAction(state, action) {
  const player = state?.players?.[state.activePlayerIndex];
  if (!player) return 0;

  switch (action.type) {
    // Home card resolves immediately on draw
    case ActionTypes.DRAW_HOME_CARD: {
      const deck = state.homeDeck || [];
      const card = deck.length ? deck[deck.length - 1] : null;
      return getMoneySpendFromEffects(card?.effects);
    }

    // Social resolves on choice (Attend/Skip)
    case ActionTypes.ATTEND_SOCIAL_EVENT:
    case ActionTypes.SKIP_SOCIAL_EVENT: {
      const card = player.flags?.pendingSocialEventCard;
      if (!card) return 0;

      const branch =
        action.type === ActionTypes.ATTEND_SOCIAL_EVENT ? card.attend : card.skip;

      return getMoneySpendFromEffects(branch?.effects);
    }

    // Prof Dev resolves immediately on take (card draw + apply)
    case ActionTypes.TAKE_PROF_DEV: {
      const deck = state.profDevDeck || [];
      const card = deck.length ? deck[deck.length - 1] : null;
      return getMoneySpendFromEffects(card?.effects);
    }

    case 'RESOLVE_PROF_DEV_CHOICE': {
  const card =
    player.flags?.lastProfDevCard ||
    player.flags?.pendingProfDevCard ||
    null;

  if (!card) return 0;

  const choice = String(action.choice || '').toUpperCase();
  const branch =
    choice === 'A'
      ? (card.choiceA || card.attend || card.options?.A)
      : (card.choiceB || card.skip   || card.options?.B);

  return getMoneySpendFromEffects(branch?.effects);
}

    // Pro card resolves immediately on draw
    case ActionTypes.DRAW_PRO_CARD: {
      const deck = state.proDeck || [];
      const card = deck.length ? deck[deck.length - 1] : null;
      return getMoneySpendFromEffects(card?.effects);
    }

    default:
      return 0; // IMPORTANT: does NOT apply to work / portfolio / other costs
  }
}

function getCannotAffordMessage(state, action) {
  const player = state?.players?.[state.activePlayerIndex];
  if (!player) return null;

  const required = getCardMoneyRequirementForAction(state, action);
  if (!required) return null;

  const have = player.money || 0;
  if (have >= required) return null;

  return `You need $${required} but you only have $${have}.`;
}

// --- Dispatch wrapper with diagnostics ---
function dispatch(action) {
  if (!gameStarted) {
    console.warn('[dispatch] Game not started yet; ignoring action:', action);
    return;
  }
  // 0) Card draw guard: block extra draws this turn.
  const denyReason = getCardDrawDenyReason(gameState, action);
  if (denyReason) {
    showCardOverlay('No more cards this turn', '', denyReason);
    return;
  }

    // 0.5) Card affordability guard (stage cards only)
  const cannotAfford = getCannotAffordMessage(gameState, action);
  if (cannotAfford) {
    showCardOverlay("You can't afford this!", '', cannotAfford);
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

  // 3) If we passed the device to the next player, show hotseat overlay first.
  const prevIndex = prevState ? prevState.activePlayerIndex : null;
  const nextIndex = gameState ? gameState.activePlayerIndex : null;
  const playerSwitched =
    Number.isInteger(prevIndex) && Number.isInteger(nextIndex) && prevIndex !== nextIndex;

  if (playerSwitched && (gameState.players || []).length > 1) {
    const nextPlayer = gameState.players[gameState.activePlayerIndex];
    showHotseatOverlayForNextPlayer(nextPlayer);
    return;
  }

  // 4) Show a card popup if this action drew/resolved a card.
  maybeShowCardPopup(gameState, action);

  // 5) Show dice animation if we just rolled.
  maybeShowDiceRoll(gameState, action, prevState);

  // 6) Show stage tutorial. If the active player changed, treat this as a fresh view.
  const prevPlayerId = prevPlayer ? prevPlayer.id : null;
  const nextPlayerId = gameState?.players?.[gameState.activePlayerIndex]?.id || null;
  const stageArg = (prevPlayerId && nextPlayerId && prevPlayerId === nextPlayerId) ? prevStage : null;
  maybeShowStageTutorial(stageArg);
}




// For debugging in console if you like:
window._starvingArtistState = () => gameState;
window._starvingArtistDispatch = dispatch;
window._starvingArtistShowCardOverlay = showCardOverlay;


// --- Kick off UI ---
setupControls(dispatch, () => gameState);
setupDevPanel(dispatch);

// Game now starts via the Setup overlay (hotseat).
// We keep the board inert until the player clicks "Start Game".


// --- Setup (New Game) overlay wiring ---------------------------------------

const ART_PATH_OPTIONS = [
  { value: 'author', label: 'Author' },
  { value: 'musician', label: 'Musician' },
  { value: 'actor', label: 'Actor' },
  { value: 'dancer', label: 'Dancer' },
  { value: 'filmmaker', label: 'Filmmaker' },
  { value: 'visual_artist', label: 'Visual Artist' }
];

function buildSetupPlayerRows(numPlayers) {
  const listEl = document.getElementById('setupPlayersList');
  if (!listEl) return;

  listEl.innerHTML = '';

  for (let i = 0; i < numPlayers; i++) {
    const row = document.createElement('div');
    row.className = 'setup-player-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `setupPlayerName${i}`;
    nameInput.placeholder = `Player ${i + 1} name`;
    nameInput.value = `Player ${i + 1}`;

    const artSelect = document.createElement('select');
    artSelect.id = `setupPlayerArt${i}`;

    for (const opt of ART_PATH_OPTIONS) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      artSelect.appendChild(o);
    }

    // Nice default variety across seats
    const defaultOpt = ART_PATH_OPTIONS[i % ART_PATH_OPTIONS.length];
    if (defaultOpt) artSelect.value = defaultOpt.value;

    row.appendChild(nameInput);
    row.appendChild(artSelect);
    listEl.appendChild(row);
  }
}

function startNewGameFromSetup({ numPlayers, names, artPaths }) {
  // Reset tutorial tracking for a true fresh game
  tutorialSeenByPlayerId.clear();
  pendingTutorialByPlayerId.clear();

  // Create base state
  gameState = createInitialGame({
    numPlayers,
    artPaths
  });

  // Apply names (artPaths already applied above)
  const players = gameState.players || [];
  for (let i = 0; i < players.length; i++) {
    const n = (names[i] || '').trim();
    if (n) players[i].name = n;
  }

  // Seed decks
  gameState = seedDecks(gameState);

  gameStarted = true;

  render(gameState);
  dispatch({ type: ActionTypes.START_TURN });
  // Force show the stage tutorial once for the active player.
  maybeShowStageTutorial(null);
}

function initSetupOverlay() {
  const overlay = document.getElementById('setupOverlay');
  const numSel = document.getElementById('setupNumPlayers');
  const startBtn = document.getElementById('setupStartBtn');
  const cancelBtn = document.getElementById('setupCancelBtn');

  if (!overlay || !numSel || !startBtn || !cancelBtn) {
    // If the overlay isn't present, start a default solo game.
    startNewGameFromSetup({
      numPlayers: 1,
      names: ['Player 1'],
      artPaths: ['author']
    });
    return;
  }

  const open = () => {
    overlay.classList.add('visible');
    const n = Number(numSel.value || 2);
    buildSetupPlayerRows(Number.isFinite(n) ? n : 2);
  };

  const close = () => {
    overlay.classList.remove('visible');
  };

  // Show by default on page load
  open();

  numSel.addEventListener('change', () => {
    const n = Number(numSel.value || 2);
    buildSetupPlayerRows(Number.isFinite(n) ? n : 2);
  });

  startBtn.addEventListener('click', () => {
    const n = Number(numSel.value || 2);
    const numPlayers = Number.isFinite(n) ? Math.max(1, Math.min(6, n)) : 2;

    const names = [];
    const artPaths = [];
    for (let i = 0; i < numPlayers; i++) {
      const nameEl = document.getElementById(`setupPlayerName${i}`);
      const artEl = document.getElementById(`setupPlayerArt${i}`);
      names.push(nameEl ? nameEl.value : `Player ${i + 1}`);
      artPaths.push(artEl ? artEl.value : 'visual_artist');
    }

    close();
    startNewGameFromSetup({ numPlayers, names, artPaths });
  });

  cancelBtn.addEventListener('click', () => {
    close();
    if (!gameStarted) {
      startNewGameFromSetup({
        numPlayers: 1,
        names: ['Player 1'],
        artPaths: ['author']
      });
    }
  });
}

// --- Hotseat overlay wiring (close / backdrop / escape) ---------------------
(function initHotseatOverlayWiring() {
  const overlay = document.getElementById('hotseatOverlay');
  const btn = document.getElementById('hotseatContinueBtn');
  if (!overlay || !btn) return;

  const close = () => closeHotseatOverlay();

  btn.addEventListener('click', close);
  overlay.addEventListener('click', (evt) => {
    if (evt.target === overlay) close();
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && overlay.classList.contains('visible')) {
      close();
    }
  });
})();

// Initialize the setup flow (this starts the game)
initSetupOverlay();

// --- Dev panel collapse/expand (keep the toggle button visible) ---
const devToggleBtn = document.getElementById('toggleDebug'); // button in the panel header
const devPanelEl   = document.getElementById('debugPanel');  // whole panel
const debugLogEl   = document.getElementById('debugLog');    // optional, for legacy JSON

let devPanelCollapsed = false;

function setDevPanelCollapsed(next) {
  devPanelCollapsed = !!next;

  if (!devPanelEl) return;

  // Keep the header visible (it contains the toggle button)
  const headerEl = devPanelEl.querySelector('h2');

  // Hide/show everything else inside the panel
  for (const child of Array.from(devPanelEl.children)) {
    if (child === headerEl) continue;
    child.style.display = devPanelCollapsed ? 'none' : '';
  }

  // If you ever move debugLog outside the panel, keep old behavior
  if (debugLogEl && !devPanelEl.contains(debugLogEl)) {
    debugLogEl.style.display = devPanelCollapsed ? 'none' : 'block';
  }

  if (devToggleBtn) {
    devToggleBtn.textContent = devPanelCollapsed ? 'Show Dev Panel' : 'Hide Dev Panel';
  }

  console.log('[main] Dev panel is now', devPanelCollapsed ? 'collapsed' : 'expanded');
}

if (devToggleBtn && devPanelEl) {
  // Start expanded, but update the label to be clear
  setDevPanelCollapsed(false);

  devToggleBtn.addEventListener('click', () => {
    setDevPanelCollapsed(!devPanelCollapsed);
  });
}


// --- Card overlay wiring ---
const cardOverlay = document.getElementById('cardOverlay');
const cardOverlayClose = document.getElementById('cardOverlayClose');
const cardOverlaySkip = document.getElementById('cardOverlaySkip');

if (cardOverlay && cardOverlayClose) {
  const hideOverlay = () => {
    cardOverlay.classList.remove('visible');
    maybeShowPendingStageTutorial();
  };

  cardOverlayClose.addEventListener('click', () => {
  hideOverlay(); // hide the *current* overlay first
  if (typeof cardOverlayPrimaryAction === 'function') {
    cardOverlayPrimaryAction(); // this can open a new overlay (e.g., "can't afford")
  }
});

  if (cardOverlaySkip) {
    cardOverlaySkip.addEventListener('click', () => {
  hideOverlay();
  if (typeof cardOverlaySecondaryAction === 'function') {
    cardOverlaySecondaryAction();
  }
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
