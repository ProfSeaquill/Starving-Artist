// src/engine/cards.js

/**
 * HOME DECK
 * =========
 * Expected columns in home_deck.csv (case-sensitive recommended):
 *   id
 *   title
 *   flavor
 *   gain_money, gain_food, gain_inspiration, gain_craft
 *   loss_money, loss_food, loss_inspiration, loss_craft
 *   tags   (optional, "a; b; c")
 *
 * These map to the existing Home card format:
 * {
 *   id, name, text,
 *   effects: [ { type:'stat', stat:'money', delta:2 }, ... ],
 *   tags?: string[]
 * }
 */

export async function loadHomeDeckFromCsv(
  url = './data/cards/home_deck.csv'
) {
  const rows = await fetchCsvRows(url);
  if (!rows.length) return [];

  const [headers, ...data] = rows;
  const cards = [];

  for (const row of data) {
    if (row.every((c) => !c || !c.trim())) continue;
    const obj = rowToObject(headers, row);
    const card = convertHomeRow(obj);
    if (card) cards.push(card);
  }

  return cards;
}

function convertHomeRow(row) {
  const rawId = row.id || row.ID || row.Id;
  if (!rawId) {
    console.warn('[cards] Skipping Home row without id:', row);
    return null;
  }

  const id = rawId.trim();
  const name =
    (row.title || row.name || row.card_name || id).trim();
  const text =
    (row.flavor || row.text || '').trim();

  const effects = buildStatEffects(row, '');

  const card = { id, name, text, effects };

  if (row.tags && row.tags.trim()) {
    card.tags = row.tags
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return card;
}

/**
 * SOCIAL / DREAMER DECK
 * =====================
 * Expected CSV: data/cards/social_deck.csv
 *
 * Columns (recommended):
 *   id
 *   title
 *   flavor          (used as overall description if you want)
 *   time_cost
 *
 *   attend_text
 *   attend_gain_money, attend_gain_food, attend_gain_inspiration, attend_gain_craft
 *   attend_loss_money, attend_loss_food, attend_loss_inspiration, attend_loss_craft
 *
 *   skip_text
 *   skip_gain_money, skip_gain_food, skip_gain_inspiration, skip_gain_craft
 *   skip_loss_money, skip_loss_food, skip_loss_inspiration, skip_loss_craft
 *
 * These map to the shape already used by SAMPLE_SOCIAL_CARDS:
 * {
 *   id,
 *   name,
 *   timeCost,
 *   attend: { text, effects: [...] },
 *   skip:   { text, effects: [...] }
 * }
 */

export async function loadSocialDeckFromCsv(
  url = './data/cards/social_deck.csv'
) {
  const rows = await fetchCsvRows(url);
  if (!rows.length) return [];

  const [headers, ...data] = rows;
  const cards = [];

  for (const row of data) {
    if (row.every((c) => !c || !c.trim())) continue;
    const obj = rowToObject(headers, row);
    const card = convertSocialRow(obj);
    if (card) cards.push(card);
  }

  return cards;
}

function convertSocialRow(row) {
  const rawId = row.id || row.ID || row.Id;
  if (!rawId) {
    console.warn('[cards] Skipping Social row without id:', row);
    return null;
  }

  const id = rawId.trim();
  const name =
    (row.title || row.name || row.card_name || id).trim();

  // Overall flavor / description of the event
  const text =
    (row.flavor || row.text || '').trim();

  const timeCost =
    toNumber(row.time_cost ?? row.timeCost) ?? 1;

  // - blocked_paths: these art paths may NOT draw the card
  const blockedPaths = splitList(
    row.blocked_paths ?? row.blockedPaths ?? row.paths_blocked ?? row.pathsBlocked
  );

  // --- Map CSV choiceA_* / choiceB_* → attend / skip branches ---

  // Choice A → Attend
  const attendEffects = buildStatEffects(row, 'choiceA_');
  const attend = {
    text: (row.choiceA_label || '').trim(),
    effects: attendEffects
  };

  // Choice B → Skip
  const skipEffects = buildStatEffects(row, 'choiceB_');
  const skip = {
    text: (row.choiceB_label || '').trim(),
    effects: skipEffects
  };

  const card = { id, name, text, timeCost, attend, skip };

  if (allowedPaths && allowedPaths.length) card.allowedPaths = allowedPaths;
  if (blockedPaths && blockedPaths.length) card.blockedPaths = blockedPaths;

  return card;
}



/**
 * PROF DEV DECK
 * =============
 * Expected CSV: data/cards/prof_dev_deck.csv
 *
 * Columns (recommended):
 *   id
 *   title
 *   flavor
 *   time_cost
 *
 *   gain_money, gain_food, gain_inspiration, gain_craft
 *   loss_money, loss_food, loss_inspiration, loss_craft
 *
 *   minorWork_id
 *   minorWork_name
 *   minorWork_gain_money, minorWork_gain_food, minorWork_gain_inspiration, minorWork_gain_craft
 *
 * Maps to SAMPLE_PROF_DEV_CARDS shape:
 * {
 *   id,
 *   name,
 *   timeCost,
 *   effects: [...],
 *   minorWork?: {
 *     id,
 *     name,
 *     effectsPerTurn: [...]
 *   }
 * }
 */

export async function loadProfDevDeckFromCsv(
  url = './data/cards/prof_dev_deck.csv'
) {
  const rows = await fetchCsvRows(url);
  if (!rows.length) return [];

  const [headers, ...data] = rows;
  const cards = [];

  for (const row of data) {
    if (row.every((c) => !c || !c.trim())) continue;
    const obj = rowToObject(headers, row);
    const card = convertProfDevRow(obj);
    if (card) cards.push(card);
  }

  return cards;
}

function convertProfDevRow(row) {
  const rawId = row.id || row.ID || row.Id;
  if (!rawId) {
    console.warn('[cards] Skipping ProfDev row without id:', row);
    return null;
  }

  const id = rawId.trim();
  const name =
    (row.title || row.name || row.card_name || id).trim();
  const text =
    (row.flavor || row.text || '').trim();

  const timeCost =
    toNumber(row.time_cost ?? row.timeCost) ?? 1;

  const effects = buildStatEffects(row, '');

  // Optional Minor Work
  const mwId =
    (row.minorWork_id || row.minorwork_id || '').trim();
  const mwName =
    (row.minorWork_name || row.minorwork_name || '').trim();

  let minorWork = undefined;
  if (mwId || mwName) {
    const mwEffects = buildStatEffects(row, 'minorWork_');
    minorWork = {
      id: mwId || `${id}_mw`,
      name: mwName || 'Minor Work',
      effectsPerTurn: mwEffects
    };
  }

  return {
    id,
    name,
    text,
    timeCost,
    effects,
    ...(minorWork ? { minorWork } : {})
  };
}

/**
 * PRO DECK
 * ========
 * Expected CSV: data/cards/pro_deck.csv
 *
 * Columns (recommended):
 *   id
 *   title
 *   flavor
 *   time_cost
 *
 *   gain_money, gain_food, gain_inspiration, gain_craft
 *   loss_money, loss_food, loss_inspiration, loss_craft
 *
 *   gain_masterwork, loss_masterwork, masterwork_delta
 *
 * Maps to SAMPLE_PRO_CARDS shape:
 * {
 *   id,
 *   name,
 *   text,
 *   timeCost,
 *   effects: [
 *     { type:'stat', stat:'money', delta:2 },
 *     { type:'masterwork', delta:2 }
 *   ]
 * }
 */

export async function loadProDeckFromCsv(
  url = './data/cards/pro_deck.csv'
) {
  const rows = await fetchCsvRows(url);
  if (!rows.length) return [];

  const [headers, ...data] = rows;
  const cards = [];

  for (const row of data) {
    if (row.every((c) => !c || !c.trim())) continue;
    const obj = rowToObject(headers, row);
    const card = convertProRow(obj);
    if (card) cards.push(card);
  }

  return cards;
}

function convertProRow(row) {
  const rawId = row.id || row.ID || row.Id;
  if (!rawId) {
    console.warn('[cards] Skipping Pro row without id:', row);
    return null;
  }

  const id = rawId.trim();
  const name =
    (row.title || row.name || row.card_name || id).trim();
  const text =
    (row.flavor || row.text || '').trim();

  const timeCost =
    toNumber(row.time_cost ?? row.timeCost) ?? 3;

  const effects = buildStatEffects(row, '');

  // Masterwork delta can be in several places
  const mwGain = toNumber(row.gain_masterwork);
  const mwLoss = toNumber(row.loss_masterwork);
  const mwDelta =
    toNumber(row.masterwork_delta) ??
    (mwGain != null
      ? mwGain
      : mwLoss != null
      ? -mwLoss
      : null);

  if (mwDelta != null && mwDelta !== 0) {
    effects.push({
      type: 'masterwork',
      delta: mwDelta
    });
  }

  return {
    id,
    name,
    text,
    timeCost,
    effects
  };
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

async function fetchCsvRows(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch CSV from ${url}: ${res.status} ${res.statusText}`
    );
  }
  const text = await res.text();
  return parseCsv(text);
}

function rowToObject(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    if (!key) continue;
    const value = row[i] ?? '';
    obj[key.trim()] = String(value).trim();
  }
  return obj;
}

function splitList(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Build stat effects from columns like:
 *   gain_money, loss_money, gain_food, ...
 *
 * If you pass a prefix, it expects (e.g. for minorWork_):
 *   minorWork_gain_money, minorWork_loss_money, ...
 */
function buildStatEffects(row, prefix = '') {
  const stats = ['money', 'food', 'inspiration', 'craft'];
  const effects = [];

  for (const stat of stats) {
    const gainKey = `${prefix}gain_${stat}`;
    const lossKey = `${prefix}loss_${stat}`;

    const gain = toNumber(row[gainKey]);
    const loss = toNumber(row[lossKey]);

    if (gain != null && gain !== 0) {
      effects.push({ type: 'stat', stat, delta: gain });
    }
    if (loss != null && loss !== 0) {
      effects.push({ type: 'stat', stat, delta: -loss });
    }
  }

    // Optional time deltas (used by Social choiceA_*/choiceB_* columns)
  const gainTime = toNumber(row[`${prefix}gain_time`]);
  const lossTime = toNumber(row[`${prefix}loss_time`]);

  if (gainTime != null && gainTime !== 0) {
    effects.push({ type: 'time', delta: gainTime });
  }
  if (lossTime != null && lossTime !== 0) {
    effects.push({ type: 'time', delta: -lossTime });
  }


  return effects;
}

function buildChoice(row, prefix) {
  const text =
    row[`${prefix}_text`] ||
    row[`${prefix}Text`] ||
    '';

  const effects = buildStatEffects(row, `${prefix}_`);

  return {
    text: text.trim(),
    effects
  };
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/**
 * Minimal CSV parser that handles quoted fields and commas.
 * Returns an array of rows, each row is an array of strings.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
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
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\r') {
        continue;
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
