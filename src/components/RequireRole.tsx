import { Loader2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export function Forbidden() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 p-6">
      <ShieldAlert className="w-12 h-12 text-destructive" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-heading font-semibold">Access denied</h1>
        <p className="text-muted-foreground mt-1 max-w-sm">
          You don't have permission to view this page. If you believe this is a mistake,
          contact your administrator.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}

/**
 * Requires the signed-in user to hold at least one of `allow`. Must be
 * nested inside <RequireAuth>. Renders a clean in-app 403 (via <Forbidden />)
 * rather than redirecting, so a clinician/admin-only page fails visibly in
 * the UI instead of silently bouncing the user elsewhere.
 *
 * As with RequireAuth, this is a UX layer only - the actual authorization
 * boundary is enforced by RLS policies using has_role() in Postgres.
 */
export default function RequireRole({
  allow,
  children,
}: {
  allow: AppRole[];
  children: React.ReactNode;
}) {
  const { rolesLoading, hasRole } = useAuth();

  if (rolesLoading) return <FullScreenSpinner />;

  const allowed = allow.some((role) => hasRole(role));
  if (!allowed) return <Forbidden />;

  return <>{children}</>;
}
