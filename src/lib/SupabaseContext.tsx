import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserProfile } from '../types';

interface SupabaseContextType {
  user: User | null;
  loading: boolean;
  userProfile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (data) {
        const profile: UserProfile = {
          uid: data.id,
          fullName: data.full_name || '',
          email: data.email || '',
          businessName: data.business_name || undefined,
          businessType: data.business_type || undefined,
          province: data.province || undefined,
          originCity: data.origin_city || undefined,
          aiLang: data.ai_lang || undefined,
          aiStyle: data.ai_style || undefined,
          aiTone: data.ai_tone || undefined,
          aiDepth: data.ai_depth || undefined,
          notificationsEnabled: data.notifications_enabled,
          emailDigestEnabled: data.email_digest_enabled,
          isLoggedIn: true,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          onboardingStatus: data.onboarding_status || 'incomplete',
          emailVerified: data.email_verified,
          isSuspended: data.is_suspended,
        };
        return profile;
      }
      return null;
    } catch (e) {
      console.error('Exception fetching profile:', e);
      return null;
    }
  };

  const createInitialProfile = async (currUser: User) => {
    const newProfile: UserProfile = {
      uid: currUser.id,
      fullName: currUser.user_metadata?.full_name || currUser.email?.split('@')[0] || 'New User',
      email: currUser.email || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      onboardingStatus: 'incomplete',
      isSuspended: false,
    };

    try {
      await supabase.from('profiles').upsert({
        id: currUser.id,
        full_name: newProfile.fullName,
        email: newProfile.email,
        onboarding_status: 'incomplete',
        is_suspended: false,
        created_at: newProfile.createdAt,
        updated_at: newProfile.updatedAt,
      });
      return newProfile;
    } catch (e) {
      console.error('Initial profile creation fallback failed:', e);
      return newProfile;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchProfile(user.id);
      if (profile) {
        setUserProfile(profile);
        localStorage.setItem('yora_user_profile_' + user.id, JSON.stringify(profile));
      }
    }
  };

  const reloadUser = async () => {
    const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();
    if (!error && refreshedUser) {
      setUser(refreshedUser);
    }
  };

  useEffect(() => {
    let active = true;

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const cached = localStorage.getItem('yora_user_profile_' + currentUser.id);
        if (cached) {
          try {
            setUserProfile(JSON.parse(cached));
          } catch (e) {
            console.warn('Cache parse error:', e);
          }
        }
        // Fetch to sync up
        fetchProfile(currentUser.id).then((profile) => {
          if (active && profile) {
            setUserProfile(profile);
            localStorage.setItem('yora_user_profile_' + currentUser.id, JSON.stringify(profile));
          }
        });
      }
      setLoading(false);
    });

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const cached = localStorage.getItem('yora_user_profile_' + currentUser.id);
        if (cached) {
          try {
            setUserProfile(JSON.parse(cached));
          } catch (e) {
            console.warn('Cache parse error:', e);
          }
        }

        // Fetch or create profile
        let profile = await fetchProfile(currentUser.id);
        if (!profile) {
          profile = await createInitialProfile(currentUser);
        }
        if (active) {
          setUserProfile(profile);
          localStorage.setItem('yora_user_profile_' + currentUser.id, JSON.stringify(profile));
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Real-time listener on profile updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          if (payload.new) {
            const data = payload.new as any;
            const updatedProfile: UserProfile = {
              uid: data.id,
              fullName: data.full_name || '',
              email: data.email || '',
              businessName: data.business_name || undefined,
              businessType: data.business_type || undefined,
              province: data.province || undefined,
              originCity: data.origin_city || undefined,
              aiLang: data.ai_lang || undefined,
              aiStyle: data.ai_style || undefined,
              aiTone: data.ai_tone || undefined,
              aiDepth: data.ai_depth || undefined,
              notificationsEnabled: data.notifications_enabled,
              emailDigestEnabled: data.email_digest_enabled,
              isLoggedIn: true,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
              onboardingStatus: data.onboarding_status || 'incomplete',
              emailVerified: data.email_verified,
              isSuspended: data.is_suspended,
            };
            setUserProfile(updatedProfile);
            localStorage.setItem('yora_user_profile_' + user.id, JSON.stringify(updatedProfile));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <SupabaseContext.Provider
      value={{
        user,
        loading,
        userProfile,
        refreshProfile,
        reloadUser,
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}
