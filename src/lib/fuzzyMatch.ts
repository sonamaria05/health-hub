/**
 * fuzzyMatch.ts
 * ─────────────
 * Lightweight fuzzy-matching post-processor for extracted medical terms.
 * Algorithm: token-aware Levenshtein ratio (rapidfuzz fuzz.token_set_ratio equivalent).
 * No extra npm dependencies — pure TypeScript.
 *
 * FIX 10: Alias → canonical resolution so corrected keys always match
 * the exact keys used in medicalValidation.ts metricRules.
 */

import type { MedicalRecord } from './mockData';
import drugNamesData from '../data/drug_names.json';
import labTestsData  from '../data/lab_tests.json';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Minimum similarity ratio (0–100) to accept a fuzzy match. */
const MATCH_THRESHOLD = 85;

// ─── Raw dictionary arrays ────────────────────────────────────────────────────

const RAW_DRUG_NAMES: string[] = (drugNamesData as { drugs: string[] }).drugs;
const RAW_LAB_TESTS:  string[] = (labTestsData  as { tests: string[] }).tests;

// ─── Core string-similarity ───────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length > b.length) [a, b] = [b, a];
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    const curr = [j];
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost);
    }
    prev = curr;
  }
  return prev[a.length];
}

function ratio(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 100;
  const d = levenshtein(na, nb);
  const m = Math.max(na.length, nb.length);
  return m === 0 ? 100 : Math.round((1 - d / m) * 100);
}

function tokenSetRatio(a: string, b: string): number {
  const tokA = a.toLowerCase().trim().split(/\W+/).filter(Boolean).sort();
  const tokB = b.toLowerCase().trim().split(/\W+/).filter(Boolean).sort();
  const inter = tokA.filter(t => tokB.includes(t));
  const si = inter.join(' '), sa = tokA.join(' '), sb = tokB.join(' ');
  return Math.max(ratio(si, sa), ratio(si, sb), ratio(sa, sb));
}

// ─── FIX 10: Canonical map builder ───────────────────────────────────────────
// For each flat array entry, determine which canonical name it belongs to.
// Strategy: consecutive terms with similarity ≥ 80 share a canonical (the first one).
// This ensures "Haemoglobin", "Hb", "Hgb" all map → "Hemoglobin" (the medicalValidation key).

function buildCanonicalMap(terms: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let canon = '';
  for (const term of terms) {
    if (!canon) {
      canon = term;
      map.set(term.toLowerCase(), term);
      continue;
    }
    const sim = tokenSetRatio(term, canon);
    if (sim >= 80) {
      map.set(term.toLowerCase(), canon);   // alias → existing canonical
    } else {
      canon = term;                          // start new group
      map.set(term.toLowerCase(), term);
    }
  }
  return map;
}

// Built once at module load
const DRUG_CANONICAL_MAP = buildCanonicalMap(RAW_DRUG_NAMES);
const LAB_CANONICAL_MAP  = buildCanonicalMap(RAW_LAB_TESTS);

// ─── Dictionary lookup ────────────────────────────────────────────────────────

interface MatchResult {
  canonical: string;
  score:     number;
  matched:   boolean;
}

import { canonicalMetricName } from './medicalValidation';

function bestMatch(
  term:         string,
  dictionary:   string[],
  canonicalMap: Map<string, string>
): MatchResult {
  let best: MatchResult = { canonical: term, score: 0, matched: false };

  // Check strict alias match first via medicalValidation
  const exactCanonical = canonicalMetricName(term);
  if (exactCanonical) {
    return { canonical: exactCanonical, score: 100, matched: true };
  }

  for (const entry of dictionary) {
    const score = tokenSetRatio(term, entry);
    if (score > best.score) {
      // resolve the matched alias to its canonical group name
      const resolved = canonicalMetricName(entry) ?? canonicalMap.get(entry.toLowerCase()) ?? entry;
      best = { canonical: resolved, score, matched: score >= MATCH_THRESHOLD };
      if (score === 100) break;
    }
  }

  return best;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface FuzzyMatchSummary {
  corrected: number;
  flagged:   number;
  changes:   Record<string, { canonical: string; score: number }>;
}

/**
 * Run fuzzy-matching post-processing over the extractedData of a MedicalRecord.
 * Corrects extracted term names to the canonical form used in medicalValidation.ts.
 * Flags unmatched terms as needs_review.
 */
export function canonicalizeMedicalTerms(
  record: Partial<MedicalRecord>
): { record: Partial<MedicalRecord>; summary: FuzzyMatchSummary } {
  const type = record.type ?? 'blood_test';

  // Choose dictionaries + canonical maps based on document type
  const pairings: [string[], Map<string, string>][] = [];
  if (type === 'blood_test' || type === 'imaging' || type === 'discharge_summary') {
    pairings.push([RAW_LAB_TESTS, LAB_CANONICAL_MAP]);
  } else if (type === 'prescription') {
    pairings.push([RAW_DRUG_NAMES, DRUG_CANONICAL_MAP]);
  } else if (type === 'bill') {
    pairings.push([RAW_DRUG_NAMES, DRUG_CANONICAL_MAP], [RAW_LAB_TESTS, LAB_CANONICAL_MAP]);
  } else {
    pairings.push([RAW_LAB_TESTS, LAB_CANONICAL_MAP]);
  }

  const rawData = record.extractedData ?? {};
  const newData: typeof rawData = {};
  const summary: FuzzyMatchSummary = { corrected: 0, flagged: 0, changes: {} };

  for (const [origKey, metric] of Object.entries(rawData)) {
    let bestResult: MatchResult = { canonical: origKey, score: 0, matched: false };

    for (const [dict, cmap] of pairings) {
      const result = bestMatch(origKey, dict, cmap);
      if (result.score > bestResult.score) bestResult = result;
      if (bestResult.score === 100) break;
    }

    if (bestResult.matched && bestResult.canonical !== origKey) {
      newData[bestResult.canonical] = { ...metric };
      summary.corrected++;
      summary.changes[origKey] = { canonical: bestResult.canonical, score: bestResult.score };
      console.debug(`[fuzzyMatch] "${origKey}" → "${bestResult.canonical}" (${bestResult.score})`);
    } else if (!bestResult.matched) {
      newData[origKey] = { ...metric, needs_review: true };
      summary.flagged++;
      console.debug(`[fuzzyMatch] "${origKey}" unmatched (${bestResult.score}) → needs_review`);
    } else {
      newData[origKey] = { ...metric };
    }
  }

  return { record: { ...record, extractedData: newData }, summary };
}

/**
 * Convenience: look up a single term against both dictionaries.
 * Useful for testing / debugging.
 */
export function lookupTerm(term: string): MatchResult & { dictionary: 'drug' | 'lab' | 'none' } {
  const drugResult = bestMatch(term, RAW_DRUG_NAMES, DRUG_CANONICAL_MAP);
  const labResult  = bestMatch(term, RAW_LAB_TESTS,  LAB_CANONICAL_MAP);

  if (drugResult.score >= labResult.score && drugResult.matched) {
    return { ...drugResult, dictionary: 'drug' };
  }
  if (labResult.matched) {
    return { ...labResult, dictionary: 'lab' };
  }
  const best = drugResult.score >= labResult.score ? drugResult : labResult;
  return { ...best, matched: false, dictionary: 'none' };
}
