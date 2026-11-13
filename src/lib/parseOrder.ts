// Quick Type: turns what a waiter types ("chai x2 + chapo") into real menu items.
// It is a set of plain rules (no AI), so it works offline and instantly.
// Golden rule: it may ask, but it never silently picks the wrong item.
import type { MenuItem } from "./types";

export interface ParsedLine {
  raw: string; // what the waiter typed for this part, e.g. "chai x2"
  query: string; // the item words only, normalised, e.g. "chai"
  qty: number;
  item: MenuItem | null; // null means "not sure", the waiter must pick
  suggestions: MenuItem[]; // best guesses when item is null (max 3)
}

/** Words the waiter used before, mapped to the menu item they picked. Kept per phone. */
export type Learned = Record<string, string>;

const LEARN_KEY = "pj-learned-words";

export function loadLearned(): Learned {
  try {
    const raw = localStorage.getItem(LEARN_KEY);
    return raw ? (JSON.parse(raw) as Learned) : {};
  } catch {
    return {};
  }
}

export function learnWord(query: string, itemName: string): void {
  try {
    const all = loadLearned();
    all[normalize(query)] = itemName;
    localStorage.setItem(LEARN_KEY, JSON.stringify(all));
  } catch {
    /* storage can be blocked; learning is a nice to have */
  }
}

/** Lower case, letters and digits only, single spaces. "CHIPS (plain)" becomes "chips plain". */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ---------- splitting the text into parts ----------
// Separators: + , ; & new line, and the words "and" / "na". Whole words only.
function splitParts(text: string): string[] {
  return text
    .split(/[+,;&\n]+|\s+(?:and|na)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

const MAX_QTY = 30; // a bare number above this is part of a name (soda 300), not a quantity

/** Pulls the quantity out of one part: "2 chai", "chai x2", "chai(2)", "chai 2". Default 1. */
export function extractQty(part: string): { query: string; qty: number } {
  let s = part.trim();
  let m: RegExpMatchArray | null;

  // "(2)" or "[2]" anywhere, e.g. "chapati(3)"
  if ((m = s.match(/[([]\s*(\d{1,2})\s*[)\]]/))) {
    return { query: normalize(s.replace(m[0], " ")), qty: Number(m[1]) };
  }
  // "x2", "*2" at the end, or "2x", "2 x", "2*" at the start
  if ((m = s.match(/\s*[x*×]\s*(\d{1,2})\s*$/i))) return { query: normalize(s.slice(0, m.index)), qty: Number(m[1]) };
  if ((m = s.match(/^\s*(\d{1,2})\s*[x*×]\s*/i))) return { query: normalize(s.slice(m[0].length)), qty: Number(m[1]) };
  // plain leading number: "2 chai"
  if ((m = s.match(/^\s*(\d{1,2})\s+(?!ml\b|l\b|ltr\b|litre\b)(.+)$/i)) && Number(m[1]) <= MAX_QTY) {
    return { query: normalize(m[2]!), qty: Number(m[1]) };
  }
  // plain trailing number: "chai 2" (but not "soda 300")
  if ((m = s.match(/^(.+?)\s+(\d{1,2})\s*$/)) && Number(m[2]) <= MAX_QTY) {
    return { query: normalize(m[1]!), qty: Number(m[2]) };
  }
  s = normalize(s);
  return { query: s, qty: 1 };
}

// ---------- matching one part to the menu ----------
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

interface Entry {
  item: MenuItem;
  full: string; // whole name, normalised
  loose: string[]; // name without brackets, each "/" part, aliases
  words: string[];
}

function buildIndex(menu: MenuItem[]): Entry[] {
  return menu.map((item) => {
    const full = normalize(item.item_name);
    const noBrackets = normalize(item.item_name.replace(/\(.*?\)/g, " "));
    const slashParts = item.item_name.replace(/\(.*?\)/g, " ").split("/").map(normalize);
    const aliases = (item.aliases ?? "").split(",").map(normalize).filter(Boolean);
    const loose = [...new Set([noBrackets, ...slashParts, ...aliases].filter((k) => k && k !== full))];
    return { item, full, loose, words: full.split(" ") };
  });
}

function unique(items: MenuItem[]): MenuItem[] {
  return [...new Map(items.map((i) => [i.id, i])).values()];
}

function pick(query: string, index: Entry[], learned: Learned): { item: MenuItem | null; suggestions: MenuItem[] } {
  if (!query) return { item: null, suggestions: [] };

  // 0. a word this phone has taught the app before
  const taught = learned[query];
  if (taught) {
    const hit = index.find((e) => e.item.item_name === taught);
    if (hit) return { item: hit.item, suggestions: [] };
  }

  // 1. exact whole name
  const exact = index.filter((e) => e.full === query).map((e) => e.item);
  if (exact.length === 1) return { item: exact[0]!, suggestions: [] };

  // 2. exact nickname, bracket-less name or "/" part (only if it points to ONE item)
  const loose = unique(index.filter((e) => e.loose.includes(query)).map((e) => e.item));
  if (loose.length === 1) return { item: loose[0]!, suggestions: [] };
  if (loose.length > 1) return { item: null, suggestions: loose.slice(0, 3) };

  // 3. every typed word appears in exactly one item name ("white coffee", "kienyeji chicken")
  const qWords = query.split(" ");
  const subset = index.filter((e) => qWords.every((w) => e.words.includes(w)));
  if (subset.length === 1) return { item: subset[0]!.item, suggestions: [] };

  // 4. small typing mistakes: "chapoti", "coffe". Needs ONE clear winner.
  const maxDist = query.length <= 4 ? 0 : query.length <= 7 ? 1 : 2;
  if (maxDist > 0) {
    const scored = index
      .map((e) => ({ e, d: Math.min(...[e.full, ...e.loose].map((k) => levenshtein(query, k))) }))
      .filter((x) => x.d <= maxDist)
      .sort((a, b) => a.d - b.d);
    const best = scored[0];
    if (best && (!scored[1] || scored[1].d > best.d)) return { item: best.e.item, suggestions: [] };
  }

  // 5. not sure: offer the 3 closest (items that contain the typed words first)
  const ranked = index
    .map((e) => {
      const hits = qWords.filter((w) => e.words.some((x) => x.startsWith(w) || w.startsWith(x))).length;
      const d = Math.min(...[e.full, ...e.loose].map((k) => levenshtein(query, k)));
      return { item: e.item, score: hits * 10 - d - e.words.length * 0.1 };
    })
    .filter((x) => x.score > -5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.item);
  return { item: null, suggestions: ranked };
}

/** The main entry point: text in, one ParsedLine per item out. */
export function parseOrder(text: string, menu: MenuItem[], learned: Learned = {}): ParsedLine[] {
  const index = buildIndex(menu);
  return splitParts(text).map((raw) => {
    const { query, qty } = extractQty(raw);
    const { item, suggestions } = pick(query, index, learned);
    return { raw, query, qty: qty > 0 ? qty : 1, item, suggestions };
  });
}

/** Menu search used by the tap mode: matches names and nicknames. */
export function searchMenu(menu: MenuItem[], text: string): MenuItem[] {
  const q = normalize(text);
  if (!q) return menu;
  return menu.filter((i) => normalize(i.item_name).includes(q) || normalize(i.aliases ?? "").split(" ").some((a) => a.startsWith(q)));
}
