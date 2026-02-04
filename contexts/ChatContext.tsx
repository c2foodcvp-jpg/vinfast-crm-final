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

        try {
            // STANDARD QUERY (No RPC) - Reliable Fallback
            // Fetch all channels the user is a member of
            const { data: memberChannels, error: memberError } = await supabase
                .from('chat_members')
                .select(`
                    channel_id, 
                    last_read_at,
                    cleared_history_at, 
                    chat_channels (
                        id, 
                        type, 
                        name, 
                        avatar_url
                    )
                `)
                .eq('user_id', userProfile.id);

            if (memberError) {
                console.error("Fetch channels error:", memberError);
                return;
            }

            // Fetch Global Channel (if not in members)
            let allChannelsData = memberChannels || [];

            // Check if Global exists in list
            const hasGlobal = allChannelsData.some((m: any) => m.chat_channels?.type === 'global');
            if (!hasGlobal) {
                const { data: globalChan } = await supabase
                    .from('chat_channels')
                    .select('*')
                    .eq('type', 'global')
                    .single();

                if (globalChan) {
                    allChannelsData.push({
                        channel_id: globalChan.id,
                        last_read_at: new Date().toISOString(),
                        // Global never really clears for everyone, but local user defaults to null
                        cleared_history_at: null,
                        chat_channels: globalChan
                    });
                }
            }

            // Enrich with Metadata (Last Message, Unread, Partner Info for DMs)
            // We do this in parallel for performance
            const mappedChannels: ChatChannel[] = await Promise.all(allChannelsData.map(async (m: any) => {
                const ch = m.chat_channels;
                if (!ch) return null; // Safety

                const lastRead = m.last_read_at ? new Date(m.last_read_at) : new Date(0);
                const clearedAt = m.cleared_history_at ? new Date(m.cleared_history_at) : new Date(0);

                let extra: any = {
                    unread_count: 0,
                    last_message_at: null,
                    last_message_preview: null,
                    // DM Defaults
                    otherUserId: null,
                    otherUserName: null,
                    otherUserLastSeen: null,
                    otherUserAvatar: null
                };

                // 1. DM Partner Info
                if (ch.type === 'dm') {
                    // Find the other member in this channel
                    const { data: partner } = await supabase
                        .from('chat_members')
                        .select('user_id, profiles(full_name, last_seen_at, avatar_url)')
                        .eq('channel_id', ch.id)
                        .neq('user_id', userProfile.id)
                        .maybeSingle();

                    if (partner && partner.profiles) {
                        const p = partner.profiles as any;
                        extra.otherUserId = partner.user_id;
                        extra.otherUserName = p.full_name;
                        extra.otherUserLastSeen = p.last_seen_at;
                        extra.otherUserAvatar = p.avatar_url;
                    }
                }

                // 2. Fetch Last Message & Unread Count
                // We fetch the latest message to show preview
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

                    // Unread Count Logic
                    // Count messages newer than last_read AND newer than cleared_at (if hidden)
                    // Simplified: Just check if last msg is unread
                    const msgTime = new Date(lastMsg.created_at);
                    if (msgTime > lastRead && msgTime > clearedAt && lastMsg.sender_id !== userProfile.id) {
                        extra.unread_count = 1; // Simplified: 1 means "Bold", we don't query count(*) to save reads
                    }
                }

                // Return active object
                return {
                    id: ch.id,
                    type: ch.type,
                    name: ch.name,
                    avatar_url: ch.avatar_url,
                    cleared_at: m.cleared_history_at, // IMPORTANT: Pass this to context
                    ...extra
                };
            }));

            // Filter nulls and Sort
            const validChannels = mappedChannels.filter(Boolean).sort((a: any, b: any) => {
                const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                return timeB - timeA;
            });

            setChannels(validChannels as ChatChannel[]);

            // Auto-join Team Channel if missing (Logic preserved)
            const teamChan = validChannels.find((c: any) => c.type === 'team');
            setTeamChannelId(teamChan?.id || null);

            // Update unread count
            const totalUnread = validChannels.reduce((acc: number, curr: any) => acc + (curr.unread_count || 0), 0);
            setUnreadCount(totalUnread);

        } catch (err) {
            console.error("Critical error fetching channels:", err);
        }
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
        try {
            // Optimistic update
            setMessages(prev => prev.filter(m => m.id !== messageId));

            // Attempt RPC (Recall - Soft Delete for Everyone)
            const { error: rpcError } = await supabase.rpc('delete_chat_message', { p_message_id: messageId });

            if (rpcError) {
                console.warn("RPC delete failed, falling back to direct update if owner:", rpcError);

                // Fallback: If I am the sender, I can update my own message content manually
                // This covers the case where the RPC migration wasn't run but the user wants to "Recall"
                const { error: directError } = await supabase
                    .from('chat_messages')
                    .update({
                        content: 'Tin nhắn đã thu hồi',
                        is_system: true
                    })
                    .eq('id', messageId)
                    .eq('sender_id', userProfile?.id); // Security check

                if (directError) throw directError;
            }
        } catch (error: any) {
            console.error("Delete failed:", error);
            toast.error("Không thể xóa tin nhắn: " + error.message);
            // Revert optimistic update
            if (activeChannel) fetchMessages(activeChannel.id);
        }
    };

    const clearHistory = async () => {
        if (!activeChannel || !userProfile) return;

        if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện này? \n(Hành động này chỉ áp dụng cho bạn)")) {
            try {
                // Optimistic
                setMessages([]);
                const nowISO = new Date().toISOString();

                // Direct Update to chat_members (Bypassing potentially missing RPC)
                // This is safer and uses standard RLS
                const { error } = await supabase
                    .from('chat_members')
                    .update({ cleared_history_at: nowISO })
                    .eq('channel_id', activeChannel.id)
                    .eq('user_id', userProfile.id);

                if (error) throw error;

                toast.success("Đã xóa lịch sử trò chuyện");

                // Update local channel cleared_at to prevent fetchMessages from reloading old msgs immediately
                setChannels(prev => prev.map(c =>
                    c.id === activeChannel.id
                        ? { ...c, cleared_at: nowISO }
                        : c
                ));
            } catch (error: any) {
                console.error("Clear history failed:", error);
                toast.error("Lỗi khi xóa lịch sử");
                fetchMessages(activeChannel.id);
            }
        }
    };

    // Active Channel Effect - Triggers only on ID change
    useEffect(() => {
        if (activeChannel) {
            fetchMessages(activeChannel.id);
            markChannelAsRead(activeChannel.id);
            checkBanStatus(activeChannel.id);
        } else {
            setBannedUntil(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeChannel?.id]);

    // Keep activeChannel in sync with channels list (e.g. metadata updates like Avatar)
    useEffect(() => {
        if (activeChannel) {
            const updated = channels.find(c => c.id === activeChannel.id);
            if (updated && updated !== activeChannel) {
                setActiveChannel(updated);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channels]);

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
