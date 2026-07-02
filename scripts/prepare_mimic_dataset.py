import argparse
import csv
import gzip
import statistics
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path


FEATURE_ITEMIDS = {
    "hemoglobin": [51222],
    "fasting_glucose": [50931, 50809, 52027],
    "total_cholesterol": [50907],
    "creatinine": [50912, 52546, 52024],
    "hba1c": [50852, 50854, 51631],
    "ldl_cholesterol": [50905, 50906],
    "triglycerides": [51000],
}

FEATURE_ORDER = [
    "hemoglobin",
    "fasting_glucose",
    "total_cholesterol",
    "creatinine",
    "hba1c",
    "ldl_cholesterol",
    "triglycerides",
]

DEFAULT_THRESHOLDS = {
    "hemoglobin": (12.0, 16.0),
    "fasting_glucose": (70.0, 100.0),
    "total_cholesterol": (0.0, 200.0),
    "creatinine": (0.6, 1.2),
    "hba1c": (0.0, 5.7),
    "ldl_cholesterol": (0.0, 100.0),
    "triglycerides": (0.0, 150.0),
}

ICD9_GROUPS = {
    "anemia": ("280", "281", "282", "283", "284", "285"),
    "diabetes": ("250",),
    "cardiovascular": ("401", "402", "403", "404", "410", "411", "412", "413", "414", "427", "428"),
    "kidney": ("403", "404", "584", "585", "586"),
}

ICD10_GROUPS = {
    "anemia": ("D50", "D51", "D52", "D53", "D55", "D56", "D57", "D58", "D59", "D60", "D61", "D62", "D63", "D64"),
    "diabetes": ("E08", "E09", "E10", "E11", "E13"),
    "cardiovascular": ("I10", "I11", "I12", "I13", "I20", "I21", "I22", "I23", "I24", "I25", "I48", "I50", "E78"),
    "kidney": ("N17", "N18", "N19", "I12", "I13"),
}


def parse_datetime(value: str):
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")


def open_csv_from_zip(zip_file: zipfile.ZipFile, name: str):
    raw = zip_file.open(name)
    return gzip.open(raw, "rt", encoding="utf-8", newline="")


def read_patients(zip_file: zipfile.ZipFile, root: str):
    patients = {}
    with open_csv_from_zip(zip_file, f"{root}/hosp/patients.csv.gz") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            patients[row["subject_id"]] = row
    return patients


def latest_numeric_lab_records(zip_file: zipfile.ZipFile, root: str):
    itemid_to_feature = {}
    for feature, itemids in FEATURE_ITEMIDS.items():
        for itemid in itemids:
            itemid_to_feature[itemid] = feature

    latest = {}
    encounter_counts = defaultdict(set)
    observed_values = defaultdict(list)

    with open_csv_from_zip(zip_file, f"{root}/hosp/labevents.csv.gz") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            valuenum = row.get("valuenum")
            if not valuenum:
                continue

            itemid = int(row["itemid"])
            feature = itemid_to_feature.get(itemid)
            if not feature:
                continue

            subject_id = row["subject_id"]
            observed_values[feature].append(float(valuenum))
            charttime = parse_datetime(row.get("charttime", ""))
            key = (subject_id, feature)

            current = latest.get(key)
            if current is None or (charttime and current["charttime"] and charttime > current["charttime"]) or (
                charttime and current["charttime"] is None
            ):
                latest[key] = {
                    "subject_id": subject_id,
                    "hadm_id": row.get("hadm_id") or "",
                    "charttime": charttime,
                    "value": float(valuenum),
                }

            if row.get("hadm_id"):
                encounter_counts[subject_id].add(row["hadm_id"])

    medians = {
        feature: statistics.median(values)
        for feature, values in observed_values.items()
        if values
    }

    return latest, encounter_counts, medians


def load_diagnosis_flags(zip_file: zipfile.ZipFile, root: str):
    subject_flags = defaultdict(lambda: {label: 0 for label in ICD9_GROUPS})

    with open_csv_from_zip(zip_file, f"{root}/hosp/diagnoses_icd.csv.gz") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            code = (row.get("icd_code") or "").strip().upper()
            if not code:
                continue

            groups = ICD9_GROUPS if row.get("icd_version") == "9" else ICD10_GROUPS
            subject_id = row["subject_id"]

            for label, prefixes in groups.items():
                if code.startswith(prefixes):
                    subject_flags[subject_id][label] = 1

    return subject_flags


def determine_abnormal_ratio(values):
    abnormal = 0
    total = 0
    for feature in FEATURE_ORDER:
        value = values[feature]
        low, high = DEFAULT_THRESHOLDS[feature]
        total += 1
        if value < low or value > high:
            abnormal += 1
    return abnormal / total if total else 0.0


def build_row(subject_id, patients, latest, encounter_counts, medians, diagnosis_flags, label_mode):
    values = {}
    latest_date = None

    for feature in FEATURE_ORDER:
        entry = latest.get((subject_id, feature))
        if entry is not None:
            values[feature] = entry["value"]
            if entry["charttime"] and (latest_date is None or entry["charttime"] > latest_date):
                latest_date = entry["charttime"]
        else:
            values[feature] = float(medians[feature])

    abnormal_ratio = determine_abnormal_ratio(values)
    record_count = max(len(encounter_counts.get(subject_id, set())), 1)
    encounter_date = latest_date.strftime("%Y-%m-%d") if latest_date else f"{patients[subject_id]['anchor_year']}-01-01"

    threshold_labels = {
        "anemia_label": int(values["hemoglobin"] < 12.0),
        "diabetes_label": int(values["fasting_glucose"] > 100.0 or values["hba1c"] > 5.7),
        "cardiovascular_label": int(
            values["total_cholesterol"] > 200.0
            or values["ldl_cholesterol"] > 100.0
            or values["triglycerides"] > 150.0
        ),
        "kidney_label": int(values["creatinine"] > 1.2),
    }

    diagnosis_based = diagnosis_flags.get(subject_id, {})
    resolved_labels = {}
    for short_name, field_name in [
        ("anemia", "anemia_label"),
        ("diabetes", "diabetes_label"),
        ("cardiovascular", "cardiovascular_label"),
        ("kidney", "kidney_label"),
    ]:
        if label_mode == "thresholds":
            resolved_labels[field_name] = threshold_labels[field_name]
        elif label_mode == "diagnoses":
            resolved_labels[field_name] = int(diagnosis_based.get(short_name, 0))
        else:
            resolved_labels[field_name] = int(diagnosis_based.get(short_name, 0) or threshold_labels[field_name])

    return {
        "patient_id": f"MIMIC-{subject_id}",
        "encounter_date": encounter_date,
        "hemoglobin": round(values["hemoglobin"], 4),
        "fasting_glucose": round(values["fasting_glucose"], 4),
        "total_cholesterol": round(values["total_cholesterol"], 4),
        "creatinine": round(values["creatinine"], 4),
        "hba1c": round(values["hba1c"], 4),
        "ldl_cholesterol": round(values["ldl_cholesterol"], 4),
        "triglycerides": round(values["triglycerides"], 4),
        "abnormal_ratio": round(abnormal_ratio, 4),
        "record_count": record_count,
        **resolved_labels,
    }


def main():
    parser = argparse.ArgumentParser(description="Prepare a Healytics training dataset from the MIMIC-IV demo zip.")
    parser.add_argument("--input-zip", required=True, help="Path to mimic-iv-clinical-database-demo-2.2.zip")
    parser.add_argument("--output", default="ml/validated_dataset.csv", help="Output CSV path")
    parser.add_argument(
        "--label-mode",
        choices=["hybrid", "diagnoses", "thresholds"],
        default="hybrid",
        help="Use diagnosis-based labels, threshold-derived labels, or hybrid labeling.",
    )
    args = parser.parse_args()

    zip_path = Path(args.input_zip)
    if not zip_path.exists():
      raise FileNotFoundError(f"Zip file not found: {zip_path}")

    root_name = zip_path.stem

    with zipfile.ZipFile(zip_path) as zip_file:
        patients = read_patients(zip_file, root_name)
        latest, encounter_counts, medians = latest_numeric_lab_records(zip_file, root_name)
        diagnosis_flags = load_diagnosis_flags(zip_file, root_name)

    required_medians = [feature for feature in FEATURE_ORDER if feature not in medians]
    if required_medians:
        raise ValueError(f"Could not derive enough values for: {', '.join(required_medians)}")

    rows = [
        build_row(subject_id, patients, latest, encounter_counts, medians, diagnosis_flags, args.label_mode)
        for subject_id in sorted(patients.keys(), key=int)
    ]

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "patient_id",
        "encounter_date",
        "hemoglobin",
        "fasting_glucose",
        "total_cholesterol",
        "creatinine",
        "hba1c",
        "ldl_cholesterol",
        "triglycerides",
        "abnormal_ratio",
        "record_count",
        "anemia_label",
        "diabetes_label",
        "cardiovascular_label",
        "kidney_label",
    ]
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} MIMIC-derived rows to {output_path}")
    print(f"Label mode: {args.label_mode}")
    print("Median fallbacks used for sparse features:")
    for feature in FEATURE_ORDER:
        print(f"  {feature}: {medians[feature]:.4f}")


if __name__ == "__main__":
    main()
