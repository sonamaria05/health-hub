import zipfile, sys
from scripts.prepare_mimic_dataset import read_patients, latest_numeric_lab_records, load_diagnosis_flags, FEATURE_ORDER, ICD9_GROUPS, ICD10_GROUPS

zip_path = "mimic-iv-clinical-database-demo-2.2.zip"
root_name = "mimic-iv-clinical-database-demo-2.2"

with zipfile.ZipFile(zip_path) as zip_file:
    patients = read_patients(zip_file, root_name)
    latest, encounter_counts, medians = latest_numeric_lab_records(zip_file, root_name)
    diagnosis_flags = load_diagnosis_flags(zip_file, root_name)

print("MEDIANS:", medians)

imputation_counts = {f: 0 for f in FEATURE_ORDER}
for subject_id in patients:
    for f in FEATURE_ORDER:
        if (subject_id, f) not in latest:
            imputation_counts[f] += 1

print("\nIMPUTATION COUNTS (out of 100):")
for f in FEATURE_ORDER:
    print(f"{f}: {100 - imputation_counts[f]} real, {imputation_counts[f]} imputed (Median: {medians[f]})")

diag_only = {target: 0 for target in ["anemia", "diabetes", "cardiovascular", "kidney"]}
thresh_only = {target: 0 for target in ["anemia", "diabetes", "cardiovascular", "kidney"]}
both = {target: 0 for target in ["anemia", "diabetes", "cardiovascular", "kidney"]}
none = {target: 0 for target in ["anemia", "diabetes", "cardiovascular", "kidney"]}

for subject_id in patients:
    values = {}
    for f in FEATURE_ORDER:
        entry = latest.get((subject_id, f))
        if entry is not None: values[f] = entry["value"]
        else: values[f] = medians[f]
    
    thresh = {
        "anemia": int(values["hemoglobin"] < 13.0),
        "diabetes": int(values["fasting_glucose"] >= 126.0 or values["hba1c"] >= 6.5),
        "cardiovascular": int(values["total_cholesterol"] >= 240.0 or values["ldl_cholesterol"] >= 160.0),
        "kidney": int(values["creatinine"] >= 1.3),
    }
    
    diag = diagnosis_flags.get(subject_id, {})
    
    for t in diag_only.keys():
        d_val = int(diag.get(t, 0))
        t_val = thresh[t]
        
        if d_val and not t_val:
            diag_only[t] += 1
        elif not d_val and t_val:
            thresh_only[t] += 1
        elif d_val and t_val:
            both[t] += 1
        else:
            none[t] += 1

print("\nLABEL SOURCES (out of 100):")
for t in diag_only.keys():
    print(f"{t}: Diag Only: {diag_only[t]}, Thresh Only: {thresh_only[t]}, Both: {both[t]}, None: {none[t]}")

