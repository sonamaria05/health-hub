import { useState } from 'react';
import { getErrorMessage } from '@/lib/errorUtils';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Upload, FolderOpen, TrendingUp, Brain, Menu, LogOut, Settings, MailWarning, Stethoscope,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useMotionPreset } from '@/lib/motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';

const primaryNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/records', icon: FolderOpen, label: 'Records' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
];

// Shown in the desktop sidebar (all of these) and inside the mobile "More"
// sheet (bottom bar only has room for 4 primary items + More).
const secondaryNavItems = [
  { to: '/predictions', icon: Brain, label: 'Insights' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const location = useLocation();
  const { user, profile, signOut, isEmailVerified, resendVerification, hasRole } = useAuth();
  const { toast } = useToast();
  const { pageTransition } = useMotionPreset();

  const displayName = profile?.display_name || user?.email || 'Patient';
  const initials = displayName.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2);
  const isClinicianOrAdmin = hasRole('clinician') || hasRole('admin');

  const clinicianNavItem = { to: '/clinician', icon: Stethoscope, label: 'Clinician' };
  const desktopNavItems = isClinicianOrAdmin
    ? [...primaryNavItems, clinicianNavItem, ...secondaryNavItems]
    : [...primaryNavItems, ...secondaryNavItems];
  const moreSheetItems = isClinicianOrAdmin
    ? [...secondaryNavItems, clinicianNavItem]
    : secondaryNavItems;

  const handleResendVerification = async () => {
    setSendingVerification(true);
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
      setSendingVerification(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card p-6 gap-2 fixed h-full z-30">
        <div className="flex items-center gap-2 mb-8">
          <img src="/favicon.svg" alt="Healytics logo" className="w-9 h-9 rounded-lg" />
          <h1 className="font-heading text-xl font-bold gradient-text">Healytics</h1>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {desktopNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button
           onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Healytics logo" className="w-8 h-8 rounded-lg" />
          <span className="font-heading font-bold gradient-text">Healytics</span>
        </div>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
      </div>

      {/* Mobile bottom tab bar: thumb-reachable primary nav, with a "More"
          sheet for the remaining items (Insights, Settings, and Clinician
          when applicable) rather than squeezing everything into 5+ tabs. */}
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
      >
        {primaryNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors
              ${isActive ? 'text-primary' : 'text-muted-foreground'}`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors
                ${moreSheetItems.some(item => item.to === location.pathname) ? 'text-primary' : 'text-muted-foreground'}`}
              aria-label="More navigation options"
            >
              <Menu className="w-5 h-5" />
              More
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <SheetTitle className="text-left font-heading">More</SheetTitle>
            <nav className="flex flex-col gap-1 mt-4">
              {moreSheetItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={() => {
                  setMoreOpen(false);
                  signOut();
                }}
                className="flex items-center gap-3 mt-2 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-muted w-full"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>

      <main className="flex-1 md:ml-64 pt-16 pb-20 md:pb-0 md:pt-0">
        {!isEmailVerified && (
          <div className="border-b border-amber-200 bg-amber-50 text-amber-900 px-4 md:px-8 py-3">
            <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-2">
                <MailWarning className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">
                  Verify your email address to unlock a safer production account flow and reliable password recovery.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleResendVerification} disabled={sendingVerification}>
                {sendingVerification ? 'Sending...' : 'Resend Verification'}
              </Button>
            </div>
          </div>
        )}

        <motion.div
          key={location.pathname}
          initial={pageTransition.initial}
          animate={pageTransition.animate}
          className="p-4 md:p-8 max-w-7xl mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
