import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserCog, Loader2, Megaphone, Trash2, Clock, RefreshCw, AlertCircle, Eye, X, CheckCircle2 } from 'lucide-react';
// @ts-ignore
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

interface SystemNotification {
    id: string;
    title: string;
    content: string;
    sender_id: string;
    target_scope: 'all' | 'team';
    target_team_id?: string;
    sender_name: string;
    created_at: string;
    is_active: boolean;
}

const modules = {
    toolbar: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['link'],
        ['clean']
    ],
};

const SystemNotificationSender: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [targetScope, setTargetScope] = useState<'all' | 'team'>('team');

    // New Options
    const [isPopup, setIsPopup] = useState(true);
    const [isDashboard, setIsDashboard] = useState(false);
    const [durationDays, setDurationDays] = useState(1);

    // For Admin selecting potential target teams (optional future enhancement)
    // For now, if 'team', it uses the sender's ID as the team leader connection
    // But wait, if Admin sends to 'Team', which team?
    // Let's assume Admin usually sends to ALL. If Admin wants to send to a team, they act as that team's manager?
    // Simplification: 
    // - Admin: Defaults 'all'. Can switch to 'team' (but needs a target team ID).
    // - Mod: Fixed 'team' (target team ID = their own ID).

    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // History State
    const [history, setHistory] = useState<SystemNotification[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    if (!userProfile || (!isAdmin && !isMod)) return null;

    useEffect(() => {
        fetchHistory();
    }, [userProfile]); // Fetch on mount

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            let query = supabase
                .from('system_notifications')
                .select('*')
                .order('created_at', { ascending: false });

            // If Mod (not Admin), restrict to ONLY team notifications
            // This hides Global notifications from the Mod's history view (which is good for avoiding clutter/accidental delete of global stuff)
            if (!isAdmin && isMod) {
                query = query.eq('target_team_id', userProfile.id);
            }

            const { data, error } = await query;

            if (error) throw error;
            setHistory(data as SystemNotification[]);
        } catch (err) {
            console.error("Error fetching history:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSend = async () => {
        // Strip HTML tags to check if empty content
        const strippedContent = content.replace(/<[^>]+>/g, '').trim();
        if (!title.trim() || !strippedContent) {
            alert("Vui lòng nhập tiêu đề và nội dung.");
            return;
        }

        if (!isPopup && !isDashboard) {
            alert("Vui lòng chọn ít nhất một hình thức hiển thị (Popup hoặc Dashboard).");
            return;
        }

        setLoading(true);
        setSuccessMsg('');

        try {
            let finalScope = targetScope;
            let finalTeamId = null;

            if (isAdmin) {
                // Admin logic
                if (targetScope === 'team') {
                    // If Admin selects team, we need to know WHICH team.
                    // Ideally we'd have a dropdown of managers.
                    // For MVP, limit Admin to 'all' or 'team' (his own direct reports).
                    finalTeamId = userProfile.id;
                }
            } else if (isMod) {
                // Mod logic: Always team, always their own ID
                finalScope = 'team';
                finalTeamId = userProfile.id;
            }

            // Determine Display Type
            let displayType = 'popup';
            if (isPopup && isDashboard) displayType = 'both';
            else if (isDashboard) displayType = 'dashboard';

            // Calculate Expiry for Dashboard
            let expiresAt = null;
            if (isDashboard || displayType === 'both') {
                const d = new Date();
                d.setDate(d.getDate() + Math.max(1, durationDays)); // Min 1 day
                expiresAt = d.toISOString();
            }

            const { error } = await supabase.from('system_notifications').insert([{
                title,
                content, // This now contains HTML
                sender_id: userProfile.id,
                target_scope: finalScope,
                target_team_id: finalTeamId,
                sender_name: userProfile.full_name,
                is_active: true,
                display_type: displayType,
                expires_at: expiresAt
            }]);

            if (error) throw error;

            setSuccessMsg('Đã gửi thông báo thành công!');
            setTitle('');
            setContent('');
            setIsPopup(true);
            setIsDashboard(false);
            setDurationDays(1);
            fetchHistory(); // Refresh history

            // Clear msg after 3s
            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (error) {
            console.error("Post notification error:", error);
            alert("Lỗi gửi thông báo (Có thể do chưa cập nhật DB). Hãy nhờ Admin chạy lệnh SQL update.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa thông báo này? Hành động này không thể hoàn tác.")) return;

        try {
            const { error } = await supabase.from('system_notifications').delete().eq('id', id);
            if (error) throw error;
            setHistory(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error("Delete error:", err);
            alert("Lỗi khi xóa thông báo");
        }
    };

    // Readers View State
    const [viewingNotifId, setViewingNotifId] = useState<string | null>(null);
    const [readers, setReaders] = useState<any[]>([]);
    const [isLoadingReaders, setIsLoadingReaders] = useState(false);

    const handleViewReaders = async (notifId: string) => {
        setViewingNotifId(notifId);
        setIsLoadingReaders(true);
        setReaders([]);

        try {
            // 1. Get acknowledgments
            const { data: acks, error: ackError } = await supabase
                .from('notification_acknowledgments')
                .select('user_id, accepted_at')
                .eq('notification_id', notifId);

            if (ackError) throw ackError;

            if (!acks || acks.length === 0) {
                setReaders([]);
                return;
            }

            // 2. Get profiles
            const userIds = acks.map(a => a.user_id);
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, role')
                .in('id', userIds);

            if (profileError) throw profileError;

            // 3. Merge data
            const expandedReaders = acks.map(ack => {
                const profile = profiles?.find(p => p.id === ack.user_id);
                return {
                    id: ack.user_id,
                    name: profile?.full_name || 'Unknown User',
                    email: profile?.email,
                    role: profile?.role,
                    avatar: profile?.avatar_url,
                    viewedAt: ack.accepted_at
                };
            });

            // Sort by most recently viewed
            expandedReaders.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime());

            setReaders(expandedReaders);

        } catch (error) {
            console.error("Error fetching readers:", error);
            alert("Không thể tải danh sách người xem.");
            setViewingNotifId(null);
        } finally {
            setIsLoadingReaders(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Sender Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Megaphone className="text-blue-600" size={20} />
                    Gửi Thông Báo Hệ Thống (Rich Text)
                </h3>

                <div className="space-y-4">
                    {/* Scope Selection */}
                    {isAdmin && (
                        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                            <button
                                onClick={() => setTargetScope('all')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${targetScope === 'all' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                                <Users size={16} /> Toàn hệ thống
                            </button>
                            <button
                                onClick={() => setTargetScope('team')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${targetScope === 'team' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
                            >
                                <UserCog size={16} /> Team của tôi
                            </button>
                        </div>
                    )}

                    {isMod && !isAdmin && (
                        <div className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-2">
                            <Users size={14} />
                            Phạm vi: Thành viên Team {userProfile.full_name}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Tiêu đề</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full border border-gray-300 p-2.5 rounded-xl outline-none focus:border-blue-500 font-bold text-gray-900"
                            placeholder="VD: Thông báo bảo trì..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nội dung</label>
                        <div className="bg-white rounded-xl overflow-hidden">
                            <ReactQuill
                                theme="snow"
                                value={content}
                                onChange={setContent}
                                modules={modules}
                                className="h-[200px] mb-12" // Add margin bottom for toolbar spacing
                                placeholder="Nhập nội dung thông báo..."
                            />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-6">
                        {/* Display Options */}
                        <div className="flex-1 space-y-3">
                            <label className="block text-sm font-bold text-gray-700">Hình thức hiển thị</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isPopup}
                                        onChange={e => setIsPopup(e.target.checked)}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-bold text-gray-700">Popup (Bắt buộc đọc)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isDashboard}
                                        onChange={e => setIsDashboard(e.target.checked)}
                                        className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-bold text-gray-700">Ghim Dashboard</span>
                                </label>
                            </div>
                        </div>

                        {/* Duration (Only if Dashboard is selected) */}
                        {isDashboard && (
                            <div className="animate-fade-in transition-all">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Thời gian hiển thị (Ngày)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={durationDays}
                                        onChange={e => setDurationDays(parseInt(e.target.value))}
                                        className="w-24 border border-gray-300 p-2.5 rounded-xl outline-none focus:border-amber-500 font-bold text-gray-900 text-center"
                                    />
                                    <span className="text-sm text-gray-500 font-bold">ngày</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-4">
                        <p className="text-sm text-green-600 font-bold">{successMsg}</p>
                        <button
                            onClick={handleSend}
                            disabled={loading || !title || content.replace(/<[^>]+>/g, '').trim() === ''}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin" size={18} />}
                            Gửi ngay
                        </button>
                    </div>
                </div>
            </div>

            {/* History List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="text-gray-500" size={20} />
                        Lịch Sử Thông Báo
                    </h3>
                    <button onClick={fetchHistory} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors">
                        <RefreshCw size={18} className={loadingHistory ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3">Tiêu đề</th>
                                <th className="px-4 py-3">Phạm vi</th>
                                <th className="px-4 py-3">Người gửi</th>
                                <th className="px-4 py-3">Thời gian</th>
                                <th className="px-4 py-3 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.length > 0 ? (
                                history.map(notif => (
                                    <tr key={notif.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{notif.title}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1 items-start">
                                                {notif.target_scope === 'all' ? (
                                                    <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded">Toàn hệ thống</span>
                                                ) : (
                                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">Team</span>
                                                )}
                                                {/* @ts-ignore */}
                                                {(notif.display_type === 'dashboard' || notif.display_type === 'both') && (
                                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                                        <Clock size={10} /> Dashboard
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{notif.sender_name || 'N/A'}</td>
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(notif.created_at).toLocaleString('vi-VN')}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewReaders(notif.id)}
                                                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                    title="Xem người đã đọc"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(notif.id)}
                                                    className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Xóa vĩnh viễn"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle size={32} className="opacity-20" />
                                            Chưa có thông báo nào được gửi
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Readers Modal */}
            {viewingNotifId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Eye className="text-blue-600" size={20} />
                                    Người đã xem thông báo
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Danh sách nhân viên đã xác nhận đọc (Popup).</p>
                            </div>
                            <button onClick={() => setViewingNotifId(null)} className="text-gray-400 hover:text-gray-600 p-2 bg-white rounded-full shadow-sm hover:shadow transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoadingReaders ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                    <span>Đang tải danh sách...</span>
                                </div>
                            ) : readers.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                                    <p className="font-medium">Chưa có ai xem thông báo này.</p>
                                    <p className="text-xs mt-1">Lưu ý: Chỉ tính lượt xem qua Popup (Bấm "Đồng ý").</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {readers.map((reader) => (
                                        <div key={reader.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-blue-200 transition-all">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                                                {reader.avatar ? (
                                                    <img src={reader.avatar} alt={reader.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    reader.name.charAt(0)
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-bold text-gray-900 truncate">{reader.name}</h4>
                                                <p className="text-xs text-gray-500 truncate">{reader.email}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <CheckCircle2 size={12} className="text-green-500" />
                                                    <span className="text-[10px] text-gray-400">
                                                        Đã xem: {new Date(reader.viewedAt).toLocaleString('vi-VN')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
                            <div className="text-xs text-gray-500 italic inline-block mr-4">
                                Tổng cộng: <span className="font-bold text-gray-900">{readers.length}</span> người đã xem
                            </div>
                            <button
                                onClick={() => setViewingNotifId(null)}
                                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemNotificationSender;
