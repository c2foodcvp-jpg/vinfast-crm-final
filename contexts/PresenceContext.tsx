
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export type UserStatus = 'online' | 'idle' | 'offline';

export interface PresenceState {
    user_id: string;
    status: UserStatus;
    last_active: string;
    online_at: string;
}

interface PresenceContextType {
    onlineUsers: Record<string, PresenceState>;
    myStatus: UserStatus;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

// 5 Minutes Idle Timeout
const IDLE_TIMEOUT = 5 * 60 * 1000;

export const PresenceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState>>({});
    const [myStatus, setMyStatus] = useState<UserStatus>('online');
    const channelRef = useRef<RealtimeChannel | null>(null);
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initial setup when user logs in
    useEffect(() => {
        if (!userProfile?.id) return;

        // 1. Join the presence channel
        const channel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: userProfile.id,
                },
            },
        });

        channelRef.current = channel;

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState() as unknown as Record<string, PresenceState[]>;
                // Transform Supabase Presence State to our Map
                // Supabase state is: { [key: string]: PresenceState[] }
                // We just take the latest one per user
                const newUsers: Record<string, PresenceState> = {};
                Object.keys(state).forEach((key) => {
                    if (state[key] && state[key].length > 0) {
                        // Take the most recent presence object for this user key
                        newUsers[key] = state[key][0];
                    }
                });
                setOnlineUsers(newUsers);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                setOnlineUsers((prev) => {
                    // Merging logic if needed, but 'sync' usually covers it. 
                    // Join is good for notifications if we wanted them.
                    const next = { ...prev };
                    if (newPresences && newPresences.length > 0) {
                        next[key] = newPresences[0] as PresenceState;
                    }
                    return next;
                });
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                setOnlineUsers((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await trackStatus('online');
                }
            });

        // 2. Setup Idle Detection


        // We need a separate handler for 'active' event to switch back from idle
        const handleActivity = () => {
            setMyStatus(prev => {
                if (prev === 'idle') {
                    trackStatus('online');
                    return 'online';
                }
                return prev;
            });

            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => {
                setMyStatus('idle');
                trackStatus('idle');
            }, IDLE_TIMEOUT);
        };

        // Attach listeners
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity);

        // Initial timer start
        handleActivity();

        return () => {
            if (channelRef.current) {
                channelRef.current.unsubscribe();
            }
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile?.id]); // Re-run only if user changes

    // Helper to send status to Supabase
    const trackStatus = async (status: UserStatus) => {
        if (!channelRef.current || !userProfile) return;

        // We use Date.now() for unique channel tracking if needed, but here simple is fine
        const payload: PresenceState = {
            user_id: userProfile.id,
            status,
            last_active: new Date().toISOString(),
            online_at: new Date().toISOString(),
        };

        await channelRef.current.track(payload);
    };

    return (
        <PresenceContext.Provider value={{ onlineUsers, myStatus }}>
            {children}
        </PresenceContext.Provider>
    );
};

export const usePresence = () => {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        throw new Error('usePresence must be used within a PresenceProvider');
    }
    return context;
};
