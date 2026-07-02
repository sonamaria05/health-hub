# ML Assets

This folder contains the tabular machine-learning assets used for health-risk prediction.

## Dataset format

The training dataset is a CSV with one row per patient snapshot or encounter summary.

Required feature columns:
- `hemoglobin`
- `fasting_glucose`
- `total_cholesterol`
- `creatinine`
- `hba1c`
- `ldl_cholesterol`
- `triglycerides`
- `abnormal_ratio`
- `record_count`

Required label columns:
- `anemia_label`
- `diabetes_label`
- `cardiovascular_label`
- `kidney_label`

Metadata columns such as `patient_id` and `encounter_date` can also be included.

## Files

- [demo_health_dataset.csv](C:/Users/sonam/Downloads/health-hub-main/health-hub-main/ml/demo_health_dataset.csv): starter labeled dataset
- [validated_dataset_sources.md](C:/Users/sonam/Downloads/health-hub-main/health-hub-main/ml/validated_dataset_sources.md): guidance for moving to clinical research data
- `processed/train_dataset.csv`: generated training split
- `processed/test_dataset.csv`: generated test split
- `model_artifacts.json`: generated model weights and normalization values
- `model_metrics.json`: generated evaluation metrics
- [risk_dataset_template.csv](C:/Users/sonam/Downloads/health-hub-main/health-hub-main/ml/risk_dataset_template.csv): empty template for adding more labeled data

## Training

Run:

```bash
python scripts/train_risk_models.py
```

This generates:
- JSON model artifacts
- JSON evaluation metrics
- train/test split CSVs
- a TypeScript artifact module used by the app and Supabase function

To normalize a validated external dataset into the project schema:

```bash
python scripts/prepare_validated_dataset.py --input path/to/source.csv --output ml/validated_dataset.csv
```

## Current training flow

- Source rows are expanded with light synthetic augmentation to make the demo dataset less tiny during training.
- Additional engineered features are created from the base lab values.
- Logistic regression and random forest models are compared per target with cross-validation.
- The best model per target is exported with its tuned probability threshold.
