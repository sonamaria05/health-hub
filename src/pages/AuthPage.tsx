import { useState } from 'react';
import { getErrorMessage } from '@/lib/errorUtils';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const { toast } = useToast();

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode.trim(),
      });
      if (error) throw error;
      // On success, onAuthStateChange fires and AuthContext takes over.
    } catch (err: unknown) {
      toast({ title: 'Invalid code', description: getErrorMessage(err, 'Please check the code and try again.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedName = fullName.trim();

      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: 'Check your email', description: 'Password reset link has been sent.' });
        setMode('login');
      } else if (mode === 'signup') {
        if (!normalizedName) {
          throw new Error('Please enter your full name.');
        }

        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: normalizedName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: 'Check your email', description: 'Please verify your email address to continue.' });
        setPassword('');
      } else {
        const { data: locked, error: lockError } = await supabase.rpc('is_account_locked', {
          _email: normalizedEmail,
        });
        if (lockError) {
          // Fail open on infra errors so a lockout-check outage doesn't lock
          // everyone out of the app entirely; the RLS/auth layer is still
          // the real security boundary.
          console.error('Error checking account lockout status:', lockError);
        } else if (locked) {
          throw new Error('Too many failed sign-in attempts. Please try again in 15 minutes.');
        }

        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

        const { error: recordError } = await supabase.rpc('record_login_attempt', {
          _email: normalizedEmail,
          _success: !error,
          _user_agent: navigator.userAgent,
        });
        if (recordError) console.error('Error recording login attempt:', recordError);

        if (error) throw error;

        // If the account has an enrolled TOTP factor, Supabase issues an
        // aal1 session that isn't fully authenticated until a second-factor
        // challenge is completed. Detect that and show the MFA step instead
        // of letting the (incomplete) session pass through as "signed in".
        const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalError) throw aalError;

        if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
          const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) throw factorsError;

          const totpFactor = factorsData.totp.find((f) => f.status === 'verified');
          if (!totpFactor) throw new Error('MFA is required but no verified factor was found. Contact support.');

          const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
            factorId: totpFactor.id,
          });
          if (challengeError) throw challengeError;

          setMfaFactorId(totpFactor.id);
          setMfaChallengeId(challenge.id);
        }
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      const isRateLimit = msg.toLowerCase().includes('rate limit');
      toast({
        title: isRateLimit ? 'Email Rate Limit Exceeded' : 'Authentication Error',
        description: isRateLimit
          ? "Supabase free email limit reached (max 3/hr). In your Supabase Dashboard > Authentication > Providers > Email, toggle OFF 'Confirm email' to allow immediate instant sign-up without rate limits."
          : msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast({ title: 'Error', description: String(result.error), variant: 'destructive' });
      return;
    }
    if (result.redirected) return;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img src="/icon.png" alt="Healytics logo" className="w-14 h-14 rounded-2xl mx-auto mb-4" />
          <h1 className="text-3xl font-heading font-bold gradient-text">Healytics</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {mfaChallengeId ? 'Enter the 6-digit code from your authenticator app' :
             mode === 'login' ? 'Sign in to access your medical records' :
             mode === 'signup' ? 'Create your account to get started' :
             'Reset your password'}
          </p>
        </div>

        {mfaChallengeId ? (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Authentication code</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0 h-11" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Verify
              </Button>
            </form>
          </div>
        ) : (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          {mode !== 'forgot' && (
            <>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="name" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="pl-10" required />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">
                Forgot password?
              </button>
            )}

            {mode === 'forgot' && (
              <button type="button" onClick={() => setMode('login')} className="text-xs text-muted-foreground hover:text-foreground">
                ← Back to sign in
              </button>
            )}

            <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0 h-11" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </Button>
          </form>

          <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            {mode === 'login' ? (
              <span>Don't have an account? <button type="button" onClick={() => setMode('signup')} className="text-primary font-medium hover:underline">Sign up</button></span>
            ) : (
              <span>Already have an account? <button type="button" onClick={() => setMode('login')} className="text-primary font-medium hover:underline">Sign in</button></span>
            )}
          </div>
        </div>
        )}
      </motion.div>
    </div>
  );
}
