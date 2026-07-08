export default function ClinicianDashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-heading font-semibold">Clinician Dashboard</h1>
      <p className="text-muted-foreground mt-2 max-w-lg">
        This is a placeholder. The full clinician workflow - patient list, per-patient
        record review, and ML prediction review/approval - is built out separately.
        This page exists now to demonstrate that role-gated routing (RequireRole)
        works end-to-end.
      </p>
    </div>
  );
}
