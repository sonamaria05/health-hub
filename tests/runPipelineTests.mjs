// ─────────────────────────────────────────────────────────────────────────────
// runPipelineTests.mjs
// Healytics extraction pipeline accuracy test runner (Task 7)
//
// Usage:
//   node tests/runPipelineTests.mjs
//   GEMINI_API_KEY=AIzaSy... node tests/runPipelineTests.mjs
//
// Requires Node ≥ 18 (uses native fetch + fs/promises).
// ─────────────────────────────────────────────────────────────────────────────

import fs   from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const DOCS_DIR  = path.join(__dirname, 'pipeline_samples', 'documents');
const EXP_DIR   = path.join(__dirname, 'pipeline_samples', 'expected');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const FUZZY_THRESHOLD = 85;  // minimum score for a "fuzzy pass"
const VALUE_TOLERANCE = 0.01; // ±1 % for numeric comparisons

// ─── Colour helpers (ANSI) ────────────────────────────────────────────────────
const green  = s => `\x1b[32m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;

// ─── Levenshtein ratio (matches fuzzyMatch.ts logic) ─────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length > b.length) [a, b] = [b, a];
  let prev = [...Array(a.length + 1).keys()];
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

function tokenSetRatio(a, b) {
  const tokA = a.toLowerCase().trim().split(/\W+/).filter(Boolean).sort();
  const tokB = b.toLowerCase().trim().split(/\W+/).filter(Boolean).sort();
  const inter = tokA.filter(t => tokB.includes(t));
  const si = inter.join(' '), sa = tokA.join(' '), sb = tokB.join(' ');
  const r = (x, y) => {
    const d = levenshtein(x, y);
    const m = Math.max(x.length, y.length);
    return m === 0 ? 100 : Math.round((1 - d / m) * 100);
  };
  return Math.max(r(si, sa), r(si, sb), r(sa, sb));
}

// ─── Comparison helpers ───────────────────────────────────────────────────────
function numericMatch(got, expected) {
  const g = parseFloat(String(got));
  const e = parseFloat(String(expected));
  if (isNaN(g) || isNaN(e)) return false;
  return Math.abs(g - e) / (Math.abs(e) || 1) <= VALUE_TOLERANCE;
}

function stringExact(got, expected) {
  return String(got).toLowerCase().trim() === String(expected).toLowerCase().trim();
}

function stringFuzzy(got, expected) {
  return tokenSetRatio(String(got), String(expected));
}

// ─── Scaffold directory ───────────────────────────────────────────────────────
async function scaffold() {
  await fs.mkdir(DOCS_DIR, { recursive: true });
  await fs.mkdir(EXP_DIR,  { recursive: true });
}

// ─── Load supported document files ───────────────────────────────────────────
async function loadDocuments() {
  const files = await fs.readdir(DOCS_DIR).catch(() => []);
  return files.filter(f => /\.(pdf|png|jpe?g|webp)$/i.test(f));
}

// ─── Call the Gemini-based extraction (simplified direct call for testing) ───
async function callGeminiExtract(base64, mimeType, docType = 'lab_report') {
  if (!GEMINI_API_KEY) return null;

  const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  const prompt = `You are a medical document extractor. Extract all fields from this ${docType} image.
Return pure JSON — no markdown — matching this structure:
{
  "type": "blood_test|prescription|bill|imaging|discharge_summary",
  "title": "...", "date": "YYYY-MM-DD", "doctor": "...", "hospital": "...", "patientName": "...",
  "summary": "...",
  "extractedData": {
    "<field name>": { "value": <number>, "unit": "...", "normalRange": "...", "status": "normal|high|low", "confidence": 0.9 }
  }
}`;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64 } }
          ]}],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      });
      if (res.ok) {
        const j = await res.json();
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text) {
          const cleaned = text.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim();
          return JSON.parse(cleaned);
        }
      }
    } catch { /* try next model */ }
  }
  return null;
}

// ─── Score a single document ──────────────────────────────────────────────────
async function scoreDocument(docFile) {
  const base   = path.basename(docFile, path.extname(docFile));
  const expFile = path.join(EXP_DIR, `${base}.json`);

  if (!existsSync(expFile)) {
    console.log(yellow(`  ⚠  No expected file for ${docFile} — skipping`));
    return null;
  }

  const expected = JSON.parse(await fs.readFile(expFile, 'utf8'));
  const docPath  = path.join(DOCS_DIR, docFile);
  const rawBytes = await fs.readFile(docPath);
  const base64   = rawBytes.toString('base64');
  const mimeType = docFile.endsWith('.pdf') ? 'application/pdf'
    : docFile.match(/\.jpe?g$/i) ? 'image/jpeg'
    : docFile.match(/\.png$/i)   ? 'image/png'
    : 'image/webp';

  // Attempt AI extraction
  let extracted = await callGeminiExtract(base64, mimeType, expected.type ?? 'lab_report');

  if (!extracted) {
    console.log(yellow(`  ℹ  No Gemini key or extraction failed for ${docFile}. Skipping AI checks.`));
    return null;
  }

  // ── Score top-level fields ──
  const TOP_FIELDS = ['type', 'title', 'date', 'doctor', 'hospital', 'patientName'];
  const fieldResults = [];

  for (const field of TOP_FIELDS) {
    if (!(field in expected) || expected[field] == null) continue;
    const got = extracted[field];
    const exp = expected[field];

    if (got == null) {
      fieldResults.push({ field, result: 'miss', got: null, expected: exp, score: 0 });
      continue;
    }
    if (stringExact(got, exp)) {
      fieldResults.push({ field, result: 'exact', got, expected: exp, score: 100 });
    } else {
      const score = stringFuzzy(String(got), String(exp));
      fieldResults.push({ field, result: score >= FUZZY_THRESHOLD ? 'fuzzy' : 'miss', got, expected: exp, score });
    }
  }

  // ── Score extractedData ──
  const dataResults = [];
  const expData = expected.extractedData ?? {};
  const gotData = extracted.extractedData ?? {};

  for (const [expKey, expMetric] of Object.entries(expData)) {
    // Find best-matching key in extracted output
    let bestKey = null, bestScore = 0;
    for (const gotKey of Object.keys(gotData)) {
      const s = tokenSetRatio(expKey, gotKey);
      if (s > bestScore) { bestScore = s; bestKey = gotKey; }
    }

    const keyMatched = bestScore >= FUZZY_THRESHOLD;
    const gotMetric  = keyMatched ? gotData[bestKey] : null;

    const valMatch   = gotMetric && numericMatch(gotMetric.value, expMetric.value);
    const unitMatch  = gotMetric && expMetric.unit  ? stringFuzzy(gotMetric.unit,   expMetric.unit)   >= FUZZY_THRESHOLD : true;
    const statMatch  = gotMetric && expMetric.status ? stringExact(gotMetric.status, expMetric.status) : true;

    dataResults.push({
      expKey,
      gotKey: bestKey,
      keyScore: bestScore,
      keyMatched,
      valMatch,
      unitMatch,
      statMatch,
      expVal:  expMetric.value,
      gotVal:  gotMetric?.value ?? null,
    });
  }

  return { docFile, fieldResults, dataResults };
}

// ─── Print results ─────────────────────────────────────────────────────────────
function printResults(result) {
  const { docFile, fieldResults, dataResults } = result;
  console.log(bold(`\n📄 ${docFile}`));

  // Top-level fields
  for (const r of fieldResults) {
    const icon = r.result === 'exact' ? green('exact ✓')
               : r.result === 'fuzzy' ? yellow(`fuzzy ✓ (${r.score})`)
               : red('MISS  ✗');
    console.log(`   ${r.field.padEnd(14)} ${icon}   got: ${JSON.stringify(r.got)}  expected: ${JSON.stringify(r.expected)}`);
  }

  // Extracted data
  if (dataResults.length) {
    console.log('   --- extractedData ---');
    for (const r of dataResults) {
      const keyIcon = r.keyMatched ? green(`key ✓ (${r.keyScore})`) : red('key ✗');
      const valIcon = r.valMatch   ? green('val ✓') : red(`val ✗ (got ${r.gotVal} exp ${r.expVal})`);
      const unitIcon = r.unitMatch  ? '' : yellow(' unit?');
      const statIcon = r.statMatch  ? '' : yellow(' status?');
      console.log(`   ${r.expKey.padEnd(20)} ${keyIcon}  ${valIcon}${unitIcon}${statIcon}`);
    }
  }
}

// ─── Aggregate summary ─────────────────────────────────────────────────────────
function printSummary(results) {
  const valid = results.filter(Boolean);
  if (!valid.length) {
    console.log(yellow('\nNo scoreable results. Add documents + expected JSON files to tests/pipeline_samples/'));
    return;
  }

  let totalFields = 0, exactFields = 0, fuzzyFields = 0;
  let totalKeys = 0, matchedKeys = 0, matchedVals = 0, fullPasses = 0;

  for (const r of valid) {
    for (const f of r.fieldResults) {
      totalFields++;
      if (f.result === 'exact') exactFields++;
      if (f.result === 'fuzzy' || f.result === 'exact') fuzzyFields++;
    }
    let docPass = true;
    for (const d of r.dataResults) {
      totalKeys++;
      if (d.keyMatched) matchedKeys++;
      if (d.keyMatched && d.valMatch) matchedVals++;
      else docPass = false;
    }
    if (r.fieldResults.every(f => f.result !== 'miss') && docPass) fullPasses++;
  }

  const pct = (n, d) => d === 0 ? 'N/A' : `${Math.round(n / d * 100)} %`;

  console.log(bold('\n══════════════════ SUMMARY ══════════════════'));
  console.log(`  Documents tested              : ${valid.length}`);
  console.log(`  Top-level exact match         : ${pct(exactFields,  totalFields)}  (${exactFields}/${totalFields})`);
  console.log(`  Top-level fuzzy match ≥${FUZZY_THRESHOLD}    : ${pct(fuzzyFields, totalFields)}  (${fuzzyFields}/${totalFields})`);
  console.log(`  extractedData key match ≥${FUZZY_THRESHOLD}  : ${pct(matchedKeys, totalKeys)}  (${matchedKeys}/${totalKeys})`);
  console.log(`  extractedData value match     : ${pct(matchedVals, totalKeys)}  (${matchedVals}/${totalKeys})`);
  console.log(`  Documents fully passing       : ${fullPasses} / ${valid.length}`);
  console.log('═════════════════════════════════════════════\n');
}

// ─── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  console.log(bold('\n🔬 Healytics Pipeline Test Runner'));
  console.log(`   GEMINI_API_KEY : ${GEMINI_API_KEY ? green('provided') : yellow('not set — AI path disabled')}`);
  console.log(`   Documents dir  : ${DOCS_DIR}`);
  console.log(`   Expected dir   : ${EXP_DIR}\n`);

  await scaffold();

  const docs = await loadDocuments();
  if (!docs.length) {
    console.log(yellow('No documents found in tests/pipeline_samples/documents/'));
    console.log('Read tests/README.md for instructions on adding test cases.\n');
    return;
  }

  console.log(`Found ${docs.length} document(s): ${docs.join(', ')}\n`);

  const results = [];
  for (const doc of docs) {
    try {
      const r = await scoreDocument(doc);
      results.push(r);
      if (r) printResults(r);
    } catch (err) {
      console.error(red(`  ERROR processing ${doc}: ${err.message}`));
      results.push(null);
    }
  }

  printSummary(results);
}

main().catch(err => { console.error(red(`Fatal: ${err.message}`)); process.exit(1); });
