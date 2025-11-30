// src/engine/cards.js

/**
 * Load the Home deck from a CSV file and convert rows into
 * the card objects your game already expects:
 *
 * {
 *   id: 'home_001',
 *   name: 'Gift from Grandma',
 *   text: '...',
 *   effects: [ { type: 'stat', stat: 'money', delta: 2 }, ... ]
 * }
 *
 * Expected columns in home_deck.csv (case-sensitive):
 *   id
 *   title
 *   flavor
 *   gain_money, gain_food, gain_inspiration, gain_craft
 *   loss_money, loss_food, loss_inspiration, loss_craft
 *   tags   (optional, "a; b; c")
 */
export async function loadHomeDeckFromCsv(url = './data/cards/home_deck.csv') {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch Home deck CSV from ${url}: ${res.status} ${res.statusText}`
    );
  }

  const csvText = await res.text();
  const rows = parseCsv(csvText);

  if (!rows.length) {
    console.warn('[cards] home_deck.csv is empty or invalid.');
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim());

  const cards = [];

  for (const row of dataRows) {
    // Skip completely empty rows
    const hasContent = row.some((cell) => cell && cell.trim() !== '');
    if (!hasContent) continue;

    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      const value = row[i] ?? '';
      obj[key] = String(value).trim();
    }

    const card = convertHomeRow(obj);
    if (card) cards.push(card);
  }

  return cards;
}

/**
 * Convert a raw CSV row (as a key/value object) into the
 * internal Home card format.
 */
function convertHomeRow(row) {
  const rawId = row.id || row.ID || row.Id;
  if (!rawId) {
    console.warn('[cards] Skipping Home card row without id:', row);
    return null;
  }

  const id = rawId.trim();
  const name =
    (row.title || row.name || row.card_name || id).trim();
  const text =
    (row.flavor || row.text || '').trim();

  const effects = [];

  const stats = ['money', 'food', 'inspiration', 'craft'];

  for (const stat of stats) {
    const gainKey = `gain_${stat}`;
    const lossKey = `loss_${stat}`;

    if (row[gainKey] && row[gainKey].trim() !== '') {
      const n = Number(row[gainKey]);
      if (!Number.isNaN(n) && n !== 0) {
        effects.push({ type: 'stat', stat, delta: n });
      }
    }

    if (row[lossKey] && row[lossKey].trim() !== '') {
      const n = Number(row[lossKey]);
      if (!Number.isNaN(n) && n !== 0) {
        effects.push({ type: 'stat', stat, delta: -n });
      }
    }
  }

  const card = { id, name, text, effects };

  // Optional tags: "zine; indie; print"
  if (row.tags && row.tags.trim() !== '') {
    card.tags = row.tags
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return card;
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
          // Escaped quote ("")
          field += '"';
          i++;
        } else {
          // End quote
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
        // ignore bare CR, handle on \n
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

  // Final field / row if file doesn't end with newline
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
