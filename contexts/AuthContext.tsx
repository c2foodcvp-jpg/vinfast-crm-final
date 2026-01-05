
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user.email);
      else setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id, session.user.email);
      else {
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
        .select('*')
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
        setUserProfile(data as UserProfile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
  };

  const isAdmin = userProfile?.role === UserRole.ADMIN;
  const isMod = userProfile?.role === UserRole.MOD;

  return (
    <AuthContext.Provider value={{ session, userProfile, isLoading, isAdmin, isMod, signOut }}>
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
