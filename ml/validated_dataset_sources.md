# Validated Dataset Sources

For a stronger medical-risk modeling workflow, replace or supplement the demo dataset with a clinically grounded source.

Recommended sources:

1. **MIMIC-IV / MIMIC-IV-ED / MIMIC-IV Demo**
   - High-quality critical care and hospital data released through PhysioNet.
   - Best when you want a serious clinical dataset with published provenance.
   - Access typically requires credentialing and data-use agreement acceptance.

2. **eICU Collaborative Research Database**
   - Multi-center ICU dataset released through PhysioNet.
   - Useful for broader hospital coverage than single-center ICU data.

3. **Validated hospital or lab datasets from your institution**
   - Best option if your project is being used in a specific clinical or academic setting.
   - Requires ethics/privacy review and de-identification.

## How to use with this project

1. Export or derive a CSV that matches the Healytics risk schema.
2. Normalize column names with:

```bash
python scripts/prepare_validated_dataset.py --input path/to/source.csv --output ml/validated_dataset.csv --map hemoglobin=hb_value
```

3. Retrain the model:

```bash
npm run ml:train -- --input ml/validated_dataset.csv
```

## Required schema

The normalized dataset must contain:

- `patient_id`
- `encounter_date`
- `hemoglobin`
- `fasting_glucose`
- `total_cholesterol`
- `creatinine`
- `hba1c`
- `ldl_cholesterol`
- `triglycerides`
- `abnormal_ratio`
- `record_count`
- `anemia_label`
- `diabetes_label`
- `cardiovascular_label`
- `kidney_label`

## Notes

- The current `demo_health_dataset.csv` is useful for development only.
- Do not claim clinical validity unless the production model is trained and evaluated on a properly governed dataset.
