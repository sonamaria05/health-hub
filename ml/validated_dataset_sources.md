# Validated Dataset Sources

## What `ml/validated_dataset.csv` actually is

This file is derived from the **MIMIC-IV Clinical Database Demo, v2.2**
(PhysioNet), via `scripts/prepare_mimic_dataset.py`. Unlike full MIMIC-IV,
the demo subset is **openly available with no credentialing or data-use
agreement required** - it contains a fixed, public subset of 100
de-identified patients, which is why it's safe to include derived output
from it directly in this repository.

- **Source**: MIMIC-IV Clinical Database Demo v2.2, PhysioNet.
  https://physionet.org/content/mimic-iv-demo/2.2/
- **License**: Open Data Commons Open Database License v1.0 (ODbL v1.0).
- **Citation** (required when using this data):
  > Johnson, A., Bulgarelli, L., Pollard, T., Horng, S., Celi, L. A., &
  > Mark, R. (2022). MIMIC-IV Clinical Database Demo (version 2.2).
  > PhysioNet. https://doi.org/10.13026/dp1f-ex47
  >
  > Goldberger, A., Amaral, L., Glass, L., Hausdorff, J., Ivanov, P. C.,
  > Mark, R., Mietus, J. E., Moody, G. B., Peng, C. K., & Stanley, H. E.
  > (2000). PhysioBank, PhysioToolkit, and PhysioNet: Components of a new
  > research resource for complex physiologic signals. *Circulation*,
  > 101(23), e215-e220.
- **Derivation**: `scripts/prepare_mimic_dataset.py` extracts the latest
  lab value per feature per patient from `hosp/labevents.csv.gz`, counts
  distinct hospital admissions as `record_count`, and derives condition
  labels using `--label-mode hybrid` (diagnosis codes from
  `hosp/diagnoses_icd.csv.gz` OR the same clinical thresholds used
  elsewhere in this app, whichever is positive first).

## Honest limitations of this dataset - read before trusting any metric

- **It is small.** 100 patients total, further split into train/test and
  lightly augmented (`--augment-factor`) for training. Every metric in
  `ml/MODEL_CARD.md` should be read with that in mind - cross-validated
  AUC/F1 on ~100 patients has real variance, not the precision the decimal
  places imply.
- **Labels are partially threshold-derived, not universally
  diagnosis-confirmed.** Where a patient has no matching ICD-9/ICD-10
  diagnosis code for a condition, the hybrid label mode falls back to a
  lab-value threshold (e.g. hemoglobin < 12.0 for anemia). That's a
  reasonable proxy, not a clinical diagnosis.
- **This is a demo-scale dataset, not a validated clinical one.** Do not
  represent metrics trained on it as clinically validated performance.
  See `ml/MODEL_CARD.md`'s disclaimer for the exact language used
  in-product.

## Using a different / larger source instead

If you have access to full credentialed MIMIC-IV, eICU, or an
institutional dataset matching this schema, normalize it with:

```bash
python scripts/prepare_validated_dataset.py --input path/to/source.csv --output ml/validated_dataset.csv --map hemoglobin=hb_value
```

then retrain:

```bash
npm run ml:train -- --input ml/validated_dataset.csv
```

### Required schema

- `patient_id`, `encounter_date`
- `hemoglobin`, `fasting_glucose`, `total_cholesterol`, `creatinine`,
  `hba1c`, `ldl_cholesterol`, `triglycerides`, `abnormal_ratio`,
  `record_count`
- `anemia_label`, `diabetes_label`, `cardiovascular_label`, `kidney_label`

## Notes

- `ml/demo_health_dataset.csv` (synthetic, hand-authored) remains available
  for quick local iteration without needing to regenerate the MIMIC-derived
  file, but `ml/validated_dataset.csv` is the default training input as of
  this Task 3 pass.
- Regardless of source, never claim clinical validity unless the
  production model has actually been trained and evaluated on a properly
  governed, sufficiently large dataset with clinical oversight.

