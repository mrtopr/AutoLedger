/**
 * Tally-style Multi-Token Fast Search Engine for Automotive Spare Parts & Accounting
 * 
 * Emulates the rapid, delimiter-agnostic, order-independent search of TallyPrime & Tally ERP 9.
 * Handles messy Indian automotive part numbering:
 *   - Punctuation-agnostic (dots, dashes, slashes, commas, brackets: "TVS.CDI" <=> "TVS CDI")
 *   - Any-order multi-token matching ("RTR 160 TVS" matches "TVS.CDI, RTR-160 4V")
 *   - Condensed alphanumeric matching ("RTR160" matches "RTR-160", "SSPL" matches "S-SPL")
 *   - Multi-field inspection (Name, SKU/Part Number, Brand, Vehicle Models, Category)
 *   - In-Stock prioritization & smart relevance scoring
 */

export interface TallySearchable {
  name: string;
  partNumber?: string;
  brand?: string;
  category?: string;
  models?: string[] | string;
  stockQty?: number;
  [key: string]: any;
}

export interface TallySearchResult<T> {
  item: T;
  score: number;
}

/**
 * Normalizes text by removing non-alphanumeric punctuation and lowercasing.
 * "TVS.CDI, RTR-160 (4V)" => "tvs cdi rtr 160 4v"
 */
export function normalizeTallyText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Condensed alphanumeric string with no spaces or symbols.
 * "RTR-160 4V" => "rtr1604v"
 */
export function condenseTallyText(text: string): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts distinct tokens from a search query.
 * "TVS. RTR-160" => ["tvs", "rtr", "160"]
 */
export function extractTallyTokens(query: string): string[] {
  if (!query) return [];
  const normalized = normalizeTallyText(query);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

/**
 * Evaluates whether an item matches the Tally query and calculates its relevance score.
 * A score > 0 means the item is a valid match.
 */
export function scoreTallyItem<T extends TallySearchable>(item: T, query: string): number {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const tokens = extractTallyTokens(trimmed);
  if (tokens.length === 0) return 0;

  const rawName = item.name || '';
  const rawPartNumber = item.partNumber || '';
  const rawBrand = item.brand || '';
  const rawCategory = item.category || '';
  const rawModels = Array.isArray(item.models) 
    ? item.models.join(' ') 
    : (typeof item.models === 'string' ? item.models : '');

  // Combined searchable text
  const combinedRaw = `${rawName} ${rawPartNumber} ${rawBrand} ${rawModels} ${rawCategory}`;
  const normalizedCombined = normalizeTallyText(combinedRaw);
  const condensedCombined = condenseTallyText(combinedRaw);

  const normalizedName = normalizeTallyText(rawName);
  const condensedName = condenseTallyText(rawName);
  const normalizedPartNumber = normalizeTallyText(rawPartNumber);
  const condensedPartNumber = condenseTallyText(rawPartNumber);

  // 1. Strict Token Verification: EVERY query token must match somewhere
  // Either as substring in normalized tokens, or condensed form
  for (const token of tokens) {
    const condensedToken = condenseTallyText(token);
    const inNormalized = normalizedCombined.includes(token);
    const inCondensed = condensedToken && condensedCombined.includes(condensedToken);

    if (!inNormalized && !inCondensed) {
      return 0; // Token failed: does not match
    }
  }

  // 2. Base match score
  let score = 100;

  const rawQueryLower = trimmed.toLowerCase();
  const normalizedQuery = tokens.join(' ');
  const condensedQuery = tokens.join('');

  // Bonus: Exact / Prefix matches on Item Name
  if (normalizedName === normalizedQuery) {
    score += 500; // Perfect match
  } else if (normalizedName.startsWith(normalizedQuery)) {
    score += 350; // Starts with exact query phrase
  } else if (condensedName.startsWith(condensedQuery)) {
    score += 300;
  }

  // Bonus: Exact / Prefix matches on Part Number / SKU
  if (normalizedPartNumber === normalizedQuery || condensedPartNumber === condensedQuery) {
    score += 450;
  } else if (normalizedPartNumber.startsWith(normalizedQuery) || condensedPartNumber.startsWith(condensedQuery)) {
    score += 320;
  }

  // Bonus: First token matches start of item name (Very common in Tally, e.g. "TVS" at start)
  if (tokens.length > 0 && normalizedName.startsWith(tokens[0])) {
    score += 80;
  }

  // Bonus: Tokens appear in the exact specified order in the item name
  let lastIndex = -1;
  let inOrder = true;
  for (const token of tokens) {
    const idx = normalizedName.indexOf(token);
    if (idx !== -1 && idx >= lastIndex) {
      lastIndex = idx + token.length;
    } else {
      inOrder = false;
      break;
    }
  }
  if (inOrder && tokens.length > 1) {
    score += 90;
  }

  // Word boundary bonus: token starts at a word boundary
  const nameWords = normalizedName.split(/\s+/);
  for (const token of tokens) {
    for (const w of nameWords) {
      if (w === token) {
        score += 40; // Exact word match
      } else if (w.startsWith(token)) {
        score += 25; // Word prefix match
      }
    }
  }

  // Brand / Vehicle Model match bonus
  if (rawBrand && tokens.some(t => normalizeTallyText(rawBrand).includes(t))) {
    score += 30;
  }
  if (rawModels && tokens.some(t => normalizeTallyText(rawModels).includes(t))) {
    score += 25;
  }

  // Stock Availability Bonus: Prioritize in-stock items for fast counter billing!
  const stock = typeof item.stockQty === 'number' ? item.stockQty : 0;
  if (stock > 0) {
    score += 60; // Available stock boost
    if (stock > 10) score += 15;
  } else {
    score -= 30; // Out of stock slightly de-prioritized, but still visible if searched!
  }

  return score;
}

/**
 * Filters and sorts items using Tally multi-token matching and relevance scoring.
 */
export function searchTallyItems<T extends TallySearchable>(
  items: T[],
  query: string,
  limit: number = 30
): T[] {
  if (!query || !query.trim()) return [];

  const scored: TallySearchResult<T>[] = [];

  for (const item of items) {
    const score = scoreTallyItem(item, query);
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(res => res.item);
}

/**
 * Break down a string into matched and unmatched segments for highlighting.
 */
export function getHighlightedTallySegments(
  text: string,
  query: string
): Array<{ text: string; isMatch: boolean }> {
  if (!text) return [];
  if (!query || !query.trim()) return [{ text, isMatch: false }];

  const tokens = extractTallyTokens(query);
  if (tokens.length === 0) return [{ text, isMatch: false }];

  // Build regex with all tokens
  const escapedTokens = tokens
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);

  if (escapedTokens.length === 0) return [{ text, isMatch: false }];

  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts
    .filter(Boolean)
    .map(part => {
      const lower = part.toLowerCase();
      const isMatch = tokens.some(t => lower === t);
      return { text: part, isMatch };
    });
}
