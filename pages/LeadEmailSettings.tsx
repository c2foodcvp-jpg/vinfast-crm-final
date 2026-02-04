
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, LeadEmailPage, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    Settings, Users, Plus, Edit3, Trash2, Save, X, Loader2,
    Mail, RefreshCw, Zap, ToggleLeft, ToggleRight, Link2, Filter, Download
} from 'lucide-react';

const LeadEmailSettings: React.FC = () => {
    const { isAdmin } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [mods, setMods] = useState<UserProfile[]>([]);
    const [pages, setPages] = useState<LeadEmailPage[]>([]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingPage, setEditingPage] = useState<LeadEmailPage | null>(null);
    const [selectedModId, setSelectedModId] = useState<string>('');

    // Form State
    const [form, setForm] = useState({
        name: '',
        email_script_url: '',
        auto_import_script_url: '',
        source_filter: '',
        auto_download_enabled: false,
        auto_assign_enabled: false,
        auto_assign_round_robin: true,
        auto_assign_max_per_day: 10
    });

    // Access Control
    useEffect(() => {
        if (!isAdmin) {
            navigate('/');
            return;
        }
        fetchData();
    }, [isAdmin]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch MODs
            const { data: modData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', UserRole.MOD)
                .eq('status', 'active')
                .order('full_name');

            setMods(modData as UserProfile[] || []);

            // Fetch Lead Email Pages
            const { data: pageData } = await supabase
                .from('lead_email_pages')
                .select('*')
                .order('created_at', { ascending: false });

            setPages(pageData as LeadEmailPage[] || []);
        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            setLoading(false);
        }
    };

    // Get MODs that don't have a page yet
    const availableMods = useMemo(() => {
        const assignedModIds = pages.map(p => p.mod_id);
        return mods.filter(m => !assignedModIds.includes(m.id));
    }, [mods, pages]);

    // Get page for a specific MOD
    const getPageForMod = (modId: string) => pages.find(p => p.mod_id === modId);

    const resetForm = () => {
        setForm({
            name: '',
            email_script_url: '',
            auto_import_script_url: '',
            source_filter: '',
            auto_download_enabled: false,
            auto_assign_enabled: false,
            auto_assign_round_robin: true,
            auto_assign_max_per_day: 10
        });
        setSelectedModId('');
        setEditingPage(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (page: LeadEmailPage) => {
        setEditingPage(page);
        setSelectedModId(page.mod_id);
        setForm({
            name: page.name,
            email_script_url: page.email_script_url || '',
            auto_import_script_url: page.auto_import_script_url || '',
            source_filter: page.source_filter || '',
            auto_download_enabled: page.auto_download_enabled || false,
            auto_assign_enabled: page.auto_assign_enabled || false,
            auto_assign_round_robin: page.auto_assign_config?.round_robin ?? true,
            auto_assign_max_per_day: page.auto_assign_config?.max_per_day ?? 10
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            alert('Vui lòng nhập tên trang!');
            return;
        }
        if (!editingPage && !selectedModId) {
            alert('Vui lòng chọn MOD để phân bổ!');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                mod_id: editingPage ? editingPage.mod_id : selectedModId,
                name: form.name.trim(),
                email_script_url: form.email_script_url.trim() || null,
                auto_import_script_url: form.auto_import_script_url.trim() || null,
                source_filter: form.source_filter.trim() || null,
                auto_download_enabled: form.auto_download_enabled,
                auto_assign_enabled: form.auto_assign_enabled,
                auto_assign_config: {
                    round_robin: form.auto_assign_round_robin,
                    max_per_day: form.auto_assign_max_per_day
                },
                updated_at: new Date().toISOString()
            };

            if (editingPage) {
                // Update existing
                const { error } = await supabase
                    .from('lead_email_pages')
                    .update(payload)
                    .eq('id', editingPage.id);

                if (error) throw error;
                alert('✅ Đã cập nhật cấu hình!');
            } else {
                // Create new
                const { error } = await supabase
                    .from('lead_email_pages')
                    .insert([payload]);

                if (error) throw error;
                alert('✅ Đã tạo trang Lead Email mới!');
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (e: any) {
            console.error('Error saving:', e);
            alert('Lỗi: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (page: LeadEmailPage) => {
        if (!confirm(`Bạn có chắc muốn xóa trang "${page.name}" của MOD này?`)) return;

        try {
            const { error } = await supabase
                .from('lead_email_pages')
                .delete()
                .eq('id', page.id);

            if (error) throw error;
            alert('✅ Đã xóa!');
            fetchData();
        } catch (e: any) {
            alert('Lỗi xóa: ' + e.message);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="animate-spin text-purple-600" size={40} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Settings className="text-purple-600" /> Cấu hình Lead Email
                    </h1>
                    <p className="text-gray-500 mt-1">Phân bổ và cấu hình trang Lead Email cho từng MOD</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2 text-gray-600 hover:text-purple-600 bg-white border border-gray-200 rounded-xl shadow-sm"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={openCreateModal}
                        disabled={availableMods.length === 0}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white shadow-md transition-all
                            ${availableMods.length > 0
                                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                                : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                        <Plus size={18} /> Thêm trang mới
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="text-3xl font-bold text-purple-600">{mods.length}</div>
                    <div className="text-sm text-gray-500">Tổng MOD</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="text-3xl font-bold text-green-600">{pages.length}</div>
                    <div className="text-sm text-gray-500">Đã phân bổ</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="text-3xl font-bold text-orange-600">{availableMods.length}</div>
                    <div className="text-sm text-gray-500">Chưa phân bổ</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="text-3xl font-bold text-blue-600">{pages.filter(p => p.auto_assign_enabled).length}</div>
                    <div className="text-sm text-gray-500">Auto-Assign</div>
                </div>
            </div>

            {/* MOD List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <Users size={18} className="text-purple-600" /> Danh sách MOD và Cấu hình
                    </h2>
                </div>
                <div className="divide-y divide-gray-100">
                    {mods.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">
                            Không có MOD nào trong hệ thống
                        </div>
                    ) : (
                        mods.map(mod => {
                            const page = getPageForMod(mod.id);
                            return (
                                <div key={mod.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        {/* MOD Info */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                                                {mod.full_name?.charAt(0) || 'M'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900">{mod.full_name}</div>
                                                <div className="text-sm text-gray-500">{mod.email}</div>
                                            </div>
                                        </div>

                                        {/* Page Config or Empty State */}
                                        {page ? (
                                            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1 md:justify-end">
                                                {/* Page Info */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1">
                                                        <Mail size={14} /> {page.name}
                                                    </span>
                                                    {page.source_filter && (
                                                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
                                                            <Filter size={12} /> {page.source_filter}
                                                        </span>
                                                    )}
                                                    {page.email_script_url && (
                                                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
                                                            <Link2 size={12} /> Notify
                                                        </span>
                                                    )}
                                                    {page.auto_import_script_url && (
                                                        <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
                                                            <Download size={12} /> Import
                                                        </span>
                                                    )}
                                                    {page.auto_assign_enabled && (
                                                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
                                                            <Zap size={12} /> Auto
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openEditModal(page)}
                                                        className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit3 size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(page)}
                                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-400 text-sm italic">Chưa có cấu hình</span>
                                                <button
                                                    onClick={() => {
                                                        setSelectedModId(mod.id);
                                                        setForm(prev => ({ ...prev, name: `Lead ${mod.full_name}` }));
                                                        setShowModal(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors flex items-center gap-1"
                                                >
                                                    <Plus size={14} /> Thiết lập
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Settings size={20} className="text-purple-600" />
                                {editingPage ? 'Chỉnh sửa cấu hình' : 'Tạo trang Lead Email'}
                            </h2>
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-400 hover:text-gray-600" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* MOD Selection (only for new) */}
                            {!editingPage && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                        MOD <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={selectedModId}
                                        onChange={(e) => setSelectedModId(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                                    >
                                        <option value="">-- Chọn MOD --</option>
                                        {availableMods.map(mod => (
                                            <option key={mod.id} value={mod.id}>{mod.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Page Name */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                    Tên trang <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                                    placeholder="VD: Lead Form A"
                                />
                            </div>

                            {/* Email Script URL (Notification) */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                    🔔 Script gửi Email thông báo
                                </label>
                                <input
                                    type="text"
                                    value={form.email_script_url}
                                    onChange={(e) => setForm(prev => ({ ...prev, email_script_url: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm"
                                    placeholder="https://script.google.com/macros/s/..."
                                />
                                <p className="text-xs text-gray-400 mt-1">URL Web App để gửi email thông báo khi phân bổ khách</p>
                            </div>

                            {/* Auto Import Script URL */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                    📥 Script tự động đổ khách về
                                </label>
                                <input
                                    type="text"
                                    value={form.auto_import_script_url}
                                    onChange={(e) => setForm(prev => ({ ...prev, auto_import_script_url: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 text-sm"
                                    placeholder="https://script.google.com/macros/s/..."
                                />
                                <p className="text-xs text-gray-400 mt-1">URL Script tự động lấy khách từ Email/Form về hệ thống (khi bật "Tự động tải khách về")</p>
                            </div>

                            {/* Source Filter */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                                    Lọc theo nguồn (source)
                                </label>
                                <input
                                    type="text"
                                    value={form.source_filter}
                                    onChange={(e) => setForm(prev => ({ ...prev, source_filter: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                                    placeholder="VD: Form A, Website"
                                />
                                <p className="text-xs text-gray-400 mt-1">Chỉ hiển thị khách có source khớp (để trống = tất cả)</p>
                            </div>

                            {/* Toggles */}
                            <div className="space-y-3 pt-2">
                                {/* Auto Download Toggle */}
                                <div
                                    onClick={() => setForm(prev => ({ ...prev, auto_download_enabled: !prev.auto_download_enabled }))}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${form.auto_download_enabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap size={18} className={form.auto_download_enabled ? 'text-green-600' : 'text-gray-400'} />
                                            <span className={`font-medium ${form.auto_download_enabled ? 'text-green-700' : 'text-gray-600'}`}>
                                                Tự động tải khách về
                                            </span>
                                        </div>
                                        {form.auto_download_enabled ? <ToggleRight size={24} className="text-green-600" /> : <ToggleLeft size={24} className="text-gray-400" />}
                                    </div>
                                </div>

                                {/* Auto Assign Toggle */}
                                <div
                                    onClick={() => setForm(prev => ({ ...prev, auto_assign_enabled: !prev.auto_assign_enabled }))}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${form.auto_assign_enabled ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Users size={18} className={form.auto_assign_enabled ? 'text-orange-600' : 'text-gray-400'} />
                                            <span className={`font-medium ${form.auto_assign_enabled ? 'text-orange-700' : 'text-gray-600'}`}>
                                                Tự động phân khách
                                            </span>
                                        </div>
                                        {form.auto_assign_enabled ? <ToggleRight size={24} className="text-orange-600" /> : <ToggleLeft size={24} className="text-gray-400" />}
                                    </div>
                                </div>

                                {/* Auto Assign Config (when enabled) */}
                                {form.auto_assign_enabled && (
                                    <div className="pl-4 space-y-3 animate-fade-in">
                                        <div className="flex items-center gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.auto_assign_round_robin}
                                                    onChange={(e) => setForm(prev => ({ ...prev, auto_assign_round_robin: e.target.checked }))}
                                                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                                />
                                                <span className="text-sm text-gray-700">Round-robin</span>
                                            </label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm text-gray-700">Tối đa/ngày:</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={form.auto_assign_max_per_day}
                                                onChange={(e) => setForm(prev => ({ ...prev, auto_assign_max_per_day: parseInt(e.target.value) || 10 }))}
                                                className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-orange-400"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-md"
                            >
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                Lưu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeadEmailSettings;
