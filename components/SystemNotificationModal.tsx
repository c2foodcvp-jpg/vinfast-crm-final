import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Bell, CheckCircle2 } from 'lucide-react';

interface SystemNotification {
    id: string;
    title: string;
    content: string;
    target_scope: 'all' | 'team' | 'specific';
    target_team_id?: string;
    target_user_ids?: string[];
    created_at: string;
    display_type?: 'popup' | 'dashboard' | 'both';
}

const SystemNotificationModal: React.FC = () => {
    const { userProfile } = useAuth();
    const [queue, setQueue] = useState<SystemNotification[]>([]);
    const [currentNotif, setCurrentNotif] = useState<SystemNotification | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userProfile) return;

        const fetchNotifications = async () => {
            try {
                // 1. Get all active notifications
                const { data: allNotifs, error: notifError } = await supabase
                    .from('system_notifications')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: true }); // Oldest first? or Newest? Usually priority depends. Let's do Oldest First to catch up.

                if (notifError || !allNotifs) return;

                // 2. Get my acknowledgments
                const { data: myAcks, error: ackError } = await supabase
                    .from('notification_acknowledgments')
                    .select('notification_id')
                    .eq('user_id', userProfile.id);

                if (ackError) return;

                const ackIds = new Set(myAcks?.map(a => a.notification_id) || []);

                // 3. Filter relevant notifications
                const pending = allNotifs.filter(n => {
                    // Filter out Chat Sync notifications (Titles starting with "Tin nhắn mới từ")
                    // These are intended for Push Notifications only, not Modals
                    if (n.title && n.title.startsWith('Tin nhắn mới từ')) return false;

                    // Filter out Dashboard Only notifications
                    if (n.display_type === 'dashboard') return false;

                    // Already acknowledged?
                    if (ackIds.has(n.id)) return false;

                    // Scope check
                    if (n.target_scope === 'all') return true;
                    if (n.target_scope === 'team') {
                        // I see it if I am in the team (my manager is the target id)
                        // Also include if I am the target team leader (the manager themselves)
                        return userProfile.manager_id === n.target_team_id || userProfile.id === n.target_team_id;
                    }
                    if (n.target_scope === 'specific') {
                        return n.target_user_ids && n.target_user_ids.includes(userProfile.id);
                    }



                    return false;
                });

                setQueue(pending);
            } catch (error) {
                console.error("Error fetching system notifications:", error);
            }
        };

        fetchNotifications();
    }, [userProfile]);

    useEffect(() => {
        if (queue.length > 0 && !currentNotif) {
            setCurrentNotif(queue[0]);
        }
    }, [queue, currentNotif]);

    const handleAccept = async () => {
        if (!currentNotif || !userProfile) return;
        setLoading(true);

        try {
            // 1. Save acknowledgment
            const { error } = await supabase
                .from('notification_acknowledgments')
                .insert([{ notification_id: currentNotif.id, user_id: userProfile.id }]);

            if (error) throw error;

            // 2. Remove from queue
            const nextQueue = queue.slice(1);
            setQueue(nextQueue);
            setCurrentNotif(null); // Will trigger useEffect to load next or close

        } catch (error) {
            console.error("Error accepting notification:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!currentNotif) return null;

    return (
        <div className="fixed inset-0 z-[9950] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                {/* Header pattern */}
                <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-600 w-full" />

                <div className="p-6">
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Bell size={32} />
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            {currentNotif.title}
                        </h2>

                        <p className="text-xs text-gray-400 font-medium bg-gray-50 px-3 py-1 rounded-full mb-4">
                            Thông báo từ hệ thống
                        </p>
                    </div>

                    <div
                        className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-700 text-sm leading-relaxed mb-6 max-h-[60vh] overflow-y-auto w-full text-left [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>a]:text-blue-600 [&>a]:underline"
                        dangerouslySetInnerHTML={{ __html: currentNotif.content }}
                    />

                    <button
                        onClick={handleAccept}
                        disabled={loading}
                        className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <CheckCircle2 size={20} />
                                Đồng ý / Đã hiểu
                            </>
                        )}
                    </button>

                    <p className="text-[10px] text-gray-400 text-center mt-3">
                        Nhấn đồng ý để đóng thông báo này.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SystemNotificationModal;
