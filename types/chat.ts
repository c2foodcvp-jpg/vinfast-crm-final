export type ChatChannelType = 'global' | 'team' | 'dm';

export interface ChatChannel {
    id: string;
    type: ChatChannelType;
    name?: string;
    created_at: string;
    updated_at: string;
    // Enhanced fields
    last_message_at?: string;
    last_message_preview?: string;
    unread_count?: number;
    otherUserId?: string;
    otherUserName?: string;
    otherUserLastSeen?: string;
    otherUserAvatar?: string;
    cleared_at?: string;
}

export interface ChatMember {
    channel_id: string;
    user_id: string;
    joined_at: string;
    last_read_at: string;
}

export interface ChatMessage {
    id: string;
    channel_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    is_system: boolean;
    sender?: {
        full_name: string;
        avatar_url?: string;
    };
}
