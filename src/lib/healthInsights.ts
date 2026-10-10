import { MedicalRecord, PredictionResult } from './mockData';

export interface MetricDefinition {
  key: string;
  label: string;
  color: string;
  normalMin: number;
  normalMax: number;
}

// ─── Chart Metric Definitions ─────────────────────────────────────────────────
// Reference ranges: WHO, ADA, AHA, ICMR guidelines.
// All ranges are for adults. Sex-differentiated ranges noted in comments.

export const baseMetrics: MetricDefinition[] = [
  // Hb: WHO — female 12–16, male 13–17. Display unisex lower bound 12.
  { key: 'hemoglobin',    label: 'Hemoglobin (g/dL)',           color: '#0d9488', normalMin: 12,   normalMax: 17   },
  // WBC: standard adult 4000–11000 cells/cumm
  { key: 'wbc',           label: 'Total WBC (cells/cumm)',       color: '#6366f1', normalMin: 4000, normalMax: 11000 },
  // Platelets: 1.5–4.0 Lakhs/cumm (Indian lab units)
  { key: 'platelets',     label: 'Platelet Count (Lakhs/cumm)', color: '#ec4899', normalMin: 1.5,  normalMax: 4.0  },
  // RBC: female 3.8–5.2, male 4.5–5.9. Display unisex range 3.8–5.9.
  { key: 'rbc',           label: 'RBC Count (mill/cumm)',        color: '#f43f5e', normalMin: 3.8,  normalMax: 5.9  },
  // Neutrophils: 40–70% of differential (ADA/ICMR)
  { key: 'neutrophils',   label: 'Neutrophils (%)',              color: '#eab308', normalMin: 40,   normalMax: 70   },
  // Lymphocytes: 20–40% of differential
  { key: 'lymphocytes',   label: 'Lymphocytes (%)',              color: '#06b6d4', normalMin: 20,   normalMax: 40   },
  // PCV: female 36–46%, male 40–54%. Display broader range 36–54.
  { key: 'pcv',           label: 'PCV / Hematocrit (%)',         color: '#84cc16', normalMin: 36,   normalMax: 54   },
  // MCV: 80–100 fl (microcytic <80, macrocytic >100)
  { key: 'mcv',           label: 'MCV (fl)',                     color: '#a855f7', normalMin: 80,   normalMax: 100  },
  // Fasting glucose: ADA normal 70–99 mg/dL
  { key: 'glucose',       label: 'Fasting Glucose (mg/dL)',      color: '#3b82f6', normalMin: 70,   normalMax: 99   },
  // Total cholesterol: AHA desirable < 200 mg/dL
  { key: 'cholesterol',   label: 'Total Cholesterol (mg/dL)',    color: '#f59e0b', normalMin: 0,    normalMax: 200  },
  // Creatinine: female 0.5–1.0, male 0.7–1.2. Display 0.5–1.2.
  { key: 'creatinine',    label: 'Creatinine (mg/dL)',           color: '#8b5cf6', normalMin: 0.5,  normalMax: 1.2  },
  // HbA1c: ADA normal < 5.7%, pre-diabetes 5.7–6.4%, diabetes ≥ 6.5%
  { key: 'hba1c',         label: 'HbA1c (%)',                    color: '#ef4444', normalMin: 4.0,  normalMax: 5.6  },
  // LDL: AHA optimal < 100 mg/dL, near-optimal 100–129
  { key: 'ldl',           label: 'LDL Cholesterol (mg/dL)',      color: '#f97316', normalMin: 0,    normalMax: 100  },
  // Triglycerides: AHA normal < 150 mg/dL
  { key: 'triglycerides', label: 'Triglycerides (mg/dL)',        color: '#14b8a6', normalMin: 0,    normalMax: 150  },
  // TSH: AACE reference 0.45–4.5 mIU/L (some labs use 0.4–4.0)
  { key: 'tsh',           label: 'TSH (mIU/L)',                  color: '#10b981', normalMin: 0.45, normalMax: 4.5  },
  // Vitamin D: Endocrine Society — sufficient ≥ 30 ng/mL, optimal 40–60
  { key: 'vitamin_d',     label: 'Vitamin D (ng/mL)',            color: '#fbbf24', normalMin: 30,   normalMax: 100  },
  // MCH: 27–32 pg
  { key: 'mch',           label: 'MCH (pg)',                     color: '#64748b', normalMin: 27,   normalMax: 32   },
  // MCHC: 32–36 g/dL
  { key: 'mchc',          label: 'MCHC (g/dL)',                  color: '#94a3b8', normalMin: 32,   normalMax: 36   },
];

const metricAliases: Record<string, string[]> = {
  hemoglobin:   ['hemoglobin', 'hb', 'haemoglobin', 'hb%'],
  wbc:          ['total w.b.c', 'total wbc', 'w.b.c', 'wbc', 'white blood cells', 'total leukocyte count', 'leucocyte count'],
  platelets:    ['platelet count', 'total platelet count', 'platelets', 'plt'],
  rbc:          ['total r.b.c', 'total rbc', 'r.b.c', 'rbc', 'red blood cells', 'red cell count'],
  neutrophils:  ['neutrophils', 'neutrophil', 'polymorphs', 'segmented neutrophils'],
  lymphocytes:  ['lymphocytes', 'lymphocyte', 'lymphs'],
  pcv:          ['p.c.v', 'p.cv', 'pcv', 'packed cell volume', 'hematocrit', 'haematocrit'],
  mcv:          ['m.c.v', 'm.cv', 'mcv', 'mean corpuscular volume'],
  mch:          ['m.c.h', 'm.ch', 'mch', 'mean corpuscular hemoglobin'],
  mchc:         ['m.c.h.c', 'm.ch.c', 'mchc', 'mean corpuscular hemoglobin concentration'],
  glucose:      ['fasting glucose', 'glucose', 'blood glucose', 'fasting blood sugar', 'fbs', 'sugar', 'fasting blood glucose'],
  cholesterol:  ['total cholesterol', 'cholesterol', 'serum cholesterol', 'tc'],
  creatinine:   ['creatinine', 'serum creatinine', 's. creatinine'],
  hba1c:        ['hba1c', 'hb a1c', 'a1c', 'glycated hemoglobin', 'glycosylated hemoglobin'],
  ldl:          ['ldl cholesterol', 'ldl', 'serum ldl', 'ldl-c', 'low-density lipoprotein'],
  hdl:          ['hdl cholesterol', 'hdl', 'hdl-c', 'high-density lipoprotein'],
  triglycerides:['triglycerides', 'triglyceride', 'tg', 'serum triglycerides'],
  tsh:          ['tsh', 'thyroid stimulating hormone', 's. tsh'],
  vitamin_d:    ['vitamin d', '25-oh vitamin d', '25 hydroxy vitamin d', 'vitamin d3', '25 oh vitamin d'],
  urea:         ['urea', 'blood urea', 'bun', 'blood urea nitrogen', 'serum urea'],
  uric_acid:    ['uric acid', 'serum uric acid'],
  sgpt:         ['sgpt', 'alt', 'alanine aminotransferase'],
  sgot:         ['sgot', 'ast', 'aspartate aminotransferase'],
  bilirubin:    ['total bilirubin', 'bilirubin', 'serum bilirubin', 's. bilirubin'],
};

function mapMetricKey(rawKey: string): string | undefined {
  const normalized = rawKey.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(metricAliases)) {
    if (aliases.some(alias => normalized === alias || normalized.includes(alias))) {
      return key;
    }
  }
  return undefined;
}

function getLatestRecordWithExtractedData(records: MedicalRecord[]) {
  return [...records]
    .filter(record => record.extractedData && Object.keys(record.extractedData).length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

export function buildChartData(records: MedicalRecord[]) {
  return records
    .filter(record => record.extractedData && record.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(record => {
      const point: Record<string, string | number> = {
        date: new Date(record.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };

      for (const [key, value] of Object.entries(record.extractedData ?? {})) {
        const mappedKey = mapMetricKey(key);
        if (mappedKey && value?.value != null) {
          point[mappedKey] = value.value;
        }
      }

      return point;
    })
    .filter(point => Object.keys(point).length > 1);
}

export function collectLatestParameters(records: MedicalRecord[]) {
  const latestByParameter: NonNullable<MedicalRecord['extractedData']> = {};
  const sortedRecords = [...records]
    .filter(record => record.extractedData && Object.keys(record.extractedData).length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const record of sortedRecords) {
    for (const [key, value] of Object.entries(record.extractedData ?? {})) {
      if (!latestByParameter[key]) {
        latestByParameter[key] = value;
      }
    }
  }

  return latestByParameter;
}

// ─── Clinical Insight Rules ───────────────────────────────────────────────────
// Sources: WHO, ADA 2024, AHA/ACC 2019, AACE, ICMR Indian guidelines.
// These are SCREENING indicators, not diagnoses. Always recommend clinical review.

export function generateHealthInsights(records: MedicalRecord[]): PredictionResult[] {
  const result: PredictionResult[] = [];
  const latest = getLatestRecordWithExtractedData(records);
  if (!latest || !latest.extractedData) return result;
  const p = latest.extractedData;

  // ─── 1. Anemia & Red Cell Health ─────────────────────────────────────────
  // WHO criteria: Hb < 12 g/dL female, < 13 g/dL male.
  // Since sex is unknown, use < 12 as definite anemia, 12–13 as possible (male) anemia.
  // Mild: 10–11.9, Moderate: 8–9.9, Severe: < 8 g/dL (WHO 2011).
  const hb  = p.Hemoglobin ?? p.Hb;
  const pcv = p.PCV;
  const mcv = p.MCV;
  const mch = p.MCH;
  if (hb || pcv) {
    const hbVal  = hb?.value  ?? 13;
    const pcvVal = pcv?.value ?? 40;

    // Severity classification (WHO 2011)
    const severeAnemia   = hbVal < 8.0;
    const moderateAnemia = hbVal < 10.0 && !severeAnemia;
    const mildAnemia     = hbVal < 12.0 && !moderateAnemia && !severeAnemia;
    const possibleMaleAnemia = hbVal >= 12.0 && hbVal < 13.0; // possible in males

    // Morphology hints from MCV (microcytic <80, normocytic 80–100, macrocytic >100)
    const isMicrocytic  = mcv && mcv.value < 80;
    const isMacrocytic  = mcv && mcv.value > 100;
    const isHypochromic = mch && mch.value < 27;

    let morphologyHint = '';
    if (isMicrocytic && isHypochromic) morphologyHint = 'Microcytic hypochromic pattern — likely iron deficiency or thalassemia trait.';
    else if (isMicrocytic)             morphologyHint = 'Microcytic pattern — consider iron deficiency or chronic disease.';
    else if (isMacrocytic)             morphologyHint = 'Macrocytic pattern — consider B12/folate deficiency.';

    const risk: PredictionResult['risk'] =
      severeAnemia   ? 'high' :
      moderateAnemia ? 'high' :
      mildAnemia     ? 'moderate' :
                       'low';

    const factors: string[] = [];
    if (hb)  factors.push(`Hemoglobin: ${hb.value} ${hb.unit} (${hb.status}) — Normal: female ≥12, male ≥13 g/dL`);
    if (pcv) factors.push(`PCV/Hematocrit: ${pcvVal}% (Normal: female 36–46%, male 40–54%)`);
    if (mcv) factors.push(`MCV: ${mcv.value} fl (Normal: 80–100 fl)`);
    if (mch) factors.push(`MCH: ${mch.value} pg (Normal: 27–32 pg)`);
    if (morphologyHint) factors.push(morphologyHint);
    if (possibleMaleAnemia && !mildAnemia) factors.push('Hemoglobin 12–13 g/dL may indicate anemia in males (WHO male cutoff: 13 g/dL).');

    const prob = severeAnemia ? 90 : moderateAnemia ? 78 : mildAnemia ? 62 : possibleMaleAnemia ? 35 : 10;

    result.push({
      condition: 'Anemia & Red Cell Health',
      risk,
      probability: prob,
      factors,
      recommendation:
        severeAnemia   ? 'Severe anemia (Hb < 8 g/dL). Urgent clinical assessment required. Do not delay physician review.' :
        moderateAnemia ? 'Moderate anemia detected. Investigate cause (iron, B12, folate, chronic disease). Physician follow-up essential.' :
        mildAnemia     ? 'Mild anemia detected. Investigate nutritional deficiencies (iron, folate, B12). Repeat CBC in 4–6 weeks.' :
        possibleMaleAnemia ? 'Hemoglobin near male lower limit. If male, consider iron studies. Repeat in 4–6 weeks.' :
                         'Red blood cell parameters are within healthy reference ranges.',
    });
  }

  // ─── 2. White Blood Cell & Immune Marker ─────────────────────────────────
  // Normal WBC: 4,000–11,000 cells/cumm (adults, ICMR/WHO).
  // Neutrophilia > 70% or WBC > 11,000: suspect bacterial infection, stress.
  // Lymphocytosis > 40%: suspect viral infection, CLL.
  // Leukocytosis > 11,000: infection, inflammation, rarely malignancy.
  // Leukopenia < 4,000: viral illness, drug effect, aplastic anaemia.
  const wbc   = p.WBC ?? p['Total WBC'];
  const neut  = p.Neutrophils;
  const lymph = p.Lymphocytes;
  const eos   = p.Eosinophils;
  if (wbc || neut || lymph) {
    const wbcVal  = wbc?.value  ?? 7000;
    const neutVal = neut?.value ?? 60;
    const lymphVal= lymph?.value ?? 30;

    const leukocytosis  = wbcVal > 11000;
    const leukopenia    = wbcVal < 4000;
    const neutrophilia  = neutVal > 70;
    const lymphocytosis = lymphVal > 40;
    const eosinophilia  = eos && eos.value > 6;   // >6% of differential = significant

    const factors: string[] = [];
    if (wbc)  factors.push(`Total WBC: ${wbc.value} ${wbc.unit} (Normal: 4,000–11,000 cells/cumm)`);
    if (neut) factors.push(`Neutrophils: ${neut.value}% (Normal: 40–70%)`);
    if (lymph)factors.push(`Lymphocytes: ${lymph.value}% (Normal: 20–40%)`);
    if (eos && eos.value > 3) factors.push(`Eosinophils: ${eos.value}% — consider allergy/parasitic cause if > 6%`);

    const risk: PredictionResult['risk'] =
      leukopenia                        ? 'high'     :   // suppression is more serious
      (leukocytosis && neutrophilia)    ? 'moderate' :
      neutrophilia || leukocytosis      ? 'moderate' :
      lymphocytosis                     ? 'moderate' :
                                          'low';

    result.push({
      condition: 'Immune & Infection Marker',
      risk,
      probability:
        leukopenia ? 72 : (leukocytosis && neutrophilia) ? 62 :
        neutrophilia ? 48 : lymphocytosis ? 40 : eosinophilia ? 38 : 10,
      factors,
      recommendation:
        leukopenia      ? 'Low WBC (leukopenia) detected. Possible viral illness, medication effect, or bone marrow issue. Physician review recommended.' :
        leukocytosis && neutrophilia
                        ? 'Elevated WBC with neutrophilia — common with bacterial infection or acute inflammation. Clinical correlation needed.' :
        neutrophilia    ? 'Mild neutrophilia noted — often stress, early infection, or steroid use. Repeat CBC if symptomatic.' :
        lymphocytosis   ? 'Relative lymphocytosis — commonly viral in origin (e.g. dengue, EBV). Clinical assessment advised.' :
        eosinophilia    ? 'Eosinophils elevated — consider allergic condition or parasitic infection.' :
                          'White blood cell differential is balanced with no active inflammatory signs.',
    });
  }

  // ─── 3. Platelet & Clotting ───────────────────────────────────────────────
  // Indian labs report in Lakhs/cumm: normal 1.5–4.0 Lakhs/cumm.
  // Some labs still report as 10^3/µL (150,000–400,000). Detect unit.
  const plt = p.Platelets ?? p['Platelet Count'];
  if (plt) {
    let pltVal = plt.value;
    const isLakhsUnit = plt.unit?.toLowerCase().includes('lakh') ||
                        plt.unit?.toLowerCase().includes('cumm') ||
                        pltVal < 100;

    // Normalise: if in 10^3/µL (e.g. 250 meaning 250,000), convert to Lakhs
    if (!isLakhsUnit && pltVal > 100) pltVal = pltVal / 100;

    const thrombocytopenia = pltVal < 1.5;        // < 1.5 Lakhs = thrombocytopenic
    const severe           = pltVal < 0.5;        // < 50,000 = bleeding risk
    const thrombocytosis   = pltVal > 4.0;        // > 4.0 Lakhs = reactive/essential

    const risk: PredictionResult['risk'] =
      severe           ? 'high'     :
      thrombocytopenia ? 'moderate' :
      thrombocytosis   ? 'moderate' :
                         'low';

    result.push({
      condition: 'Platelet & Clotting Profile',
      risk,
      probability: severe ? 82 : thrombocytopenia ? 60 : thrombocytosis ? 35 : 10,
      factors: [
        `Platelet Count: ${plt.value} ${plt.unit} (Normal: 1.5–4.0 Lakhs/cumm)`,
        thrombocytopenia ? 'Thrombocytopenia detected — possible dengue, ITP, medication effect, or bone marrow issue.' : '',
        thrombocytosis   ? 'Thrombocytosis — often reactive (infection, inflammation, iron deficiency). Rule out essential thrombocythaemia.' : '',
      ].filter(Boolean),
      recommendation:
        severe           ? 'Critically low platelets (< 50,000). Significant bleeding risk. Urgent physician evaluation required.' :
        thrombocytopenia ? 'Low platelet count. Avoid NSAIDs/aspirin. Report any unusual bruising or bleeding to your doctor.' :
        thrombocytosis   ? 'Elevated platelet count. Usually reactive and temporary. Physician follow-up if persistent.' :
                           'Platelet levels are optimal for healthy clotting and vascular function.',
    });
  }

  // ─── 4. Cardiovascular Risk ───────────────────────────────────────────────
  // AHA/ACC 2019 Cholesterol Guidelines:
  //   Desirable TC  < 200 mg/dL | Borderline 200–239 | High ≥ 240
  //   Optimal LDL   < 100       | Near-optimal 100–129 | Borderline 130–159 | High ≥ 160
  //   Normal TG     < 150       | Borderline 150–199   | High 200–499 | Very high ≥ 500
  //   Low HDL       < 40 (male) / < 50 (female) — treated as < 40 unisex conservative
  const chol = p['Total Cholesterol'] ?? p.Cholesterol;
  const ldl  = p['LDL Cholesterol']  ?? p.LDL;
  const hdl  = p['HDL Cholesterol']  ?? p.HDL;
  const trig = p.Triglycerides;
  if (chol || ldl || trig || hdl) {
    const factors: string[] = [];
    let riskScore = 0;

    if (chol) {
      factors.push(`Total Cholesterol: ${chol.value} mg/dL (Desirable: <200, Borderline: 200–239, High: ≥240)`);
      if (chol.value >= 240) riskScore += 30;
      else if (chol.value >= 200) riskScore += 15;
    }
    if (ldl) {
      factors.push(`LDL: ${ldl.value} mg/dL (Optimal: <100, Near-optimal: 100–129, Borderline: 130–159, High: ≥160)`);
      if (ldl.value >= 160) riskScore += 35;
      else if (ldl.value >= 130) riskScore += 20;
      else if (ldl.value >= 100) riskScore += 10;
    }
    if (hdl) {
      factors.push(`HDL: ${hdl.value} mg/dL (Protective: ≥60 mg/dL, Low risk: <40 mg/dL)`);
      if (hdl.value < 40) riskScore += 20;          // low HDL is a risk factor
      else if (hdl.value >= 60) riskScore -= 10;    // high HDL is protective
    }
    if (trig) {
      factors.push(`Triglycerides: ${trig.value} mg/dL (Normal: <150, Borderline: 150–199, High: 200–499, Very high: ≥500)`);
      if (trig.value >= 500)      riskScore += 40;
      else if (trig.value >= 200) riskScore += 20;
      else if (trig.value >= 150) riskScore += 10;
    }
    if (factors.length === 0) factors.push('Lipid values are within normal range.');

    const risk: PredictionResult['risk'] =
      riskScore >= 50 ? 'high' : riskScore >= 20 ? 'moderate' : 'low';

    result.push({
      condition: 'Cardiovascular & Lipid Risk',
      risk,
      probability: Math.min(Math.max(riskScore + 5, 5), 88),
      factors,
      recommendation:
        riskScore >= 50 ? 'High cardiovascular risk based on lipid profile. Physician review essential. Discuss statin therapy eligibility.' :
        riskScore >= 20 ? 'Borderline lipid values detected. Prioritise dietary changes (reduce saturated fat, increase fibre). Recheck in 3 months.' :
                          'Lipid panel is in favorable ranges for cardiovascular health.',
    });
  }

  // ─── 5. Glycaemic Regulation ──────────────────────────────────────────────
  // ADA 2024 Standards of Care:
  //   Fasting glucose:  Normal 70–99 | Pre-diabetes 100–125 | Diabetes ≥ 126 mg/dL
  //   HbA1c:            Normal < 5.7% | Pre-diabetes 5.7–6.4% | Diabetes ≥ 6.5%
  const glucose = p['Fasting Glucose'] ?? p.Glucose;
  const hba1c   = p.HbA1c;
  if (glucose || hba1c) {
    const factors: string[] = [];
    const glucoseVal = glucose?.value;
    const hba1cVal   = hba1c?.value;

    // Stage classification (ADA 2024)
    const isDiabetesGlucose    = glucoseVal != null && glucoseVal >= 126;
    const isPreDiabetesGlucose = glucoseVal != null && glucoseVal >= 100 && glucoseVal < 126;
    const isDiabetesHba1c      = hba1cVal   != null && hba1cVal   >= 6.5;
    const isPreDiabetesHba1c   = hba1cVal   != null && hba1cVal   >= 5.7 && hba1cVal < 6.5;

    const isDiabetes    = isDiabetesGlucose  || isDiabetesHba1c;
    const isPreDiabetes = !isDiabetes && (isPreDiabetesGlucose || isPreDiabetesHba1c);

    if (glucose) {
      const stage = isDiabetesGlucose ? 'Diabetes range' : isPreDiabetesGlucose ? 'Pre-diabetes range' : 'Normal';
      factors.push(`Fasting Glucose: ${glucoseVal} mg/dL — ${stage} (Normal: 70–99, Pre-diabetes: 100–125, Diabetes: ≥126)`);
    }
    if (hba1c) {
      const stage = isDiabetesHba1c ? 'Diabetes range' : isPreDiabetesHba1c ? 'Pre-diabetes range' : 'Normal';
      factors.push(`HbA1c: ${hba1cVal}% — ${stage} (Normal: <5.7%, Pre-diabetes: 5.7–6.4%, Diabetes: ≥6.5%)`);
    }

    const risk: PredictionResult['risk'] =
      isDiabetes    ? 'high'     :
      isPreDiabetes ? 'moderate' :
                      'low';

    result.push({
      condition: 'Glycaemic Regulation & Diabetes',
      risk,
      probability:
        isDiabetes    ? 85 :
        isPreDiabetes ? 55 :
                        8,
      factors,
      recommendation:
        isDiabetes    ? 'Glucose/HbA1c values in diabetes range (ADA 2024). Physician confirmation with repeat fasting test required. Do not self-diagnose.' :
        isPreDiabetes ? 'Pre-diabetes range detected. Up to 58% of pre-diabetics develop type 2 diabetes without intervention (CDC). Lifestyle modification (diet + 150 min/week activity) can reduce risk by ~58% (DPP trial).' :
                        'Glycaemic markers indicate balanced insulin sensitivity.',
    });
  }

  // ─── 6. Kidney Function ───────────────────────────────────────────────────
  // KDIGO 2024: Creatinine > 1.2 mg/dL (male) or > 1.0 mg/dL (female) warrants monitoring.
  // Single elevated creatinine alone does not diagnose CKD — needs two readings ≥ 3 months apart.
  // Blood Urea Nitrogen (BUN): normal 7–20 mg/dL. Elevated with dehydration or renal impairment.
  const creatinine = p.Creatinine;
  const urea       = p.Urea;
  if (creatinine || urea) {
    const creatVal = creatinine?.value ?? 0.9;
    const ureaVal  = urea?.value;

    // Staging based on creatinine elevation
    const criticalElevation = creatVal >= 2.0;
    const highElevation     = creatVal >= 1.5 && !criticalElevation;
    const mildElevation     = creatVal > 1.2 && !highElevation;

    const elevatedUrea = ureaVal != null && ureaVal > 40;  // > 40 mg/dL = elevated (ICMR)

    const factors: string[] = [];
    if (creatinine) factors.push(`Creatinine: ${creatVal} mg/dL (Normal: male 0.7–1.2, female 0.5–1.0 mg/dL)`);
    if (urea)       factors.push(`Urea: ${ureaVal} mg/dL (Normal: 15–40 mg/dL)`);
    if (elevatedUrea && !mildElevation) factors.push('Elevated blood urea — consider dehydration, high protein intake, or renal impairment.');

    const risk: PredictionResult['risk'] =
      criticalElevation ? 'high'     :
      highElevation     ? 'high'     :
      (mildElevation || elevatedUrea) ? 'moderate' :
                          'low';

    result.push({
      condition: 'Kidney Filtration & Renal Health',
      risk,
      probability:
        criticalElevation ? 80 :
        highElevation     ? 65 :
        mildElevation     ? 38 :
        elevatedUrea      ? 30 :
                            10,
      factors,
      recommendation:
        criticalElevation ? 'Significantly elevated creatinine. Urgent physician evaluation needed. Avoid NSAIDs and nephrotoxic drugs.' :
        highElevation     ? 'Creatinine markedly elevated. eGFR calculation and physician referral recommended. Stay well hydrated.' :
        mildElevation     ? 'Mild creatinine elevation. Stay hydrated, avoid NSAIDs. Repeat test in 3 months to assess trend (KDIGO criterion: ≥3 months for CKD diagnosis).' :
                            'Renal filtration markers are within standard physiological ranges.',
    });
  }

  // ─── 7. Thyroid Function ──────────────────────────────────────────────────
  // AACE/ATA guidelines:
  //   TSH: 0.45–4.5 mIU/L normal range.
  //   TSH < 0.45: Hyperthyroidism suspect.
  //   TSH 4.5–10: Subclinical hypothyroidism.
  //   TSH > 10: Overt hypothyroidism.
  const tsh = p.TSH;
  if (tsh) {
    const tshVal = tsh.value;
    const isLow  = tshVal < 0.45;     // Hyperthyroid suspect
    const isMildHigh = tshVal > 4.5 && tshVal <= 10;  // Subclinical hypothyroid
    const isHighHigh = tshVal > 10;                    // Overt hypothyroid

    const factors = [
      `TSH: ${tshVal} ${tsh.unit} (Normal: 0.45–4.5 mIU/L)`,
      isLow     ? 'Low TSH — suspect hyperthyroidism. Consider Free T3/T4 testing.' : '',
      isMildHigh? 'TSH mildly elevated (4.5–10) — subclinical hypothyroidism. Assess symptoms (fatigue, weight gain, cold intolerance).' : '',
      isHighHigh? 'TSH markedly elevated (>10) — consistent with overt hypothyroidism. Free T4 testing and physician evaluation required.' : '',
    ].filter(Boolean);

    const risk: PredictionResult['risk'] =
      isHighHigh ? 'high'     :
      (isLow || isMildHigh) ? 'moderate' :
                               'low';

    result.push({
      condition: 'Thyroid Function',
      risk,
      probability: isHighHigh ? 72 : (isLow || isMildHigh) ? 55 : 10,
      factors,
      recommendation:
        isHighHigh ? 'Overt hypothyroidism pattern. Physician evaluation and Free T4/T3 follow-up required before initiating treatment.' :
        isLow      ? 'Low TSH suggests possible hyperthyroidism. Order Free T3/T4 and anti-thyroid antibody panel. Physician review required.' :
        isMildHigh ? 'Subclinical hypothyroidism. Monitor symptoms. Repeat TSH in 3–6 months. Discuss levothyroxine eligibility with physician if symptomatic.' :
                     'Thyroid stimulating hormone level is normal and well regulated.',
    });
  }

  // ─── 8. Vitamin D Status ──────────────────────────────────────────────────
  // Endocrine Society 2024:
  //   Severe deficiency: < 12 ng/mL
  //   Deficiency:        < 20 ng/mL
  //   Insufficiency:     20–29 ng/mL
  //   Sufficiency:       ≥ 30 ng/mL
  //   Optimal:           40–60 ng/mL
  //   Toxicity risk:     > 100 ng/mL
  const vitD = p['Vitamin D'] ?? p['25-OH Vitamin D'];
  if (vitD) {
    const vitDVal = vitD.value;
    const isSevereDeficient  = vitDVal < 12;
    const isDeficient        = vitDVal >= 12 && vitDVal < 20;
    const isInsufficient     = vitDVal >= 20 && vitDVal < 30;
    const isToxicityRisk     = vitDVal > 100;

    const factors = [
      `Vitamin D: ${vitDVal} ${vitD.unit} (Sufficient: ≥30, Deficient: <20, Severe: <12 ng/mL)`,
      isSevereDeficient  ? 'Severe Vitamin D deficiency — associated with bone loss, muscle weakness, immune suppression.' : '',
      isDeficient        ? 'Vitamin D deficiency — supplementation typically recommended (1000–2000 IU/day, physician-guided).' : '',
      isInsufficient     ? 'Vitamin D insufficiency — consider supplementation and sun exposure.' : '',
      isToxicityRisk     ? 'Very high Vitamin D — risk of hypercalcaemia. Review supplementation dose.' : '',
    ].filter(Boolean);

    const risk: PredictionResult['risk'] =
      isSevereDeficient ? 'high'     :
      isToxicityRisk    ? 'high'     :
      (isDeficient || isInsufficient) ? 'moderate' :
                           'low';

    result.push({
      condition: 'Vitamin D Status',
      risk,
      probability:
        isSevereDeficient ? 82 : isToxicityRisk ? 75 :
        isDeficient ? 65 : isInsufficient ? 40 : 8,
      factors,
      recommendation:
        isSevereDeficient ? 'Severe Vitamin D deficiency requires physician-directed supplementation (often 60,000 IU weekly for 8 weeks then maintenance). Check calcium and PTH also.' :
        isToxicityRisk    ? 'Vitamin D level above safe threshold. Stop supplementation and consult physician. Check serum calcium.' :
        isDeficient       ? 'Vitamin D deficiency. Typical adult dose: 1000–2000 IU/day (confirm with physician). Also ensure adequate dietary calcium intake.' :
        isInsufficient    ? 'Vitamin D insufficient. Increase sun exposure (15–20 min/day) and consider 800–1000 IU/day supplementation.' :
                            'Vitamin D levels are adequate for bone health and immune function.',
    });
  }

  return result;
}

// ─── Longitudinal Trend Analysis (Velocity) ──────────────────────────────────

export interface TrendAlert {
  condition: string;
  metric: string;
  status: 'improving' | 'worsening' | 'stable';
  message: string;
  velocity: number; // e.g. units per month
  velocityStr: string;
}

export function generateTrendAlerts(records: MedicalRecord[]): TrendAlert[] {
  const alerts: TrendAlert[] = [];
  const sorted = [...records]
    .filter(r => (r.extractedData || r.type === 'prescription') && r.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length < 2) return alerts; // Need at least 2 points

  // Build timelines for key metrics
  const timelines: Record<string, { date: Date; value: number }[]> = {};
  for (const record of sorted) {
    if (!record.extractedData) continue;
    const date = new Date(record.date);
    for (const [key, data] of Object.entries(record.extractedData)) {
      const canonical = mapMetricKey(key) || key;
      if (!timelines[canonical]) timelines[canonical] = [];
      timelines[canonical].push({ date, value: data.value });
    }
  }

  const msInMonth = 1000 * 60 * 60 * 24 * 30.44;

  const analyzeTimeline = (
    metricKey: string,
    displayName: string,
    worseningDirection: 'up' | 'down',
    thresholdPerMonth: number,
    worseningMsg: (vel: string, hasPrescription: boolean) => string,
    improvingMsg: (vel: string, hasPrescription: boolean) => string
  ) => {
    const tl = timelines[metricKey] || timelines[mapMetricKey(metricKey) || ''];
    if (!tl || tl.length < 2) return;

    // Use the last 2 points
    const p1 = tl[tl.length - 2];
    const p2 = tl[tl.length - 1];
    
    const months = (p2.date.getTime() - p1.date.getTime()) / msInMonth;
    if (months <= 0) return;

    const delta = p2.value - p1.value;
    const velocity = delta / months;
    const absVelStr = Math.abs(velocity).toFixed(2);

    if (Math.abs(velocity) < thresholdPerMonth) return;

    const isWorsening = (worseningDirection === 'up' && velocity > 0) || (worseningDirection === 'down' && velocity < 0);
    
    // Check if there are any prescriptions between p1 and p2
    const hasInterveningPrescription = sorted.some(r => 
      r.type === 'prescription' && 
      new Date(r.date) >= p1.date && 
      new Date(r.date) <= p2.date && 
      r.medications && r.medications.length > 0
    );
    
    alerts.push({
      condition: displayName,
      metric: metricKey,
      status: isWorsening ? 'worsening' : 'improving',
      velocity,
      velocityStr: `${absVelStr} / mo`,
      message: isWorsening ? worseningMsg(absVelStr, hasInterveningPrescription) : improvingMsg(absVelStr, hasInterveningPrescription)
    });
  };

  analyzeTimeline('hba1c', 'HbA1c Trajectory', 'up', 0.1, 
    (v, hp) => `HbA1c is rising rapidly by ${v}% per month. ${hp ? 'Recent prescriptions do not seem to be controlling it yet.' : 'If this velocity continues, diabetes risk significantly increases.'}`,
    (v, hp) => `HbA1c is improving, dropping by ${v}% per month. ${hp ? 'Recent medication appears to be highly effective.' : 'Diet or lifestyle changes are effective.'}`
  );

  analyzeTimeline('glucose', 'Fasting Glucose Trajectory', 'up', 2.0,
    (v, hp) => `Fasting glucose is rising by ${v} mg/dL per month. ${hp ? 'Consider adjusting prescribed medication dosage.' : 'Suggests worsening insulin resistance.'}`,
    (v, hp) => `Fasting glucose is falling by ${v} mg/dL per month. ${hp ? 'Prescription therapy is having the desired effect.' : 'Glycemic control is improving.'}`
  );

  analyzeTimeline('ldl', 'LDL Cholesterol Trajectory', 'up', 3.0,
    (v, hp) => `LDL is increasing by ${v} mg/dL per month. ${hp ? 'Current lipid-lowering therapy might be insufficient.' : 'Accelerates cardiovascular risk.'}`,
    (v, hp) => `LDL is decreasing by ${v} mg/dL per month. ${hp ? 'Lipid-lowering medication is working well.' : 'Lifestyle changes are improving lipid profile.'}`
  );

  analyzeTimeline('creatinine', 'Kidney Function Trajectory', 'up', 0.05,
    (v, hp) => `Creatinine is rising steadily (${v} mg/dL/mo). ${hp ? 'Review recently prescribed nephrotoxic medications.' : 'Indicates progressive decline in renal filtration.'}`,
    (v, hp) => `Creatinine is falling (${v} mg/dL/mo). Kidney recovery or improved hydration observed.`
  );

  analyzeTimeline('hemoglobin', 'Hemoglobin Trajectory', 'down', 0.2,
    (v, hp) => `Hemoglobin is dropping by ${v} g/dL per month. ${hp ? 'Current supplementation isn\'t stopping the decline.' : 'Progressive blood loss or production deficit.'}`,
    (v, hp) => `Hemoglobin is recovering by ${v} g/dL per month. ${hp ? 'Anemia treatment/prescription is highly effective.' : 'Anemia is improving.'}`
  );

  return alerts;
}

