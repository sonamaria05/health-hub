import { useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/errorUtils';
import { BarChart3, Bell, BellPlus, Loader2, LogOut, MailCheck, Monitor, Moon, ShieldCheck, Sun, Trash2, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useReminders } from '@/lib/RemindersContext';
import MfaEnrollment from '@/components/MfaEnrollment';
import MyActivity from '@/components/MyActivity';
import DeleteAccount from '@/components/DeleteAccount';

export default function SettingsPage() {
  const { user, profile, updateProfile, resendVerification, isEmailVerified, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { reminders, addReminder, toggleReminder, deleteReminder } = useReminders();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderNotes, setReminderNotes] = useState('');
  const [notifAbnormalResults, setNotifAbnormalResults] = useState(() => localStorage.getItem('healytics_notif_abnormal') !== 'false');
  const [notifUploadConfirm, setNotifUploadConfirm] = useState(() => localStorage.getItem('healytics_notif_upload') !== 'false');
  const [notifReminders, setNotifReminders] = useState(() => localStorage.getItem('healytics_notif_reminders') !== 'false');
  const [analyticsOptIn, setAnalyticsOptIn] = useState(profile?.analytics_opt_in ?? false);
  const { toast } = useToast();

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
    setAnalyticsOptIn(profile?.analytics_opt_in ?? false);
  }, [profile?.display_name, profile?.analytics_opt_in]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await updateProfile({ display_name: displayName.trim() || null });
      toast({ title: 'Profile updated', description: 'Your account details were saved.' });
    } catch (error: unknown) {
      toast({
        title: 'Update failed',
        description: getErrorMessage(error, 'We could not save your profile changes.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResendVerification = async () => {
    setSendingVerification(true);
    try {
      await resendVerification();
      toast({ title: 'Verification email sent', description: 'Check your inbox for a new verification link.' });
    } catch (error: unknown) {
      toast({
        title: 'Could not send verification email',
        description: getErrorMessage(error, 'Please try again in a moment.'),
        variant: 'destructive',
      });
    } finally {
      setSendingVerification(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    setSigningOutEverywhere(true);
    try {
      await signOut('global');
      toast({ title: 'Signed out everywhere', description: 'All your active sessions have been revoked.' });
    } catch (error: unknown) {
      toast({
        title: 'Could not sign out of all devices',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSigningOutEverywhere(false);
    }
  };

  const handleAddReminder = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reminderTitle.trim() || !reminderTime) {
      toast({ title: 'Reminder incomplete', description: 'Add a title and date/time for the reminder.', variant: 'destructive' });
      return;
    }

    addReminder({
      title: reminderTitle.trim(),
      notes: reminderNotes.trim() || undefined,
      scheduledFor: new Date(reminderTime).toISOString(),
      enabled: true,
    });

    setReminderTitle('');
    setReminderTime('');
    setReminderNotes('');
    toast({ title: 'Reminder added', description: 'We will notify you when it is due while the app is open.' });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and account security details.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserRound className="w-5 h-5 text-primary" />
            <h2 className="font-heading font-semibold">Profile</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              placeholder="Enter the name shown across the app"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-address">Email</Label>
            <Input id="email-address" value={user?.email ?? ''} disabled />
          </div>

          <Button type="submit" className="gradient-primary text-primary-foreground border-0" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Profile
          </Button>
        </form>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold">Appearance</h2>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose how the app looks.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`rounded-xl border p-4 text-left transition-colors ${theme !== 'dark' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'}`}
                >
                  <Sun className="w-4 h-4 text-primary mb-2" />
                  <p className="text-sm font-medium">Light</p>
                  <p className="text-xs text-muted-foreground mt-1">Bright default appearance.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`rounded-xl border p-4 text-left transition-colors ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/50'}`}
                >
                  <Moon className="w-4 h-4 text-primary mb-2" />
                  <p className="text-sm font-medium">Dark</p>
                  <p className="text-xs text-muted-foreground mt-1">Lower-light viewing mode.</p>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold">Notification Preferences</h2>
            </div>
            <p className="text-sm text-muted-foreground">Choose which in-app notifications you receive.</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-abnormal">Abnormal results alerts</Label>
                  <p className="text-xs text-muted-foreground">Get notified when extraction flags out-of-range values.</p>
                </div>
                <Switch id="notif-abnormal" checked={notifAbnormalResults} onCheckedChange={v => { setNotifAbnormalResults(v); localStorage.setItem('healytics_notif_abnormal', String(v)); }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-upload">Upload confirmations</Label>
                  <p className="text-xs text-muted-foreground">Show a notification after each successful upload.</p>
                </div>
                <Switch id="notif-upload" checked={notifUploadConfirm} onCheckedChange={v => { setNotifUploadConfirm(v); localStorage.setItem('healytics_notif_upload', String(v)); }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-reminders">Reminder alerts</Label>
                  <p className="text-xs text-muted-foreground">Receive alerts when a health reminder is due.</p>
                </div>
                <Switch id="notif-reminders" checked={notifReminders} onCheckedChange={v => { setNotifReminders(v); localStorage.setItem('healytics_notif_reminders', String(v)); }} />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold">Analytics</h2>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="analytics-opt-in">Usage analytics</Label>
                <p className="text-xs text-muted-foreground">Help improve Healytics by sharing anonymous usage data. No medical data is ever shared.</p>
              </div>
              <Switch
                id="analytics-opt-in"
                checked={analyticsOptIn}
                onCheckedChange={async (v) => {
                  setAnalyticsOptIn(v);
                  try {
                    await updateProfile({ analytics_opt_in: v });
                  } catch {
                    setAnalyticsOptIn(!v);
                    toast({ title: 'Could not update preference', variant: 'destructive' });
                  }
                }}
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BellPlus className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold">Reminders</h2>
            </div>

            <form onSubmit={handleAddReminder} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reminder-title">Reminder Title</Label>
                <Input id="reminder-title" value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="Example: Repeat HbA1c test" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder-time">When</Label>
                <Input id="reminder-time" type="datetime-local" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder-notes">Notes</Label>
                <Textarea id="reminder-notes" value={reminderNotes} onChange={(event) => setReminderNotes(event.target.value)} placeholder="Medication details, prep instructions, or follow-up notes." />
              </div>

              <Button type="submit" variant="outline">Add Reminder</Button>
            </form>

            <div className="space-y-3">
              {reminders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reminders yet. Add one above to start receiving in-app notifications.</p>
              ) : (
                reminders.map((reminder) => (
                  <div key={reminder.id} className="rounded-xl border border-border p-4 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{reminder.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(reminder.scheduledFor).toLocaleString()}</p>
                      {reminder.notes && <p className="text-xs text-muted-foreground">{reminder.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleReminder(reminder.id, !reminder.enabled)}>
                        {reminder.enabled ? 'Pause' : 'Enable'}
                      </Button>
                      <Button type="button" variant="outline" size="icon" onClick={() => deleteReminder(reminder.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-heading font-semibold">Security</h2>
          </div>

          <div className={`rounded-xl border p-4 ${isEmailVerified ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
            <div className="flex items-center gap-2">
              <MailCheck className="w-4 h-4" />
              <p className="font-medium text-sm">{isEmailVerified ? 'Email verified' : 'Email verification pending'}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {isEmailVerified
                ? 'Your email is verified and ready for production account flows.'
                : 'Verify your email so password recovery and account security work reliably.'}
            </p>
          </div>

          {!isEmailVerified && (
            <Button variant="outline" onClick={handleResendVerification} disabled={sendingVerification}>
              {sendingVerification && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Resend Verification Email
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Password resets are available from the sign-in page. For production, keep email verification enabled in Supabase auth settings.
          </p>

          <MfaEnrollment />

          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-medium">Sessions</p>
            <p className="text-sm text-muted-foreground">
              Signed in on a device you don't recognize? Sign out everywhere to revoke all active sessions,
              including this one.
            </p>
            <Button variant="outline" size="sm" onClick={handleSignOutEverywhere} disabled={signingOutEverywhere}>
              {signingOutEverywhere ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
              Sign out of all devices
            </Button>
          </div>

          <MyActivity />

          <DeleteAccount />
          </div>
        </div>
      </div>
    </div>
  );
}
