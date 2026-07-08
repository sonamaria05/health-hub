import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errorUtils';

type EnrollState =
  | { step: 'idle' }
  | { step: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { step: 'verified'; factorId: string };

export default function MfaEnrollment() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<EnrollState>({ step: 'idle' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const refreshFactors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.find((f) => f.status === 'verified');
      setState(verified ? { step: 'verified', factorId: verified.id } : { step: 'idle' });
    } catch (error: unknown) {
      toast({ title: 'Could not load 2FA status', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEnrollment = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setState({
        step: 'enrolling',
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (error: unknown) {
      toast({ title: 'Could not start 2FA enrollment', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.step !== 'enrolling') return;
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: state.factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: state.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;

      setCode('');
      toast({ title: 'Two-factor authentication enabled', description: "You'll be asked for a code the next time you sign in." });
      await refreshFactors();
    } catch (error: unknown) {
      toast({ title: 'Verification failed', description: getErrorMessage(error, 'Check the code and try again.'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    if (state.step !== 'verified') return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: state.factorId });
      if (error) throw error;
      toast({ title: 'Two-factor authentication disabled' });
      await refreshFactors();
    } catch (error: unknown) {
      toast({ title: 'Could not disable 2FA', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking two-factor status...
      </div>
    );
  }

  if (state.step === 'verified') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <p className="font-medium text-sm">Two-factor authentication is enabled</p>
        </div>
        <Button variant="outline" size="sm" onClick={disable2fa} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <ShieldOff className="w-4 h-4 mr-2" />
          Disable 2FA
        </Button>
      </div>
    );
  }

  if (state.step === 'enrolling') {
    return (
      <div className="rounded-xl border border-border p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app (e.g. Google Authenticator, 1Password),
          then enter the 6-digit code it generates.
        </p>
        <div
          className="w-40 h-40 mx-auto [&_svg]:w-full [&_svg]:h-full"
          dangerouslySetInnerHTML={{ __html: state.qrCode }}
        />
        <p className="text-xs text-muted-foreground text-center break-all">
          Can't scan? Enter this key manually: <span className="font-mono">{state.secret}</span>
        </p>
        <form onSubmit={confirmEnrollment} className="space-y-2">
          <Label htmlFor="mfa-enroll-code">6-digit code</Label>
          <Input
            id="mfa-enroll-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            required
          />
          <Button type="submit" size="sm" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Verify and enable
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Add an extra layer of security by requiring an authenticator app code at sign-in.
      </p>
      <Button variant="outline" size="sm" onClick={startEnrollment} disabled={busy}>
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Enable two-factor authentication
      </Button>
    </div>
  );
}
