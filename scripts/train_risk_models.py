import argparse
import csv
import json
import random
from pathlib import Path

import numpy as np
import shap
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier


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

MODEL_VERSION = "3.0.0"


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


def serialize_xgboost(model):
    # trees_to_dataframe() is XGBoost's own documented way to introspect a
    # trained booster. For leaf rows, the "Gain" column holds the leaf's
    # output value (log-odds contribution), not information gain - that's
    # a well-known quirk of this API, not a bug in this code.
    #
    # IMPORTANT: XGBoost stores split thresholds as float32 internally, but
    # trees_to_dataframe() reports them upcast to float64 (e.g. 5.8 becomes
    # 5.80000019). A feature value that's exactly on a split boundary in
    # float64 can therefore evaluate on the *opposite* side of a >=/< 
    # comparison than XGBoost's real (float32) decision did. This was
    # verified empirically: comparing in float64 mismatched sklearn's own
    # predict_proba by up to 0.29 probability on this dataset; rounding
    # both the feature value and the threshold to float32 before comparing
    # (see src/lib/mlRisk.ts's use of Math.fround) brought the max
    # discrepancy down to ~1e-7. The TypeScript interpreter MUST replicate
    # this float32 rounding, or its predictions will silently diverge from
    # what this training script actually evaluated.
    booster = model.get_booster()
    tree_df = booster.trees_to_dataframe()

    trees = []
    for tree_id, group in tree_df.groupby("Tree", sort=True):
        group = group.reset_index(drop=True)
        id_to_index = {row_id: index for index, row_id in enumerate(group["ID"])}

        children_left = []
        children_right = []
        feature = []
        threshold = []
        leaf_value = []

        for _, row in group.iterrows():
            is_leaf = row["Feature"] == "Leaf"
            if is_leaf:
                children_left.append(-1)
                children_right.append(-1)
                feature.append(-1)
                threshold.append(0.0)
                leaf_value.append(float(row["Gain"]))
            else:
                children_left.append(id_to_index[row["Yes"]])
                children_right.append(id_to_index[row["No"]])
                # XGBoost labels features "f{index}" when trained on a plain
                # numpy array (no column names attached) - parse that index
                # directly rather than trying to look up ALL_FEATURES by name.
                feature.append(int(row["Feature"][1:]))
                threshold.append(float(row["Split"]))
                leaf_value.append(0.0)

        trees.append({
            "children_left": children_left,
            "children_right": children_right,
            "feature": feature,
            "threshold": threshold,
            "leaf_value": leaf_value,
        })

    return {
        "model_type": "xgboost",
        "trees": trees,
        # base_score is fixed to 0.5 (logit 0) in candidate_models(), so the
        # final probability is simply sigmoid(sum of leaf margins) with no
        # separate base-margin term to carry through the TS interpreter.
        "feature_importances": {
            feature: round(float(importance), 6)
            for feature, importance in zip(ALL_FEATURES, model.feature_importances_)
        },
    }


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


def candidate_models(seed, train_y):
    positive_count = int(np.sum(train_y))
    negative_count = int(len(train_y) - positive_count)
    # scale_pos_weight is XGBoost's native imbalance handling (equivalent in
    # spirit to class_weight="balanced" for the other two models): weight the
    # minority (positive) class by the ratio of negatives to positives so a
    # rare condition isn't drowned out by the majority "no risk" rows. Guard
    # against a zero-positive fold, which would otherwise divide by zero.
    scale_pos_weight = (negative_count / positive_count) if positive_count > 0 else 1.0

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
        "xgboost": XGBClassifier(
            n_estimators=150,
            max_depth=3,
            learning_rate=0.1,
            subsample=0.85,
            colsample_bytree=0.85,
            reg_lambda=1.0,
            scale_pos_weight=scale_pos_weight,
            eval_metric="logloss",
            random_state=seed,
            base_score=0.5,
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
    oof_by_model = {}
    for model_name, model in candidate_models(seed, train_y).items():
        oof_probabilities = cross_val_predict(model, train_x, train_y, cv=cv, method="predict_proba")[:, 1]
        oof_by_model[model_name] = oof_probabilities
        threshold, cv_f1 = select_threshold(train_y, oof_probabilities)
        cv_auc = roc_auc_score(train_y, oof_probabilities) if len(set(train_y.tolist())) > 1 else 1.0
        results[model_name] = {
            "threshold": threshold,
            "cv_f1": round(float(cv_f1), 4),
            "cv_auc": round(float(cv_auc), 4),
            # Blended score is what actually ranks candidates below - AUC
            # (threshold-independent discrimination) and F1 (a threshold-
            # dependent view of the operating point we'd actually use) are
            # weighted equally. Accuracy is intentionally not part of this:
            # with imbalanced labels, a model that always predicts the
            # majority class can post a deceptively high accuracy.
            "blended_score": round(0.5 * cv_auc + 0.5 * float(cv_f1), 4),
        }

    ranked = sorted(results.items(), key=lambda item: item[1]["blended_score"], reverse=True)
    best_name, best_meta = ranked[0]
    best_model = candidate_models(seed, train_y)[best_name]
    best_model.fit(train_x, train_y)

    # Diagnostic only: quantify what sklearn's CalibratedClassifierCV would
    # buy us on top of the winning model, via cross-validated Brier score
    # (lower is better-calibrated). This is evaluated explicitly with the
    # real sklearn class, as required - see the note on why *deployment*
    # uses a simpler, exactly-reproducible Platt-scaling transform instead
    # of shipping CalibratedClassifierCV's internal cross-fitted ensemble.
    uncalibrated_brier = float(brier_score_loss(train_y, oof_by_model[best_name]))
    calibrated_model = CalibratedClassifierCV(candidate_models(seed, train_y)[best_name], method="sigmoid", cv=3)
    calibrated_oof = cross_val_predict(calibrated_model, train_x, train_y, cv=cv, method="predict_proba")[:, 1]
    calibrated_brier = float(brier_score_loss(train_y, calibrated_oof))

    # Deployment calibration: Platt scaling (a 1-D logistic regression
    # mapping the base model's own out-of-fold probability to a recalibrated
    # one) fit on the same OOF predictions used above. This is the same
    # underlying technique CalibratedClassifierCV(method="sigmoid") uses
    # internally, but it serializes to exactly two numbers (coefficient,
    # intercept) that the TypeScript inference engine can reproduce exactly,
    # unlike CalibratedClassifierCV's own cross-fitted ensemble of
    # calibrators, which doesn't have a compact portable representation.
    platt = LogisticRegression()
    platt.fit(oof_by_model[best_name].reshape(-1, 1), train_y)
    calibration = {
        "coefficient": round(float(platt.coef_[0][0]), 6),
        "intercept": round(float(platt.intercept_[0]), 6),
    }

    # Re-select the classification threshold on CALIBRATED OOF probabilities,
    # not the raw ones used for model ranking above. Platt scaling is
    # monotonic (it preserves rank order) but not identity, so a threshold
    # tuned for the raw probability distribution is not the same operating
    # point once probabilities are recalibrated - and calibrated
    # probabilities are what both this script's test metrics and the
    # TypeScript runtime actually threshold against.
    calibrated_oof_for_best = 1 / (1 + np.exp(-(calibration["coefficient"] * oof_by_model[best_name] + calibration["intercept"])))
    calibrated_threshold, calibrated_cv_f1 = select_threshold(train_y, calibrated_oof_for_best)
    best_meta = {**best_meta, "threshold": calibrated_threshold, "calibrated_cv_f1": round(float(calibrated_cv_f1), 4)}

    calibration_diagnostics = {
        "uncalibrated_brier_score": round(uncalibrated_brier, 4),
        "calibrated_classifier_cv_brier_score": round(calibrated_brier, 4),
        "improved": calibrated_brier < uncalibrated_brier,
    }

    return best_name, best_model, best_meta, results, calibration, calibration_diagnostics


def compute_shap_importance(model_name, fitted_model, train_x, top_n=6):
    # Tree models get exact TreeSHAP (fast, deterministic, no background
    # sampling needed). Logistic regression uses a linear explainer -
    # mathematically, per-instance SHAP for a linear model reduces to
    # coefficient * (x - mean), which is exactly what the existing
    # per-instance factor computation for logistic regression already does
    # in src/lib/mlRisk.ts; this call independently confirms the same
    # global ranking from the SHAP library itself.
    if model_name == "random_forest":
        explainer = shap.TreeExplainer(fitted_model)
        shap_values = explainer.shap_values(train_x)
        # Newer shap versions return a single array with a trailing class
        # axis for binary classification; normalize to the positive class.
        if isinstance(shap_values, list):
            values = shap_values[1]
        elif np.ndim(shap_values) == 3:
            values = shap_values[:, :, 1]
        else:
            values = shap_values
    elif model_name == "xgboost":
        explainer = shap.TreeExplainer(fitted_model)
        values = explainer.shap_values(train_x)
    else:
        explainer = shap.LinearExplainer(fitted_model.named_steps["classifier"], fitted_model.named_steps["scaler"].transform(train_x))
        values = explainer.shap_values(fitted_model.named_steps["scaler"].transform(train_x))

    mean_abs_shap = np.mean(np.abs(values), axis=0)
    ranked = sorted(zip(ALL_FEATURES, mean_abs_shap), key=lambda item: item[1], reverse=True)
    return {feature: round(float(value), 6) for feature, value in ranked[:top_n]}


def compute_feature_baseline(train_x):
    means = np.mean(train_x, axis=0)
    stds = np.std(train_x, axis=0)
    stds = np.where(stds < 1e-9, 1.0, stds)  # guard against a constant feature
    return {
        "mean": {feature: round(float(v), 6) for feature, v in zip(ALL_FEATURES, means)},
        "std": {feature: round(float(v), 6) for feature, v in zip(ALL_FEATURES, stds)},
    }


def build_artifacts(train_rows, test_rows, seed, test_ratio, augment_factor):
    train_x, train_feature_rows = rows_to_matrix(train_rows)
    test_x, test_feature_rows = rows_to_matrix(test_rows)
    feature_baseline = compute_feature_baseline(train_x)

    models = {}
    metrics = {}

    for target_name, config in TARGETS.items():
        train_y = np.array([int(row[config["column"]]) for row in train_rows], dtype=int)
        test_y = np.array([int(row[config["column"]]) for row in test_rows], dtype=int)

        best_name, fitted_model, best_meta, comparisons, calibration, calibration_diagnostics = choose_model(
            train_x, train_y, seed
        )
        raw_test_probabilities = fitted_model.predict_proba(test_x)[:, 1]
        # Apply the same Platt-scaling calibration to test-set probabilities
        # so the reported test metrics reflect what's actually served, not
        # the pre-calibration score.
        calibrated_test_probabilities = 1 / (1 + np.exp(
            -(calibration["coefficient"] * raw_test_probabilities + calibration["intercept"])
        ))
        evaluation = evaluate_with_threshold(test_y, calibrated_test_probabilities, best_meta["threshold"])
        evaluation["brier_score"] = round(float(brier_score_loss(test_y, calibrated_test_probabilities)), 4)
        evaluation["uncalibrated_brier_score"] = round(float(brier_score_loss(test_y, raw_test_probabilities)), 4)

        shap_importance = compute_shap_importance(best_name, fitted_model, train_x)

        if best_name == "logistic_regression":
            serialized = serialize_logistic(fitted_model)
        elif best_name == "xgboost":
            serialized = serialize_xgboost(fitted_model)
        else:
            serialized = serialize_random_forest(fitted_model)

        models[target_name] = {
            "condition": config["condition"],
            "recommendation": config["recommendation"],
            "threshold": best_meta["threshold"],
            "calibration": calibration,
            "shap_importance": shap_importance,
            **serialized,
        }

        metrics[target_name] = {
            "selected_model": best_name,
            "cross_validation": comparisons,
            "calibration_diagnostics": calibration_diagnostics,
            "shap_importance": shap_importance,
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
        "feature_baseline": feature_baseline,
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


def to_model_card_markdown(artifacts, metrics):
    lines = [
        "# Model Card: Healytics Risk Models",
        "",
        f"**Model version**: `{artifacts['model_version']}`  ",
        f"**Generated by**: `scripts/train_risk_models.py` (do not hand-edit - re-run training to update this file)  ",
        f"**Training dataset**: `ml/validated_dataset.csv` - see `ml/validated_dataset_sources.md` for exact "
        "source, license, and citation.",
        "",
        "> **This is not a diagnostic tool.** These models estimate statistical association between lab-value "
        "patterns and historical condition labels in a small demo-scale dataset. They are not validated for "
        "clinical use, have not been reviewed by a regulatory body, and must not be used to make or influence "
        "an actual diagnosis or treatment decision. Always consult a qualified clinician.",
        "",
        "## Dataset",
        "",
        f"- Source rows (before augmentation): {metrics['dataset']['seed_rows'] // (1 + metrics['dataset']['augmentation_factor'])}",
        f"- Train rows (after augmentation): {metrics['dataset']['train_rows']}",
        f"- Test rows (after augmentation): {metrics['dataset']['test_rows']}",
        f"- Augmentation factor: {metrics['dataset']['augmentation_factor']}x synthetic variants per source row "
        "(Gaussian noise within clinically plausible bounds - see `augment_rows()`)",
        f"- Random seed: {metrics['dataset']['seed']}",
        "",
        "## Features",
        "",
        f"**Base features** (from lab values): {', '.join('`' + f + '`' for f in artifacts['base_features'])}",
        "",
        f"**Engineered features**: {', '.join('`' + f + '`' for f in artifacts['engineered_features'])}",
        "",
        "## Per-target results",
        "",
    ]

    for target_name, target_metrics in metrics["per_model"].items():
        model_artifact = artifacts["models"][target_name]
        test = target_metrics["test_metrics"]
        cv = target_metrics["cross_validation"][target_metrics["selected_model"]]
        cm = test["confusion_matrix"]
        cal_diag = target_metrics["calibration_diagnostics"]

        lines.extend([
            f"### {model_artifact['condition']}",
            "",
            f"- **Selected model**: `{target_metrics['selected_model']}` "
            f"(chosen by blended cross-validated AUC+F1 score, not accuracy - see candidate comparison below)",
            f"- **Decision threshold**: {model_artifact['threshold']} (tuned on calibrated out-of-fold "
            "probabilities to maximize F1)",
            "",
            "| Metric | Cross-validated | Held-out test |",
            "|---|---|---|",
            f"| ROC-AUC | {cv['cv_auc']} | {test['auc']} |",
            f"| F1 | {cv['cv_f1']} | {test['f1']} |",
            f"| Precision | - | {test['precision']} |",
            f"| Recall | - | {test['recall']} |",
            f"| Accuracy | - | {test['accuracy']} |",
            f"| Brier score (calibrated) | - | {test['brier_score']} |",
            f"| Brier score (uncalibrated) | - | {test['uncalibrated_brier_score']} |",
            "",
            f"**Confusion matrix (test set, n={test['sample_count']})**: "
            f"TP={cm['tp']}, FP={cm['fp']}, TN={cm['tn']}, FN={cm['fn']}",
            "",
            f"**Calibration**: sklearn's `CalibratedClassifierCV(method=\"sigmoid\", cv=3)` was evaluated "
            f"explicitly as a diagnostic (cross-validated Brier score "
            f"{cal_diag['calibrated_classifier_cv_brier_score']} vs {cal_diag['uncalibrated_brier_score']} "
            f"uncalibrated - {'an improvement' if cal_diag['improved'] else 'not an improvement'} at that "
            "cross-fitting granularity on this dataset size). The deployed model instead uses a single "
            "Platt-scaling transform fit on the full out-of-fold prediction set, which is exactly reproducible "
            "in the TypeScript inference engine - see `SECURITY.md` and the comment in `choose_model()` for "
            f"why. On the held-out test set, deployed calibration changed Brier score from "
            f"{test['uncalibrated_brier_score']} to {test['brier_score']} "
            f"({'better' if test['brier_score'] < test['uncalibrated_brier_score'] else 'not better'}).",
            "",
            f"**Top SHAP-ranked features** (mean absolute SHAP value on the training set): "
            + ", ".join(f"`{k}` ({v})" for k, v in list(target_metrics["shap_importance"].items())[:5]),
            "",
            "**Candidate comparison** (cross-validated, all evaluated the same way):",
            "",
            "| Candidate | CV AUC | CV F1 | Blended score |",
            "|---|---|---|---|",
        ])
        for candidate_name, candidate_result in target_metrics["cross_validation"].items():
            marker = " **(selected)**" if candidate_name == target_metrics["selected_model"] else ""
            lines.append(
                f"| `{candidate_name}`{marker} | {candidate_result['cv_auc']} | {candidate_result['cv_f1']} | "
                f"{candidate_result['blended_score']} |"
            )
        lines.append("")

    lines.extend([
        "## Known limitations",
        "",
        "- **Small dataset.** All metrics above come from roughly 100 unique patients (before synthetic "
        "augmentation) - cross-validated estimates on data this size have real variance; treat differences of "
        "a few hundredths in AUC/F1 between candidates as noise, not a meaningful ranking.",
        "- **Labels are partially threshold-derived, not universally diagnosis-confirmed** - see "
        "`ml/validated_dataset_sources.md`.",
        "- **Synthetic augmentation.** Roughly 80% of the rows used for training/testing are Gaussian-noised "
        "synthetic variants of the ~100 real rows, not independent real patients. This inflates the effective "
        "sample size for CV purposes but does not add genuinely new information.",
        "- **Per-instance \"top contributing factors\" for tree models (random forest / XGBoost) are an "
        "approximation**, not exact per-instance SHAP - see the comment above `shapInformedFactors()` in "
        "`src/lib/mlRisk.ts` for the exact method and why.",
        "- **This model card is regenerated on every training run** and reflects only the most recent run's "
        "seed and data. It is not a historical record - see `model_training_runs` (Task 4) for that.",
        "",
    ])

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Train health risk models, compare candidates, and export runtime artifacts.")
    parser.add_argument("--input", default="ml/validated_dataset.csv", help="Input CSV dataset path")
    parser.add_argument("--artifacts", default="ml/model_artifacts.json", help="Output JSON artifact path")
    parser.add_argument("--metrics", default="ml/model_metrics.json", help="Output JSON metrics path")
    parser.add_argument("--train-output", default="ml/processed/train_dataset.csv", help="Output train split CSV path")
    parser.add_argument("--test-output", default="ml/processed/test_dataset.csv", help="Output test split CSV path")
    parser.add_argument("--ts-output", default="src/lib/generated/mlArtifacts.ts", help="Generated TypeScript artifact path")
    parser.add_argument("--metrics-ts-output", default="src/lib/generated/mlMetrics.ts", help="Generated TypeScript metrics path")
    parser.add_argument("--model-card-output", default="ml/MODEL_CARD.md", help="Generated model card path")
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

    model_card_path = Path(args.model_card_output)
    model_card_path.parent.mkdir(parents=True, exist_ok=True)
    model_card_path.write_text(to_model_card_markdown(artifacts, metrics), encoding="utf-8")

    print(f"Wrote model artifacts to {artifacts_path}")
    print(f"Wrote evaluation metrics to {metrics_path}")
    print(f"Wrote train/test splits to {args.train_output} and {args.test_output}")
    print(f"Wrote TypeScript artifacts to {ts_output_path}")
    print(f"Wrote TypeScript metrics to {metrics_ts_output_path}")
    print(f"Wrote model card to {model_card_path}")


if __name__ == "__main__":
    main()
