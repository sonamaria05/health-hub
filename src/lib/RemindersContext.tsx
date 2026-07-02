import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

export interface ReminderItem {
  id: string;
  title: string;
  notes?: string;
  scheduledFor: string;
  enabled: boolean;
  notifiedAt?: string;
  createdAt: string;
}

interface ReminderContextType {
  reminders: ReminderItem[];
  upcomingReminders: ReminderItem[];
  addReminder: (input: Omit<ReminderItem, 'id' | 'createdAt' | 'notifiedAt'>) => void;
  toggleReminder: (id: string, enabled: boolean) => void;
  deleteReminder: (id: string) => void;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

function sortByDate(reminders: ReminderItem[]) {
  return [...reminders].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
}

export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  const storageKey = user ? `healytics-reminders:${user.id}` : null;

  useEffect(() => {
    if (!storageKey) {
      setReminders([]);
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      setReminders(stored ? sortByDate(JSON.parse(stored) as ReminderItem[]) : []);
    } catch (error) {
      console.error('Unable to load reminders:', error);
      setReminders([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(reminders));
  }, [reminders, storageKey]);

  useEffect(() => {
    if (!reminders.length) return;

    const notifyDueReminders = () => {
      const now = Date.now();
      setReminders((current) =>
        current.map((reminder) => {
          const scheduledTime = new Date(reminder.scheduledFor).getTime();
          if (!reminder.enabled || scheduledTime > now || reminder.notifiedAt) {
            return reminder;
          }

          toast({
            title: `Reminder: ${reminder.title}`,
            description: reminder.notes || `Scheduled for ${new Date(reminder.scheduledFor).toLocaleString()}`,
          });

          return { ...reminder, notifiedAt: new Date().toISOString() };
        }),
      );
    };

    notifyDueReminders();
    const intervalId = window.setInterval(notifyDueReminders, 60_000);
    return () => window.clearInterval(intervalId);
  }, [reminders]);

  const addReminder = useCallback((input: Omit<ReminderItem, 'id' | 'createdAt' | 'notifiedAt'>) => {
    setReminders((current) =>
      sortByDate([
        ...current,
        {
          ...input,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        },
      ]),
    );
  }, []);

  const toggleReminder = useCallback((id: string, enabled: boolean) => {
    setReminders((current) =>
      current.map((reminder) =>
        reminder.id === id
          ? {
              ...reminder,
              enabled,
              notifiedAt: enabled ? undefined : reminder.notifiedAt,
            }
          : reminder,
      ),
    );
  }, []);

  const deleteReminder = useCallback((id: string) => {
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
  }, []);

  const upcomingReminders = useMemo(
    () => reminders.filter((reminder) => reminder.enabled && new Date(reminder.scheduledFor).getTime() >= Date.now()).slice(0, 3),
    [reminders],
  );

  return (
    <ReminderContext.Provider value={{ reminders, upcomingReminders, addReminder, toggleReminder, deleteReminder }}>
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) throw new Error('useReminders must be used within RemindersProvider');
  return context;
}
