"""
Logs a completed training run into `public.model_training_runs`, so every
retrain is auditable from the database (Task 4), not just from
`ml/model_metrics.json` on disk.

Uses the service role key directly via Supabase's REST (PostgREST) API
rather than requiring the supabase-py SDK as a dependency, to keep the
training pipeline's dependency footprint small. Run this after
train_risk_models.py, e.g.:

    python scripts/train_risk_models.py
    python scripts/log_training_run.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
If they're not set, this script prints a message and exits 0 (not an
error) - it should never be required for a local training run to succeed,
only for the CI workflow's audit trail.
"""

import json
import os
import sys
import urllib.request
from pathlib import Path


def main():
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set - skipping model_training_runs logging.")
        print("(This is expected for local `npm run ml:train` runs; CI sets these as repo secrets.)")
        return 0

    metrics_path = Path("ml/model_metrics.json")
    if not metrics_path.exists():
        print(f"error: {metrics_path} not found - run train_risk_models.py first", file=sys.stderr)
        return 1

    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    model_version = metrics["model_version"]
    dataset_size = metrics["dataset"]["train_rows"] + metrics["dataset"]["test_rows"]
    trained_by = os.environ.get("TRAINED_BY", "ci")

    rows = [
        {
            "model_version": model_version,
            "target": target,
            "metrics_json": target_metrics,
            "dataset_size": dataset_size,
            "trained_by": trained_by,
        }
        for target, target_metrics in metrics["per_model"].items()
    ]

    request = urllib.request.Request(
        url=f"{supabase_url.rstrip('/')}/rest/v1/model_training_runs",
        method="POST",
        data=json.dumps(rows).encode("utf-8"),
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            print(f"Logged {len(rows)} training run rows (HTTP {response.status})")
    except Exception as error:  # noqa: BLE001 - this is a best-effort audit step, not the critical path
        print(f"warning: failed to log training run to Supabase: {error}", file=sys.stderr)
        # Non-fatal: a failure to log the audit trail must not fail the
        # whole retraining workflow when the model artifacts themselves
        # trained and validated successfully.
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
