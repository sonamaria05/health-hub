import argparse
import csv
import json
import random
from pathlib import Path

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


BASE_FEATURES = [
    "hemoglobin",
    "fasting_glucose",
    "total_cholesterol",
    "creatinine",
    "hba1c",
    "ldl_cholesterol",
    "triglycerides",
    "abnormal_ratio",
    "record_count",
]

ENGINEERED_FEATURES = [
    "anemia_signal",
    "glycemic_signal",
    "lipid_signal",
    "kidney_signal",
    "risk_burden",
    "glucose_hba1c_interaction",
    "lipid_density",
    "renal_load",
]

ALL_FEATURES = BASE_FEATURES + ENGINEERED_FEATURES

TARGETS = {
    "anemia": {
        "column": "anemia_label",
        "condition": "Anemia Risk",
        "recommendation": "Repeat CBC monitoring, review iron intake, and follow up clinically if fatigue or paleness persists.",
    },
    "diabetes": {
        "column": "diabetes_label",
        "condition": "Diabetes Risk",
        "recommendation": "Continue glucose monitoring, prioritize balanced meals and activity, and discuss follow-up testing with your clinician.",
    },
    "cardiovascular": {
        "column": "cardiovascular_label",
        "condition": "Cardiovascular Risk",
        "recommendation": "Review diet, exercise, and lipid follow-up planning with your clinician, especially if LDL or triglycerides remain elevated.",
    },
    "kidney": {
        "column": "kidney_label",
        "condition": "Kidney Function Risk",
        "recommendation": "Monitor kidney markers on future panels and discuss follow-up if creatinine trends upward.",
    },
}

FEATURE_DEFINITIONS = {
    "hemoglobin": {"label": "Hemoglobin", "unit": "g/dL", "aliases": ["Hemoglobin"]},
    "fasting_glucose": {"label": "Fasting Glucose", "unit": "mg/dL", "aliases": ["Fasting Glucose", "Glucose"]},
    "total_cholesterol": {"label": "Total Cholesterol", "unit": "mg/dL", "aliases": ["Total Cholesterol", "Cholesterol"]},
    "creatinine": {"label": "Creatinine", "unit": "mg/dL", "aliases": ["Creatinine"]},
    "hba1c": {"label": "HbA1c", "unit": "%", "aliases": ["HbA1c"]},
    "ldl_cholesterol": {"label": "LDL Cholesterol", "unit": "mg/dL", "aliases": ["LDL Cholesterol"]},
    "triglycerides": {"label": "Triglycerides", "unit": "mg/dL", "aliases": ["Triglycerides"]},
    "abnormal_ratio": {"label": "Abnormal Ratio", "unit": "%", "aliases": []},
    "record_count": {"label": "Record Count", "unit": "count", "aliases": []},
    "anemia_signal": {"label": "Anemia Signal", "unit": "score", "aliases": []},
    "glycemic_signal": {"label": "Glycemic Signal", "unit": "score", "aliases": []},
    "lipid_signal": {"label": "Lipid Signal", "unit": "score", "aliases": []},
    "kidney_signal": {"label": "Kidney Signal", "unit": "score", "aliases": []},
    "risk_burden": {"label": "Risk Burden", "unit": "score", "aliases": []},
    "glucose_hba1c_interaction": {"label": "Glucose HbA1c Interaction", "unit": "score", "aliases": []},
    "lipid_density": {"label": "Lipid Density", "unit": "score", "aliases": []},
    "renal_load": {"label": "Renal Load", "unit": "score", "aliases": []},
}

MODEL_VERSION = "ensemble-tabular-v2"


def clamp(value, lower, upper):
    return max(lower, min(upper, value))


def read_dataset(path):
    with Path(path).open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path, rows):
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def write_feature_csv(path, rows, feature_rows):
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) + ENGINEERED_FEATURES
    merged_rows = []
    for row, features in zip(rows, feature_rows):
        merged = dict(row)
        for feature in ENGINEERED_FEATURES:
            merged[feature] = round(features[feature], 6)
        merged_rows.append(merged)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(merged_rows)


def augment_rows(rows, augment_factor, seed):
    rng = random.Random(seed)
    augmented = []
    for row in rows:
        augmented.append(dict(row))
        for _ in range(augment_factor):
            clone = dict(row)
            clone["patient_id"] = f'{row["patient_id"]}_A{len(augmented)}'
            for feature in BASE_FEATURES:
                value = float(row[feature])
                if feature == "record_count":
                    noise = rng.choice([-1, 0, 0, 1])
                    clone[feature] = str(int(clamp(round(value + noise), 1, 12)))
                    continue

                noise_scale = {
                    "hemoglobin": 0.18,
                    "fasting_glucose": 4.0,
                    "total_cholesterol": 6.5,
                    "creatinine": 0.045,
                    "hba1c": 0.08,
                    "ldl_cholesterol": 5.0,
                    "triglycerides": 7.5,
                    "abnormal_ratio": 0.025,
                }[feature]
                new_value = value + rng.gauss(0, noise_scale)
                bounds = {
                    "hemoglobin": (8.8, 14.8),
                    "fasting_glucose": (84, 160),
                    "total_cholesterol": (170, 290),
                    "creatinine": (0.75, 1.8),
                    "hba1c": (4.8, 7.2),
                    "ldl_cholesterol": (88, 195),
                    "triglycerides": (95, 245),
                    "abnormal_ratio": (0.01, 0.7),
                }[feature]
                new_value = clamp(new_value, bounds[0], bounds[1])
                clone[feature] = f"{new_value:.4f}" if feature in {"creatinine", "hba1c", "abnormal_ratio"} else f"{new_value:.2f}"
            augmented.append(clone)
    return augmented


def base_feature_dict(row):
    return {feature: float(row[feature]) for feature in BASE_FEATURES}


def derive_features(base):
    anemia_signal = max(0.0, 12.0 - base["hemoglobin"])
    glycemic_signal = max(0.0, base["fasting_glucose"] - 100.0) + max(0.0, (base["hba1c"] - 5.7) * 18.0)
    lipid_signal = (
        max(0.0, base["total_cholesterol"] - 200.0)
        + max(0.0, base["ldl_cholesterol"] - 100.0)
        + 0.45 * max(0.0, base["triglycerides"] - 150.0)
    )
    kidney_signal = max(0.0, (base["creatinine"] - 1.2) * 100.0)
    risk_burden = base["abnormal_ratio"] * 100.0 + 1.4 * anemia_signal + 0.1 * glycemic_signal + 0.035 * lipid_signal + 0.08 * kidney_signal
    glucose_hba1c_interaction = base["fasting_glucose"] * base["hba1c"] / 100.0
    lipid_density = (base["total_cholesterol"] + base["ldl_cholesterol"] + 0.5 * base["triglycerides"]) / max(base["record_count"], 1.0)
    renal_load = base["creatinine"] * (1.0 + base["abnormal_ratio"]) * base["record_count"]

    return {
        "anemia_signal": anemia_signal,
        "glycemic_signal": glycemic_signal,
        "lipid_signal": lipid_signal,
        "kidney_signal": kidney_signal,
        "risk_burden": risk_burden,
        "glucose_hba1c_interaction": glucose_hba1c_interaction,
        "lipid_density": lipid_density,
        "renal_load": renal_load,
    }


def rows_to_matrix(rows):
    feature_rows = []
    matrix = []
    for row in rows:
        base = base_feature_dict(row)
        engineered = derive_features(base)
        feature_row = {**base, **engineered}
        feature_rows.append(feature_row)
        matrix.append([feature_row[feature] for feature in ALL_FEATURES])
    return np.array(matrix, dtype=float), feature_rows


def select_threshold(labels, probabilities):
    best_threshold = 0.5
    best_score = -1.0
    for threshold in np.arange(0.25, 0.76, 0.025):
        predictions = (probabilities >= threshold).astype(int)
        score = f1_score(labels, predictions, zero_division=0)
        if score > best_score:
            best_score = score
            best_threshold = float(round(threshold, 3))
    return best_threshold, float(best_score)


def serialize_random_forest(model):
    trees = []
    for estimator in model.estimators_:
        tree = estimator.tree_
        positive_probabilities = []
        for values in tree.value:
            class_values = values[0] if np.ndim(values) > 1 else values
            total = float(np.sum(class_values))
            positive = float(class_values[1]) if len(class_values) > 1 else 0.0
            positive_probabilities.append(positive / total if total else 0.0)
        trees.append({
            "children_left": tree.children_left.tolist(),
            "children_right": tree.children_right.tolist(),
            "feature": tree.feature.tolist(),
            "threshold": tree.threshold.tolist(),
            "positive_probability": positive_probabilities,
        })

    return {
        "model_type": "random_forest",
        "trees": trees,
        "feature_importances": {feature: round(float(importance), 6) for feature, importance in zip(ALL_FEATURES, model.feature_importances_)},
    }


def serialize_logistic(model):
    scaler = model.named_steps["scaler"]
    classifier = model.named_steps["classifier"]
    return {
        "model_type": "logistic_regression",
        "means": {feature: round(float(value), 6) for feature, value in zip(ALL_FEATURES, scaler.mean_)},
        "scales": {feature: round(float(value), 6) for feature, value in zip(ALL_FEATURES, scaler.scale_)},
        "intercept": round(float(classifier.intercept_[0]), 6),
        "coefficients": {feature: round(float(value), 6) for feature, value in zip(ALL_FEATURES, classifier.coef_[0])},
    }


def candidate_models(seed):
    return {
        "logistic_regression": Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=3000, class_weight="balanced", C=1.0)),
        ]),
        "random_forest": RandomForestClassifier(
            n_estimators=220,
            max_depth=6,
            min_samples_leaf=2,
            random_state=seed,
            class_weight="balanced_subsample",
        ),
    }


def evaluate_with_threshold(labels, probabilities, threshold):
    predictions = (probabilities >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(labels, predictions, labels=[0, 1]).ravel()
    return {
        "sample_count": int(len(labels)),
        "positive_count": int(np.sum(labels)),
        "negative_count": int(len(labels) - np.sum(labels)),
        "accuracy": round(float(accuracy_score(labels, predictions)), 4),
        "precision": round(float(precision_score(labels, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(labels, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(labels, predictions, zero_division=0)), 4),
        "auc": round(float(roc_auc_score(labels, probabilities)), 4) if len(set(labels.tolist())) > 1 else 1.0,
        "threshold": threshold,
        "confusion_matrix": {"tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)},
    }


def choose_model(train_x, train_y, seed):
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed)
    results = {}
    for model_name, model in candidate_models(seed).items():
        oof_probabilities = cross_val_predict(model, train_x, train_y, cv=cv, method="predict_proba")[:, 1]
        threshold, cv_f1 = select_threshold(train_y, oof_probabilities)
        cv_auc = roc_auc_score(train_y, oof_probabilities) if len(set(train_y.tolist())) > 1 else 1.0
        results[model_name] = {
            "threshold": threshold,
            "cv_f1": round(float(cv_f1), 4),
            "cv_auc": round(float(cv_auc), 4),
        }

    ranked = sorted(results.items(), key=lambda item: (item[1]["cv_f1"], item[1]["cv_auc"]), reverse=True)
    best_name, best_meta = ranked[0]
    best_model = candidate_models(seed)[best_name]
    best_model.fit(train_x, train_y)
    return best_name, best_model, best_meta, results


def build_artifacts(train_rows, test_rows, seed, test_ratio, augment_factor):
    train_x, train_feature_rows = rows_to_matrix(train_rows)
    test_x, test_feature_rows = rows_to_matrix(test_rows)

    models = {}
    metrics = {}

    for target_name, config in TARGETS.items():
        train_y = np.array([int(row[config["column"]]) for row in train_rows], dtype=int)
        test_y = np.array([int(row[config["column"]]) for row in test_rows], dtype=int)

        best_name, fitted_model, best_meta, comparisons = choose_model(train_x, train_y, seed)
        test_probabilities = fitted_model.predict_proba(test_x)[:, 1]
        evaluation = evaluate_with_threshold(test_y, test_probabilities, best_meta["threshold"])

        if best_name == "logistic_regression":
            serialized = serialize_logistic(fitted_model)
        else:
            serialized = serialize_random_forest(fitted_model)

        models[target_name] = {
            "condition": config["condition"],
            "recommendation": config["recommendation"],
            "threshold": best_meta["threshold"],
            **serialized,
        }

        metrics[target_name] = {
            "selected_model": best_name,
            "cross_validation": comparisons,
            "test_metrics": evaluation,
        }

    average_accuracy = sum(item["test_metrics"]["accuracy"] for item in metrics.values()) / len(metrics)
    average_f1 = sum(item["test_metrics"]["f1"] for item in metrics.values()) / len(metrics)
    average_auc = sum(item["test_metrics"]["auc"] for item in metrics.values()) / len(metrics)

    artifacts = {
        "model_version": MODEL_VERSION,
        "base_features": BASE_FEATURES,
        "engineered_features": ENGINEERED_FEATURES,
        "all_features": ALL_FEATURES,
        "feature_definitions": FEATURE_DEFINITIONS,
        "models": models,
    }

    evaluation = {
        "model_version": MODEL_VERSION,
        "dataset": {
            "seed_rows": len(train_rows) + len(test_rows),
            "train_rows": len(train_rows),
            "test_rows": len(test_rows),
            "test_ratio": test_ratio,
            "augmentation_factor": augment_factor,
            "seed": seed,
        },
        "per_model": metrics,
        "summary": {
            "average_accuracy": round(average_accuracy, 4),
            "average_f1": round(average_f1, 4),
            "average_auc": round(average_auc, 4),
        },
    }

    return artifacts, evaluation, train_feature_rows, test_feature_rows


def to_ts_module(artifacts):
    return "\n".join([
        "// This file is generated by scripts/train_risk_models.py. Do not edit manually.",
        "",
        "export const mlArtifacts = " + json.dumps(artifacts, indent=2) + " as const;",
        "",
        "export type TrainedMlArtifacts = typeof mlArtifacts;",
        "",
    ])


def to_metrics_ts_module(metrics):
    return "\n".join([
        "// This file is generated by scripts/train_risk_models.py. Do not edit manually.",
        "",
        "export const mlMetrics = " + json.dumps(metrics, indent=2) + " as const;",
        "",
        "export type TrainedMlMetrics = typeof mlMetrics;",
        "",
    ])


def main():
    parser = argparse.ArgumentParser(description="Train health risk models, compare candidates, and export runtime artifacts.")
    parser.add_argument("--input", default="ml/demo_health_dataset.csv", help="Input CSV dataset path")
    parser.add_argument("--artifacts", default="ml/model_artifacts.json", help="Output JSON artifact path")
    parser.add_argument("--metrics", default="ml/model_metrics.json", help="Output JSON metrics path")
    parser.add_argument("--train-output", default="ml/processed/train_dataset.csv", help="Output train split CSV path")
    parser.add_argument("--test-output", default="ml/processed/test_dataset.csv", help="Output test split CSV path")
    parser.add_argument("--ts-output", default="src/lib/generated/mlArtifacts.ts", help="Generated TypeScript artifact path")
    parser.add_argument("--metrics-ts-output", default="src/lib/generated/mlMetrics.ts", help="Generated TypeScript metrics path")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--test-ratio", type=float, default=0.25, help="Test split ratio")
    parser.add_argument("--augment-factor", type=int, default=4, help="Synthetic variants per source row")
    args = parser.parse_args()

    rows = read_dataset(args.input)
    if len(rows) < 8:
        raise ValueError("Dataset is too small. Add more labeled rows before training.")

    augmented_rows = augment_rows(rows, args.augment_factor, args.seed)
    train_rows, test_rows = train_test_split(augmented_rows, test_size=args.test_ratio, random_state=args.seed)

    artifacts, metrics, train_feature_rows, test_feature_rows = build_artifacts(
        train_rows,
        test_rows,
        args.seed,
        args.test_ratio,
        args.augment_factor,
    )

    write_feature_csv(args.train_output, train_rows, train_feature_rows)
    write_feature_csv(args.test_output, test_rows, test_feature_rows)

    artifacts_path = Path(args.artifacts)
    artifacts_path.parent.mkdir(parents=True, exist_ok=True)
    artifacts_path.write_text(json.dumps(artifacts, indent=2), encoding="utf-8")

    metrics_path = Path(args.metrics)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    ts_output_path = Path(args.ts_output)
    ts_output_path.parent.mkdir(parents=True, exist_ok=True)
    ts_output_path.write_text(to_ts_module(artifacts), encoding="utf-8")

    metrics_ts_output_path = Path(args.metrics_ts_output)
    metrics_ts_output_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_ts_output_path.write_text(to_metrics_ts_module(metrics), encoding="utf-8")

    print(f"Wrote model artifacts to {artifacts_path}")
    print(f"Wrote evaluation metrics to {metrics_path}")
    print(f"Wrote train/test splits to {args.train_output} and {args.test_output}")
    print(f"Wrote TypeScript artifacts to {ts_output_path}")
    print(f"Wrote TypeScript metrics to {metrics_ts_output_path}")


if __name__ == "__main__":
    main()
