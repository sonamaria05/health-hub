import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  isEmailVerified: boolean;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const loadProfile = async (nextUser: User | null) => {
      if (!nextUser) {
        setProfile(null);
        return;
      }

      const fallbackDisplayName =
        nextUser.user_metadata?.full_name ??
        nextUser.user_metadata?.display_name ??
        nextUser.email?.split('@')[0] ??
        null;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', nextUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);
        setProfile({ display_name: fallbackDisplayName, avatar_url: null });
        return;
      }

      if (data) {
        setProfile(data);
        return;
      }

      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          user_id: nextUser.id,
          display_name: fallbackDisplayName,
        })
        .select('display_name, avatar_url')
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        setProfile({ display_name: fallbackDisplayName, avatar_url: null });
        return;
      }

      setProfile(createdProfile);
    };

    const handleSession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      void loadProfile(nextSession?.user ?? null);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSession(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      handleSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) throw new Error('You must be signed in to update your profile.');

    const payload = {
      user_id: user.id,
      display_name: updates.display_name ?? profile?.display_name ?? null,
      avatar_url: updates.avatar_url ?? profile?.avatar_url ?? null,
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('display_name, avatar_url')
      .single();

    if (error) throw error;
    setProfile(data);
  };

  const resendVerification = async () => {
    if (!user?.email) throw new Error('No email address is available for verification.');

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        isEmailVerified: Boolean(user?.email_confirmed_at) || !user?.email,
        signOut,
        updateProfile,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
