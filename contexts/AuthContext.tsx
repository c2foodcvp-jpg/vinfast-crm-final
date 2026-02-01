
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, UserRole } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isMod: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session with error handling
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        setSession(session);
        if (session) {
          await fetchProfile(session.user.id, session.user.email);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Auth initialization failed (Network or Config error):", error);
        // Ensure we stop loading so the app doesn't freeze on white screen
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id, session.user.email);
      } else {
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, is_consultant_mode')
        .eq('id', userId)
        .single();

      const isSuperAdmin = email === 'cskh.vinfasthcm@gmail.com';

      if (error || !data) {
        console.warn('Profile not found, using fallback or creating...');
        setUserProfile({
          id: userId,
          email: email || '',
          full_name: session?.user?.user_metadata?.full_name || 'Người dùng',
          role: isSuperAdmin ? UserRole.ADMIN : UserRole.EMPLOYEE,
          status: isSuperAdmin ? 'active' : 'pending'
        });
      } else {
        if (isSuperAdmin && (data.role !== UserRole.ADMIN || data.status !== 'active')) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: UserRole.ADMIN, status: 'active' })
            .eq('id', userId);

          if (!updateError) {
            data.role = UserRole.ADMIN;
            data.status = 'active';
          }
        }

        // --- NEW: Check Last Login & Lock Logic ---
        const now = new Date();
        const lastLogin = data.last_login_at ? new Date(data.last_login_at) : null;
        const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

        // Apply to Sales (Employees)
        if (data.role === UserRole.EMPLOYEE && lastLogin) {
          if (now.getTime() - lastLogin.getTime() > FIVE_DAYS) {
            // Lock functionalities
            const updates = { is_locked_add: true, is_locked_view: true };
            await supabase.from('profiles').update(updates).eq('id', userId);
            data.is_locked_add = true;
            data.is_locked_view = true;
          }
        }

        // Update Last Login
        await supabase.from('profiles').update({ last_login_at: now.toISOString() }).eq('id', userId);

        // --- NEW: Team Expiration Check ---
        let isExpired = false;
        if (data.role === UserRole.MOD && data.team_expiration_date) {
          if (now > new Date(data.team_expiration_date)) isExpired = true;
        } else if (data.role === UserRole.EMPLOYEE && data.manager_id) {
          const { data: manager } = await supabase.from('profiles').select('team_expiration_date').eq('id', data.manager_id).maybeSingle();
          if (manager?.team_expiration_date && now > new Date(manager.team_expiration_date)) isExpired = true;
        }

        if (isExpired) {
          await signOut();
          return; // Stop processing
        }

        setUserProfile(data as UserProfile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setSession(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id, session.user.email);
    }
  };

  const isAdmin = userProfile?.role === UserRole.ADMIN;
  const isMod = userProfile?.role === UserRole.MOD;

  return (
    <AuthContext.Provider value={{ session, userProfile, isLoading, isAdmin, isMod, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

