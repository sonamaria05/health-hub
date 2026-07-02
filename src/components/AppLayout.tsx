import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Upload, FolderOpen, TrendingUp, Brain, Menu, X, LogOut, Settings, MailWarning,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/records', icon: FolderOpen, label: 'Records' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { to: '/predictions', icon: Brain, label: 'Insights' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const location = useLocation();
  const { user, profile, signOut, isEmailVerified, resendVerification } = useAuth();
  const { toast } = useToast();

  const displayName = profile?.display_name || user?.email || 'Patient';
  const initials = displayName.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2);

  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      await resendVerification();
      toast({ title: 'Verification email sent', description: 'Check your inbox for the new link.' });
    } catch (error: any) {
      toast({
        title: 'Could not send verification email',
        description: error.message || 'Please try again shortly.',
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
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
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
            onClick={signOut}
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
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-muted">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0, x: -280 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -280 }}
            className="md:hidden fixed inset-0 z-50 bg-card/95 backdrop-blur-sm p-6 pt-16"
          >
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 p-2">
              <X className="w-5 h-5" />
            </button>
            <nav className="flex flex-col gap-2 mt-4">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={signOut}
              className="flex items-center gap-2 mt-6 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-muted w-full"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4 md:p-8 max-w-7xl mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
