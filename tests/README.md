# Healytics Pipeline Test Harness

This folder contains the accuracy testing framework for the Healytics document extraction pipeline.

---

## Directory Layout

```
tests/
├── pipeline_samples/
│   ├── documents/          ← Drop your sample files here (PDF, PNG, JPEG, WEBP)
│   │   ├── lab_report_001.pdf
│   │   ├── prescription_001.jpg
│   │   ├── pharmacy_bill_001.png
│   │   └── ...
│   └── expected/           ← Hand-labelled expected JSON outputs (one per document)
│       ├── lab_report_001.json
│       ├── prescription_001.json
│       ├── pharmacy_bill_001.json
│       └── ...
└── README.md               ← This file
```

---

## How to Add a Test Case

1. **Drop** your sample document into `tests/pipeline_samples/documents/`
   - Accepted formats: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`
   - Name the file descriptively: `<doc_type>_<number>.<ext>`, e.g. `lab_report_003.pdf`

2. **Create** a matching expected JSON file in `tests/pipeline_samples/expected/` with the **same base name**:
   ```
   lab_report_003.json
   ```

3. **The expected JSON** must follow the `MedicalRecord` shape. Include only fields you want evaluated. Fields absent from the expected JSON are skipped during scoring:

```jsonc
{
  "type": "blood_test",
  "title": "Complete Blood Count (CBC)",
  "date": "2026-08-05",
  "doctor": "Dr. Rajesh Kumar",
  "hospital": "Koppa Diagnostic Centre",
  "patientName": "Sonam Sharma",
  "extractedData": {
    "Hemoglobin": { "value": 12.5, "unit": "g/dL", "status": "normal" },
    "WBC":        { "value": 10300, "unit": "cells/cumm", "status": "normal" },
    "Platelets":  { "value": 2.83, "unit": "Lakhs/cumm", "status": "normal" }
  }
}
```

> **Tip:** You do NOT need to include `id`, `fileName`, `processingStatus`, `confidence`, or `needs_review` in the expected file — those are ignored by the scorer.

---

## Running the Tests

### Prerequisites

Make sure the dev server is running OR use the offline local extractor.  
The test runner calls the **local extraction engine** directly (no network required).

```bash
# From the project root (health-hub-main/)
node tests/runPipelineTests.mjs
```

Or with a Gemini API key to also test the AI path:

```bash
GEMINI_API_KEY=AIzaSy... node tests/runPipelineTests.mjs
```

---

## What the Test Runner Reports

For each document it prints:

```
✓ lab_report_001.pdf
  title       exact ✓   "Complete Blood Count (CBC)"
  date        exact ✓   "2026-08-05"
  doctor      fuzzy ✓   "Dr. Rajesh Kumar" (score 91)
  Hemoglobin  exact ✓   value=12.5  unit=g/dL  status=normal
  WBC         fuzzy ✓   value=10300 unit=cells/cumm (score 94)
  Platelets   MISS  ✗   expected=2.83 got=null
```

**Summary table:**

| Metric | Value |
|--------|-------|
| Documents tested | 5 |
| Top-level field exact match | 87 % |
| extractedData value exact match | 76 % |
| extractedData key fuzzy match ≥ 85 | 91 % |
| Documents fully passing | 3 / 5 |

---

## Scoring Rules

| Score Type | How it works |
|------------|-------------|
| **Exact match** | Extracted value === expected value (strings lowercased & trimmed; numbers within ±1 % tolerance) |
| **Fuzzy match** | String similarity ≥ 85 using the same token-set Levenshtein ratio as `fuzzyMatch.ts` |
| **Miss** | Field absent or null in extracted output when expected has a non-null value |

---

## Limitations & Tips

- The local OCR path (Tesseract) runs in Node via `tesseract.js` — accuracy will be lower than the Gemini path.
- For best results, provide your Gemini key when running so both classification and extraction are tested end-to-end.
- Add **at least 5 documents per document type** (prescription, lab report, pharmacy bill, hospital bill) for representative accuracy numbers.
- Once you have 20+ samples, look at the "Miss" rows to identify which fields are systematically wrong and adjust the Gemini prompts in `geminiVisionExtraction.ts` accordingly.
