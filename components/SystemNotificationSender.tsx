import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserCog, Loader2, Megaphone, Trash2, Clock, RefreshCw, AlertCircle } from 'lucide-react';
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

            const { error } = await supabase.from('system_notifications').insert([{
                title,
                content, // This now contains HTML
                sender_id: userProfile.id,
                target_scope: finalScope,
                target_team_id: finalTeamId,
                sender_name: userProfile.full_name,
                is_active: true
            }]);

            if (error) throw error;

            setSuccessMsg('Đã gửi thông báo thành công!');
            setTitle('');
            setContent('');
            fetchHistory(); // Refresh history

            // Clear msg after 3s
            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (error) {
            console.error("Post notification error:", error);
            alert("Lỗi gửi thông báo");
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
                                            {notif.target_scope === 'all' ? (
                                                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded">Toàn hệ thống</span>
                                            ) : (
                                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">Team</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{notif.sender_name || 'N/A'}</td>
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                            {new Date(notif.created_at).toLocaleString('vi-VN')}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(notif.id)}
                                                className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Xóa vĩnh viễn"
                                            >
                                                <Trash2 size={16} />
                                            </button>
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
        </div>
    );
};

export default SystemNotificationSender;
