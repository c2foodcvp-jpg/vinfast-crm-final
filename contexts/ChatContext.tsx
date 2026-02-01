import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { ChatChannel, ChatMessage } from '../types/chat';
import toast from 'react-hot-toast';
import { usePresence } from './PresenceContext';

interface ChatContextType {
    channels: ChatChannel[];
    activeChannel: ChatChannel | null;
    setActiveChannel: (channel: ChatChannel | null) => void;
    messages: ChatMessage[];
    sendMessage: (content: string, channelId: string) => Promise<void>;
    createDM: (targetUserId: string) => Promise<string>;
    unreadCount: number;
    globalChannelId: string;
    teamChannelId: string | null;
    refreshChannels: () => Promise<void>;
    onlineUsers: Set<string>;
    markChannelAsRead: (channelId: string) => Promise<void>;
    // Moderation
    bannedUntil: string | null;
    banUser: (userId: string, minutes: number, reason?: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    clearHistory: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const GLOBAL_CHANNEL_ID = '00000000-0000-0000-0000-000000000001';

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { userProfile } = useAuth();
    const [channels, setChannels] = useState<ChatChannel[]>([]);
    const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [teamChannelId, setTeamChannelId] = useState<string | null>(null);
    const [bannedUntil, setBannedUntil] = useState<string | null>(null); // New state for ban status

    // Get online users from centralized PresenceContext
    const { onlineUsers: presenceUsers } = usePresence();
    const onlineUsers = new Set(Object.keys(presenceUsers));

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const activeChannelRef = useRef<string | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('/assets/notification.mp3');
    }, []);

    // Keep ref in sync
    useEffect(() => {
        activeChannelRef.current = activeChannel ? activeChannel.id : null;
    }, [activeChannel]);

    // Derived Unread Count
    useEffect(() => {
        const total = channels.reduce((acc, curr) => acc + (curr.unread_count || 0), 0);
        setUnreadCount(total);
    }, [channels]);

    // Presence & Online Logic
    // We update DB last_seen every 5 minutes (Legacy support for non-realtime views)
    useEffect(() => {
        if (!userProfile) return;

        const interval = setInterval(async () => {
            await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', userProfile.id);
        }, 5 * 60 * 1000);

        // Initial update
        supabase
            .from('profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', userProfile.id);

        return () => {
            clearInterval(interval);
        };
    }, [userProfile?.id]);

    const fetchChannels = async () => {
        if (!userProfile) return;

        let mappedChannels: ChatChannel[] = [];
        let rpcSuccess = false;

        // Try RPC to get channels with meta (unread, last message, sorting)
        const { data, error } = await supabase.rpc('get_channels_with_meta');

        if (!error && data) {
            rpcSuccess = true;
            mappedChannels = data.map((c: any) => ({
                id: c.channel_id,
                type: c.channel_type,
                name: c.channel_name,
                last_message_at: c.last_message_at,
                last_message_preview: c.last_message_preview,
                unread_count: c.unread_count,
                // DM specific fields for UI
                otherUserId: c.receiver_id,
                otherUserName: c.receiver_name,
                otherUserLastSeen: c.receiver_last_seen,
                otherUserAvatar: c.receiver_avatar
            }));
        } else {
            console.warn('ChatContext: RPC fetch failed or returned error, falling back to standard queries:', error);
        }

        // Fallback: If RPC failed, fetch basic channel list with manual DM resolution and Last Message
        if (!rpcSuccess) {
            const { data: memberChannels, error: memberError } = await supabase
                .from('chat_members')
                .select('channel_id, last_read_at, chat_channels(*)')
                .eq('user_id', userProfile.id);

            if (!memberError && memberChannels) {
                // Enrich manually (Parallel fetch for speed)
                const enriched = await Promise.all(memberChannels.map(async (m: any) => {
                    const ch = m.chat_channels;
                    const lastRead = m.last_read_at;
                    let extra: any = { unread_count: 0, last_message_at: null, last_message_preview: null };

                    // 1. Fetch DM Partner info
                    if (ch.type === 'dm') {
                        const { data: partner } = await supabase
                            .from('chat_members')
                            .select('user_id, profiles(full_name, last_seen_at, avatar_url)')
                            .eq('channel_id', ch.id)
                            .neq('user_id', userProfile.id)
                            .maybeSingle();

                        if (partner && partner.profiles) {
                            const p = partner.profiles as any;
                            extra.otherUserName = p.full_name;
                            extra.otherUserLastSeen = p.last_seen_at;
                            extra.otherUserAvatar = p.avatar_url;
                        }
                    }

                    // Map cleared history
                    extra.cleared_at = m.cleared_history_at;

                    // 2. Fetch Last Message & Unread Count
                    const { data: msgs } = await supabase
                        .from('chat_messages')
                        .select('id, content, created_at, sender_id')
                        .eq('channel_id', ch.id)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (msgs && msgs.length > 0) {
                        const lastMsg = msgs[0];
                        extra.last_message_at = lastMsg.created_at;
                        extra.last_message_preview = lastMsg.content;

                        const lastReadDate = lastRead ? new Date(lastRead) : new Date(0);
                        if (new Date(lastMsg.created_at) > lastReadDate && lastMsg.sender_id !== userProfile.id) {
                            extra.unread_count = 1; // Simplified for fallback
                        }
                    }

                    return { ...ch, ...extra };
                }));

                // Sort manually by last_message_at
                enriched.sort((a: any, b: any) => {
                    const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                    const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                    return timeB - timeA;
                });

                mappedChannels = enriched;
            }
        }

        // Ensure Global Channel Exists
        const globalExists = mappedChannels.find((c: any) => c.id === GLOBAL_CHANNEL_ID);
        if (!globalExists) {
            const { data: globalChannel } = await supabase
                .from('chat_channels')
                .select('*')
                .eq('id', GLOBAL_CHANNEL_ID)
                .single();

            if (globalChannel) {
                // Approximate meta for global channel
                mappedChannels.unshift({
                    ...globalChannel,
                    last_message_at: new Date().toISOString(),
                    unread_count: 0
                } as any);
            }
        }

        setChannels(mappedChannels);

        let teamChan = mappedChannels.find((c: any) => c.type === 'team');

        // Auto-join Team Channel if missing
        if (!teamChan) {
            try {
                const { data: newTeamChannelId, error: rpcError } = await supabase.rpc('ensure_team_channel');
                if (!rpcError && newTeamChannelId) {
                    // Refetch to get the new channel
                    const { data: refetched } = await supabase.rpc('get_channels_with_meta');
                    if (refetched) {
                        mappedChannels = refetched.map((c: any) => ({
                            id: c.channel_id,
                            type: c.channel_type,
                            name: c.channel_name,
                            last_message_at: c.last_message_at,
                            last_message_preview: c.last_message_preview,
                            unread_count: c.unread_count,
                            otherUserId: c.receiver_id,
                            otherUserName: c.receiver_name,
                            otherUserLastSeen: c.receiver_last_seen,
                            otherUserAvatar: c.receiver_avatar
                        }));
                        teamChan = mappedChannels.find((c: any) => c.type === 'team');
                    }
                }
            } catch (err) {
                console.warn("Auto-join team failed:", err);
            }
        }

        setChannels(mappedChannels);
        setTeamChannelId(teamChan?.id || null);

        // Update total global unread count
        const totalUnread = mappedChannels.reduce((acc: number, curr: any) => acc + (curr.unread_count || 0), 0);
        setUnreadCount(totalUnread);
    };

    const markChannelAsRead = async (channelId: string) => {
        if (!userProfile) return;

        // Optimistic update
        setChannels(prev => prev.map(c => {
            if (c.id === channelId) return { ...c, unread_count: 0 };
            return c;
        }));

        // Recalc total
        setUnreadCount(prev => {
            return prev; // Rely on fetch refresh
        });

        const { error } = await supabase.rpc('mark_channel_read', { p_channel_id: channelId });
        if (error) console.error("Error marking read", error);

        // Re-fetch to be sure
        await fetchChannels();
    };

    const fetchMessages = async (channelId: string) => {
        // Find channel metadata to check for cleared history
        const channel = channels.find(c => c.id === channelId);
        let query = supabase
            .from('chat_messages')
            .select('*, sender:sender_id(full_name, avatar_url)')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true })
            .limit(100);

        if (channel && channel.cleared_at) {
            query = query.gt('created_at', channel.cleared_at);
        }

        const { data, error } = await query;

        if (error) {
            console.error('ChatContext: Error fetching messages:', error);
        } else {
            setMessages(data || []);
        }
    };

    const handleIncomingMessage = (msg: ChatMessage) => {
        const currentActiveId = activeChannelRef.current;
        const channelId = msg.channel_id;

        // Update active channel messages
        if (currentActiveId && channelId === currentActiveId) {
            setMessages(prev => {
                if (prev.find(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            // Also mark as read immediately if window is focused? 
            // For now, let's assume if I'm looking at it, it's read.
            markChannelAsRead(channelId);
        } else {
            // Notification if not active
            if (msg.sender_id !== userProfile?.id) {
                toast('Tin nhắn mới: ' + (msg.sender?.full_name || '...'), { icon: '💬' });
                audioRef.current?.play().catch(() => { });
            }
        }

        // Update Channels List (Sorting & Last Message)
        setChannels(prev => {
            const channelIndex = prev.findIndex(c => c.id === channelId);
            if (channelIndex === -1) {
                // Channel not found (new DM?), trigger refresh
                fetchChannels();
                return prev;
            }

            const channel = { ...prev[channelIndex] };
            channel.last_message_at = msg.created_at;
            channel.last_message_preview = msg.content;

            // If not active and not me -> increment unread
            if (msg.channel_id !== currentActiveId && msg.sender_id !== userProfile?.id) {
                channel.unread_count = (channel.unread_count || 0) + 1;
            }

            // Move to top
            const otherChannels = prev.filter(c => c.id !== channelId);
            return [channel, ...otherChannels];
        });
    };

    const subscribeToMessages = () => {
        const channelId = `chat-global-${userProfile?.id}-${Math.random().toString(36).substring(7)}`;
        console.log('ChatContext: Subscribing to', channelId);

        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                },
                async (payload) => {
                    console.log('ChatContext: REALTIME EVENT RECV', payload);
                    const newMessage = payload.new as ChatMessage;

                    // Fetch sender info
                    const { data: senderData } = await supabase.from('profiles').select('full_name').eq('id', newMessage.sender_id).single();
                    const msgWithSender = { ...newMessage, sender: senderData };

                    handleIncomingMessage(msgWithSender as any);
                }
            )
            .subscribe((status) => {
                console.log('ChatContext: Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    // console.log('Chat connected');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('ChatContext: Realtime connection error');
                    toast.error('Lỗi kết nối Chat Realtime');
                }
            });

        return () => {
            console.log('ChatContext: Cleaning up subscription', channelId);
            supabase.removeChannel(channel);
        };
    };

    // Initialization Effect
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        if (userProfile) {
            console.log('ChatContext: User loaded, initializing...');
            fetchChannels();
            cleanup = subscribeToMessages();
        }
        return () => {
            if (cleanup) cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile?.id]);

    const checkBanStatus = async (channelId: string) => {
        if (!userProfile) return;
        const { data, error } = await supabase.rpc('get_my_ban_info', { p_channel_id: channelId });
        if (!error && data) {
            setBannedUntil(data);
        } else {
            setBannedUntil(null);
        }
    };

    const banUser = async (targetId: string, minutes: number, reason?: string) => {
        if (!activeChannel) return;
        const { error } = await supabase.rpc('ban_chat_user', {
            p_channel_id: activeChannel.id,
            p_target_user_id: targetId,
            p_minutes: minutes,
            p_reason: reason
        });

        if (error) {
            toast.error(error.message);
            throw error;
        } else {
            toast.success('Đã cấm chat thành công');
        }
    };

    const deleteMessage = async (messageId: string) => {
        // Optimistic update
        setMessages(prev => prev.filter(m => m.id !== messageId));

        // Use RPC for safer deletion
        const { error } = await supabase.rpc('delete_chat_message', { p_message_id: messageId });

        if (error) {
            console.error("Delete failed:", error);
            toast.error("Không thể xóa tin nhắn: " + error.message);
            // Revert
            if (activeChannel) fetchMessages(activeChannel.id);
        }
    };

    const clearHistory = async () => {
        if (!activeChannel) return;

        if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện này? \n(Hành động này chỉ áp dụng cho bạn)")) {
            // Optimistic
            setMessages([]);

            const { error } = await supabase.rpc('clear_chat_history', { p_channel_id: activeChannel.id });

            if (error) {
                console.error("Clear history failed:", error);
                toast.error("Lỗi khi xóa lịch sử");
                fetchMessages(activeChannel.id);
            } else {
                toast.success("Đã xóa lịch sử trò chuyện");
                // Update local channel cleared_at to prevent fetchMessages from reloading old msgs immediately if effects run
                setChannels(prev => prev.map(c =>
                    c.id === activeChannel.id
                        ? { ...c, cleared_at: new Date().toISOString() }
                        : c
                ));
            }
        }
    };

    // Active Channel Effect
    useEffect(() => {
        if (activeChannel) {
            fetchMessages(activeChannel.id);
            markChannelAsRead(activeChannel.id);
            checkBanStatus(activeChannel.id);
        } else {
            setBannedUntil(null);
        }
    }, [activeChannel]);

    // ... (sendMessage, createDM, etc.)
    const sendMessage = async (content: string, channelId: string) => {
        if (!userProfile) return;

        const { error } = await supabase
            .from('chat_messages')
            .insert({
                channel_id: channelId,
                sender_id: userProfile.id,
                content: content.trim(),
            });

        if (error) {
            toast.error('Gửi tin nhắn thất bại');
            console.error(error);
        }
    };

    const createDM = async (targetUserId: string): Promise<string> => {
        if (!userProfile) throw new Error("Not logged in");

        const { data, error } = await supabase.rpc('get_or_create_dm_channel', {
            target_user_id: targetUserId
        });

        if (error) {
            console.error(error);
            throw error;
        }

        await fetchChannels();
        return data as string;
    };

    const refreshChannels = async () => {
        await fetchChannels();
    };

    return (
        <ChatContext.Provider value={{
            channels, activeChannel, setActiveChannel, messages,
            sendMessage, createDM, unreadCount,
            globalChannelId: GLOBAL_CHANNEL_ID,
            teamChannelId, refreshChannels,
            onlineUsers, markChannelAsRead,
            bannedUntil, banUser, deleteMessage,
            clearHistory
        }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
