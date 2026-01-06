#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createInitialGame,
  getActivePlayer,
  isGameOver,
  STAGE_HOME,
  STAGE_DREAMER,
  STAGE_AMATEUR,
  STAGE_PRO,
  STATUS_WON
} from "../src/engine/state.js";

import { applyAction } from "../src/engine/rules.js";
import { ActionTypes } from "../src/engine/actions.js";
import { getMinorWorkTemplatesForArtPath } from "../src/engine/minor_works.js";

// -------------------------
// CLI args
// -------------------------
function getArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  return v == null ? fallback : v;
}

const GAMES = Number(getArg("games", "50"));
const PLAYERS = Number(getArg("players", "2"));
const SEED0 = Number(getArg("seed", "1"));
const OUT = getArg("out", "");

// Deck paths (adjust to your repo layout)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const HOME_CSV = getArg("home", path.join(ROOT, "src/data/cards/home_deck.csv"));
const SOCIAL_CSV = getArg("social", path.join(ROOT, "src/data/cards/social_deck.csv"));
const PROFDEV_CSV = getArg("profdev", path.join(ROOT, "src/data/cards/prof_dev_deck.csv"));
const PRO_CSV = getArg("pro", path.join(ROOT, "src/data/cards/pro_deck.csv"));

// -------------------------
// Seeded RNG (monkey patch)
// -------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REAL_RANDOM = Math.random;

// -------------------------
// CSV parsing + minimal converters
// (mirrors your cards.js behavior enough for simulation)
// -------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r") continue;
      else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowToObject(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = (headers[i] || "").trim();
    if (!key) continue;
    obj[key] = String(row[i] ?? "").trim();
  }
  return obj;
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function buildStatEffects(row, prefix = "") {
  const stats = ["money", "food", "inspiration", "craft"];
  const effects = [];

  for (const stat of stats) {
    const gain = toNumber(row[`${prefix}gain_${stat}`]);
    const loss = toNumber(row[`${prefix}loss_${stat}`]);
    if (gain != null && gain !== 0) effects.push({ type: "stat", stat, delta: gain });
    if (loss != null && loss !== 0) effects.push({ type: "stat", stat, delta: -loss });
  }

  // optional time deltas
  const gainTime = toNumber(row[`${prefix}gain_time`]);
  const lossTime = toNumber(row[`${prefix}loss_time`]);
  if (gainTime != null && gainTime !== 0) effects.push({ type: "time", delta: gainTime });
  if (lossTime != null && lossTime !== 0) effects.push({ type: "time", delta: -lossTime });

  return effects;
}

function loadDeckFromCsv(csvPath, converter) {
  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const [headers, ...data] = rows;

  const out = [];
  for (const r of data) {
    if (r.every((c) => !c || !String(c).trim())) continue;
    const obj = rowToObject(headers, r);
    const card = converter(obj);
    if (card) out.push(card);
  }
  return out;
}

function convertHomeRow(row) {
  const id = (row.id || row.ID || "").trim();
  if (!id) return null;
  return {
    id,
    name: String(row.title || row.name || id).trim(),
    text: String(row.flavor || row.text || "").trim(),
    effects: buildStatEffects(row, "")
  };
}

function convertSocialRow(row) {
  const id = (row.id || row.ID || "").trim();
  if (!id) return null;
  return {
    id,
    name: String(row.title || row.name || id).trim(),
    text: String(row.flavor || row.text || "").trim(),
    timeCost: toNumber(row.time_cost ?? row.timeCost) ?? 1,
    attend: { text: String(row.choiceA_label || "").trim(), effects: buildStatEffects(row, "choiceA_") },
    skip: { text: String(row.choiceB_label || "").trim(), effects: buildStatEffects(row, "choiceB_") }
  };
}

function convertProfDevRow(row) {
  const id = (row.id || row.ID || "").trim();
  if (!id) return null;
  // Your current amateur reducer only supports card.effects (not choice resolution),
  // so we keep this simple for simulation:
  return {
    id,
    name: String(row.title || row.name || id).trim(),
    text: String(row.flavor || row.text || "").trim(),
    timeCost: toNumber(row.time_cost ?? row.timeCost) ?? 2,
    effects: buildStatEffects(row, "")
    // minorWork boosts could be added later if you want deeper fidelity
  };
}

function convertProRow(row) {
  const id = (row.id || row.ID || "").trim();
  if (!id) return null;

  const card = {
    id,
    name: String(row.title || row.name || id).trim(),
    text: String(row.flavor || row.text || "").trim(),
    timeCost: toNumber(row.time_cost ?? row.timeCost) ?? 3,
    effects: buildStatEffects(row, "")
  };

  const successEffects = buildStatEffects(row, "success_");
  const failEffects = buildStatEffects(row, "fail_");
  if (successEffects.length) card.successEffects = successEffects;
  if (failEffects.length) card.failEffects = failEffects;

  return card;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -------------------------
// Simulation helpers
// -------------------------
function dispatch(state, type, payload = {}) {
  return applyAction(state, { type, ...payload });
}

function chooseSocialChoice(card) {
  // Dumb heuristic: prefer the branch with higher sum of stat deltas
  const score = (effects) =>
    (effects || []).reduce((s, e) => s + (e.type === "stat" ? (e.delta || 0) : 0), 0);
  const a = score(card?.attend?.effects);
  const b = score(card?.skip?.effects);
  return a >= b ? "attend" : "skip";
}

function pickNextMinorWorkId(player) {
  const templates = getMinorWorkTemplatesForArtPath(player.artPath) || [];
  const completed = new Set((player.minorWorks || []).map((mw) => mw.id));
  // Prefer career first (passive), then quick, then spotlight
  const order = ["career", "quick", "spotlight"];
  for (const kind of order) {
    const t = templates.find((x) => x.kind === kind && !completed.has(x.id));
    if (t) return t.id;
  }
  // fallback: anything not completed
  const t = templates.find((x) => !completed.has(x.id));
  return t ? t.id : null;
}

function playTurn(state, counters) {
  let safety = 0;

  while (!isGameOver(state) && safety++ < 200) {
    const p = getActivePlayer(state);
    if (!p) break;

    // Resolve pending popups first
    if (p.flags?.pendingSocialEventCard) {
      const choice = chooseSocialChoice(p.flags.pendingSocialEventCard);
      state = dispatch(state, choice === "attend" ? ActionTypes.ATTEND_SOCIAL_EVENT : ActionTypes.SKIP_SOCIAL_EVENT);
      counters.actions[choice === "attend" ? ActionTypes.ATTEND_SOCIAL_EVENT : ActionTypes.SKIP_SOCIAL_EVENT]++;
      continue;
    }

    if (p.flags?.pendingProCard) {
      // Pick better branch by stat delta sum
      const card = p.flags.pendingProCard;
      const score = (effects) =>
        (effects || []).reduce((s, e) => s + (e.type === "stat" ? (e.delta || 0) : 0), 0);
      const pick = score(card.successEffects) >= score(card.failEffects) ? "success" : "fail";
      state = dispatch(state, ActionTypes.RESOLVE_PRO_CARD_CHOICE, { outcome: pick });
      counters.actions[ActionTypes.RESOLVE_PRO_CARD_CHOICE]++;
      continue;
    }

    // Stage policies
    if (p.stage === STAGE_HOME) {
      state = dispatch(state, ActionTypes.DRAW_HOME_CARD);
      counters.actions[ActionTypes.DRAW_HOME_CARD]++;
      state = dispatch(state, ActionTypes.ATTEMPT_LEAVE_HOME);
      counters.actions[ActionTypes.ATTEMPT_LEAVE_HOME]++;
      state = dispatch(state, ActionTypes.END_TURN);
      counters.actions[ActionTypes.END_TURN]++;
      return state;
    }

    // Roll time if needed (Dreamer/Amateur/Pro)
    if (!p.flags?.hasRolledTimeThisTurn) {
      state = dispatch(state, ActionTypes.ROLL_TIME);
      counters.actions[ActionTypes.ROLL_TIME]++;
      continue;
    }

    // Ensure job
    if (!p.jobId && (p.stage === STAGE_DREAMER || p.stage === STAGE_AMATEUR) && (state.jobDeck?.length || 0) > 0) {
      const jobId = state.jobDeck[Math.floor(Math.random() * state.jobDeck.length)];
      state = dispatch(state, ActionTypes.CHOOSE_JOB, { jobId });
      counters.actions[ActionTypes.CHOOSE_JOB]++;
      continue;
    }

    // Work once per turn if employed
    if (p.jobId && !p.flags?.hasWorkedThisTurn) {
      state = dispatch(state, ActionTypes.GO_TO_WORK);
      counters.actions[ActionTypes.GO_TO_WORK]++;
      continue;
    }

    // DREAMER: spend time on social, then attempt advance last
    if (p.stage === STAGE_DREAMER) {
      if ((p.timeThisTurn || 0) > 0) {
        state = dispatch(state, ActionTypes.DRAW_SOCIAL_CARD);
        counters.actions[ActionTypes.DRAW_SOCIAL_CARD]++;
        continue;
      }

      // attempt advance last (no time cost, but success resets time)
      state = dispatch(state, ActionTypes.ATTEMPT_ADVANCE_DREAMER);
      counters.actions[ActionTypes.ATTEMPT_ADVANCE_DREAMER]++;

      state = dispatch(state, ActionTypes.END_TURN);
      counters.actions[ActionTypes.END_TURN]++;
      return state;
    }

    // AMATEUR: progress minor works; attempt pro at end if ready
    if (p.stage === STAGE_AMATEUR) {
      if ((p.timeThisTurn || 0) > 0) {
        if (p.minorWorkInProgressId) {
          state = dispatch(state, ActionTypes.PROGRESS_MINOR_WORK);
          counters.actions[ActionTypes.PROGRESS_MINOR_WORK]++;
          continue;
        }

        const nextWorkId = pickNextMinorWorkId(p);
        if (nextWorkId) {
          state = dispatch(state, ActionTypes.START_MINOR_WORK, { workId: nextWorkId });
          counters.actions[ActionTypes.START_MINOR_WORK]++;
          continue;
        }

        // fallback: prof dev if nothing else
        state = dispatch(state, ActionTypes.TAKE_PROF_DEV);
        counters.actions[ActionTypes.TAKE_PROF_DEV]++;
        continue;
      }

      state = dispatch(state, ActionTypes.ATTEMPT_ADVANCE_PRO);
      counters.actions[ActionTypes.ATTEMPT_ADVANCE_PRO]++;

      state = dispatch(state, ActionTypes.END_TURN);
      counters.actions[ActionTypes.END_TURN]++;
      return state;
    }

    // PRO: manage scandal; build focus; progress masterwork; maintenance; end
    if (p.stage === STAGE_PRO) {
      // If scandal blocks masterwork, buyout if possible
      if ((p.scandal || 0) > 0) {
        state = dispatch(state, ActionTypes.BUYOUT_SCANDAL);
        counters.actions[ActionTypes.BUYOUT_SCANDAL]++;
        // If still blocked and lay low available, do it (ends turn)
        const p2 = getActivePlayer(state);
        if ((p2?.scandal || 0) > 0 && p2?.flags?.canLayLowThisTurn) {
          state = dispatch(state, ActionTypes.LAY_LOW);
          counters.actions[ActionTypes.LAY_LOW]++;
          return state;
        }
        continue;
      }

      if ((p.timeThisTurn || 0) > 0) {
        const focus = p.flags?.proMasterworkFocusStat; // 'food'|'inspiration'|'craft'
        const focusVal = focus ? (p[focus] || 0) : 0;

        if (focus && focusVal <= 0) {
          // try to generate 1 focus via downtime (only once per type)
          const map = {
            food: ActionTypes.DOWNTIME_EAT_AT_HOME,
            inspiration: ActionTypes.DOWNTIME_SLEEP,
            craft: ActionTypes.DOWNTIME_PRACTICE
          };
          const act = map[focus];
          const usedKey =
            focus === "food" ? "usedEatAtHomeThisTurn" : focus === "inspiration" ? "usedSleepThisTurn" : "usedPracticeThisTurn";
          if (act && !p.flags?.[usedKey]) {
            state = dispatch(state, act);
            counters.actions[act]++;
            continue;
          }
        }

        // Prefer masterwork if it can actually move
        if (focus && focusVal > 0) {
          state = dispatch(state, ActionTypes.WORK_ON_MASTERWORK);
          counters.actions[ActionTypes.WORK_ON_MASTERWORK]++;
          continue;
        }

        // Otherwise draw a pro card
        state = dispatch(state, ActionTypes.DRAW_PRO_CARD);
        counters.actions[ActionTypes.DRAW_PRO_CARD]++;
        continue;
      }

      // Must do maintenance check before ending turn (or END_TURN will be blocked)
      state = dispatch(state, ActionTypes.PRO_MAINTENANCE_CHECK);
      counters.actions[ActionTypes.PRO_MAINTENANCE_CHECK]++;

      state = dispatch(state, ActionTypes.END_TURN);
      counters.actions[ActionTypes.END_TURN]++;
      return state;
    }

    // Fallback: end turn
    state = dispatch(state, ActionTypes.END_TURN);
    counters.actions[ActionTypes.END_TURN]++;
    return state;
  }

  // Safety fallback
  state = dispatch(state, ActionTypes.END_TURN);
  counters.actions[ActionTypes.END_TURN]++;
  return state;
}

function runOneGame(seed) {
  Math.random = mulberry32(seed);

  // Initialize
  let state = createInitialGame({ numPlayers: PLAYERS });

  // Load decks
  const homeDeck = shuffle(loadDeckFromCsv(HOME_CSV, convertHomeRow));
  const socialDeck = shuffle(loadDeckFromCsv(SOCIAL_CSV, convertSocialRow));
  const profDevDeck = shuffle(loadDeckFromCsv(PROFDEV_CSV, convertProfDevRow));
  const proDeck = shuffle(loadDeckFromCsv(PRO_CSV, convertProRow));

  state = {
    ...state,
    homeDeck,
    homeDiscard: [],
    socialDeck,
    socialDiscard: [],
    profDevDeck,
    profDevDiscard: [],
    proDeck,
    proDiscard: []
  };

  // Start first turn
  state = dispatch(state, ActionTypes.START_TURN);

  const counters = {
    actions: Object.fromEntries(Object.values(ActionTypes).map((t) => [t, 0])),
    seed
  };
  counters.actions[ActionTypes.START_TURN]++;

  const maxTurns = state.config?.global?.maxTurns ?? 40;

  let winnerId = null;
  while (!isGameOver(state) && (state.turn || 1) <= maxTurns) {
    const before = state.status;
    state = playTurn(state, counters);
    if (before !== STATUS_WON && state.status === STATUS_WON) {
      winnerId = getActivePlayer(state)?.id || null;
    }
  }

  const result = {
    seed,
    status: state.status,
    turns: state.turn,
    winnerId,
    players: state.players.map((p) => ({
      id: p.id,
      artPath: p.artPath,
      stage: p.stage,
      masterworkProgress: p.masterworkProgress || 0,
      money: p.money || 0,
      food: p.food || 0,
      inspiration: p.inspiration || 0,
      craft: p.craft || 0,
      scandal: p.scandal || 0,
      minorWorks: (p.minorWorks || []).length
    })),
    actionCounts: counters.actions
  };

  return result;
}

// -------------------------
// Main
// -------------------------
try {
  const results = [];
  for (let i = 0; i < GAMES; i++) {
    results.push(runOneGame(SEED0 + i));
  }

  // Aggregate
  const wins = results.filter((r) => r.status === STATUS_WON).length;
  const avgTurns =
    results.reduce((s, r) => s + (Number(r.turns) || 0), 0) / Math.max(1, results.length);

  const summary = {
    games: GAMES,
    players: PLAYERS,
    seedStart: SEED0,
    winRate: wins / Math.max(1, GAMES),
    avgTurns,
    results
  };

  const text = JSON.stringify(summary, null, 2);

  if (OUT) {
    fs.writeFileSync(OUT, text, "utf8");
    console.log(`Wrote ${OUT}`);
  } else {
    console.log(text);
  }
} finally {
  Math.random = REAL_RANDOM;
}
