import argparse
import csv
from pathlib import Path


TARGET_COLUMNS = [
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


def main():
    parser = argparse.ArgumentParser(description="Normalize an externally curated medical dataset into the Healytics risk-model schema.")
    parser.add_argument("--input", required=True, help="Source CSV path")
    parser.add_argument("--output", default="ml/validated_dataset.csv", help="Normalized output CSV path")
    parser.add_argument(
        "--map",
        action="append",
        default=[],
        help="Column mapping in the form target=source. Example: hemoglobin=hb_value",
    )
    args = parser.parse_args()

    mappings = {}
    for item in args.map:
      target, source = item.split("=", 1)
      mappings[target] = source

    with Path(args.input).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=TARGET_COLUMNS)
        writer.writeheader()

        for row in rows:
            normalized = {}
            for column in TARGET_COLUMNS:
                source_column = mappings.get(column, column)
                normalized[column] = row.get(source_column, "")
            writer.writerow(normalized)

    print(f"Wrote normalized validated dataset to {output_path}")


if __name__ == "__main__":
    main()
