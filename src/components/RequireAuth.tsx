import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import EmailVerificationRequired from '@/components/EmailVerificationRequired';

function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * Requires a signed-in, email-verified session. Unauthenticated users are
 * redirected to /auth (preserving the originally requested location so we
 * can send them back after they sign in). This is a UI-layer convenience
 * only - it does not substitute for RLS/has_role() checks at the database
 * layer, which remain the actual enforcement boundary.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, isEmailVerified } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (!isEmailVerified) {
    return <EmailVerificationRequired />;
  }

  return <>{children}</>;
}
