# Project Plan: Community & Chat System

## 1. Database Schema (Supabase)

We need new tables to support chat functionality.

### Tables

1.  **`chat_channels`**
    *   `id` (uuid, PK)
    *   `type` (text: 'global', 'team', 'dm')
    *   `name` (text, optional)
    *   `created_at` (timestamptz)
    *   `updated_at` (timestamptz)

2.  **`chat_members`**
    *   `channel_id` (uuid, FK)
    *   `user_id` (uuid, FK)
    *   `last_read_at` (timestamptz)
    *   `joined_at` (timestamptz)
    *   PK: (channel_id, user_id)

3.  **`chat_messages`**
    *   `id` (uuid, PK)
    *   `channel_id` (uuid, FK)
    *   `sender_id` (uuid, FK)
    *   `content` (text)
    *   `created_at` (timestamptz)
    *   `is_system` (boolean, default false)

### Logic for "Team"
Since there is no explicit `teams` table, we define a team by the `manager_id`.
*   **Team Channel**: Each Manager (Mod) will have a unique Team Channel.
*   **Global Channel**: Single static channel or created once.

## 2. Frontend Components

### Page: `/community`
*   **Layout**:
    *   **Sidebar (Left)**:
        *   Tabs: "Tin nhắn" (Recent DMs/Channels), "Danh bạ" (People).
        *   "Danh bạ" has 2 sub-tabs: "Global" (All users) vs "Team" (My team).
    *   **Main Area**: Chat Window.

### Components
*   **`GlobalChatBubble`**:
    *   Fixed position (bottom-right).
    *   Shows unread badge.
    *   Toggles a mini-chat or redirects to `/community`. (User said "bong bóng chat này là noi chát riêng tư giữa các user", maybe a mini popover? Implementation: Popover interacting with the same `ChatContext`).

*   **`ChatWindow`**:
    *   Message list (scrollable, reverse).
    *   Input area (text, maybe emoji/image later).
    *   Header (Recipient info or Channel name).

*   **`CommunitySidebar`**:
    *   User Search.
    *   User List (with Presence status).

## 3. Real-time & State
*   **`ChatContext`**:
    *   Manages subscription to `chat_messages`.
    *   Handles "typing" status (optional).
    *   Manages "unread" counts.

## 4. Notifications
*   Supabase Realtime subscription to `chat_messages`.
*   If message.receiver_id == current_user, show toast/notification.

## 5. Implementation Steps

1.  **Migration**: Run SQL to create tables and RLS.
2.  **Context**: Create `ChatContext.tsx`.
3.  **UI**: Build `Community` page and sub-components.
4.  **Integration**: Connect UI to Supabase.
5.  **Global Bubble**: Add to `Layout.tsx`.
