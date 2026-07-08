import { useState } from 'react';
import { MailCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errorUtils';

export default function EmailVerificationRequired() {
  const { user, resendVerification, signOut } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      await resendVerification();
      toast({ title: 'Verification email sent', description: 'Check your inbox for the new link.' });
    } catch (error: unknown) {
      toast({
        title: 'Could not send verification email',
        description: getErrorMessage(error, 'Please try again shortly.'),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center gap-4 p-6 bg-background">
      <MailCheck className="w-12 h-12 text-primary" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-heading font-semibold">Verify your email</h1>
        <p className="text-muted-foreground mt-1 max-w-sm">
          We sent a verification link to <span className="font-medium text-foreground">{user?.email}</span>.
          You need to verify your email before you can access your medical records.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={handleResend} disabled={sending}>
          {sending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Resend verification email
        </Button>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
