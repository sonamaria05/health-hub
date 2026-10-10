import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// 15 minutes of inactivity before showing warning
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
// 1 minute to respond to the warning before forceful logout
const WARNING_DURATION_MS = 60 * 1000;

export default function IdleTimeout() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_DURATION_MS / 1000);
  
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const warningTimerRef = useRef<NodeJS.Timeout>();
  const countdownIntervalRef = useRef<NodeJS.Timeout>();

  const resetTimer = () => {
    if (showWarning) return; // Do not reset if warning is actively showing

    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      startWarningCountdown();
    }, IDLE_TIMEOUT_MS);
  };

  const startWarningCountdown = () => {
    setCountdown(WARNING_DURATION_MS / 1000);
    
    warningTimerRef.current = setTimeout(() => {
      handleLogout();
    }, WARNING_DURATION_MS);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogout = async () => {
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    setShowWarning(false);
    
    try {
      await signOut();
      toast({
        title: 'Session Expired',
        description: 'You have been automatically logged out due to inactivity to protect your medical records.',
        variant: 'destructive',
      });
    } catch (e) {
      console.error('Auto-logout failed', e);
    }
  };

  const handleContinue = () => {
    clearTimeout(warningTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    setShowWarning(false);
    resetTimer();
  };

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => resetTimer();

    events.forEach(event => document.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      clearTimeout(idleTimerRef.current);
      clearTimeout(warningTimerRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, [user, showWarning]);

  if (!user) return null;

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent className="border-destructive/30">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-warning" />
            <AlertDialogTitle>Inactivity Warning</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm mt-2">
            For your security, your session will automatically expire in <strong>{countdown} seconds</strong> due to inactivity.
            <br /><br />
            Do you want to stay logged in?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleLogout} className="bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground">
            Log Out
          </AlertDialogAction>
          <AlertDialogAction onClick={handleContinue} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
