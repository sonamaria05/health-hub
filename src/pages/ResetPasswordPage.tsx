import { useState, useEffect } from 'react';
import { getErrorMessage } from '@/lib/errorUtils';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const initRecovery = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const searchParams = new URLSearchParams(window.location.search);
      const isRecoveryLink =
        hashParams.get('type') === 'recovery' ||
        searchParams.get('type') === 'recovery' ||
        hashParams.has('access_token');

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error checking recovery session:', error);
      }

      setReady(Boolean(data.session) || isRecoveryLink);
    };

    void initRecovery();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated!', description: 'You can now sign in with your new password.' });
      navigate('/auth');
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <div className="text-center">
          <img src="/icon.png" alt="Healytics logo" className="w-14 h-14 rounded-2xl mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold">Set New Password</h1>
        </div>
        {!ready ? (
          <p className="text-center text-muted-foreground text-sm">Invalid or expired reset link.</p>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required minLength={6} placeholder="********" />
              </div>
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground border-0" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Update Password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
