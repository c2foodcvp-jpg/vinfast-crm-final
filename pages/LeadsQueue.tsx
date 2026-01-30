
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Customer, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
    Loader2, CheckSquare, Square, UserPlus, Users, Mail, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LeadsQueue: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState<Customer[]>([]);
    const [employees, setEmployees] = useState<UserProfile[]>([]);

    // Selection State
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
    const [targetRepId, setTargetRepId] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        // Admin always has access. MOD needs can_access_leads_queue permission
        const hasAccess = isAdmin || (isMod && userProfile?.can_access_leads_queue);
        if (!hasAccess) {
            navigate('/');
            return;
        }
        fetchData();
    }, [userProfile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Pendings Leads (sales_rep IS NULL or dedicated status)
            // Assuming 'sales_rep' is text name, usually we check creator_id or a specific flag. 
            // Better strategy: Check if 'sales_rep' is null OR 'System' OR empty
            const { data: leadData, error } = await supabase
                .from('customers')
                .select('*')
                .or('sales_rep.is.null,sales_rep.eq.,sales_rep.eq.System,sales_rep.eq.Chưa phân bổ')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLeads(leadData as Customer[]);

            // 2. Fetch Active Employees for Assignment
            // Admin sees all, MOD only sees their team members
            let empQuery = supabase
                .from('profiles')
                .select('*')
                .eq('status', 'active')
                .order('full_name');

            // MOD only sees their team (manager_id = their own id) PLUS THEMSELVES
            if (isMod && !isAdmin && userProfile?.id) {
                // Modified query to include self (id equal to userProfile.id) OR subordinates (manager_id equal to userProfile.id)
                empQuery = empQuery.or(`manager_id.eq.${userProfile.id},id.eq.${userProfile.id}`);
            }

            const { data: empData } = await empQuery;
            if (empData) setEmployees(empData as UserProfile[]);

        } catch (e) {
            console.error("Error fetching leads", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelfAssign = async () => {
        if (selectedLeadIds.length === 0 || !userProfile) return;
        if (!window.confirm(`Bạn có chắc muốn NHẬN ${selectedLeadIds.length} khách hàng này về danh sách của mình?`)) return;

        setIsAssigning(true);
        try {
            // Update Customers
            const { error } = await supabase
                .from('customers')
                .update({
                    sales_rep: userProfile.full_name,
                    creator_id: userProfile.id,
                    pending_transfer_to: null,
                    is_acknowledged: true, // Auto-acknowledge for self-assign
                    updated_at: new Date().toISOString()
                })
                .in('id', selectedLeadIds);

            if (error) throw error;

            // Log Interactions
            const notes = selectedLeadIds.map(leadId => ({
                customer_id: leadId,
                user_id: userProfile.id,
                type: 'note',
                content: `[Tự nhận khách] ${userProfile.full_name} đã nhận khách này từ danh sách Lead.`,
                created_at: new Date().toISOString()
            }));

            await supabase.from('interactions').insert(notes);

            alert(`✅ Đã nhận ${selectedLeadIds.length} khách thành công!`);
            setSelectedLeadIds([]);
            fetchData();
        } catch (e: any) {
            alert("Lỗi nhận khách: " + e.message);
        } finally {
            setIsAssigning(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedLeadIds.length === leads.length) {
            setSelectedLeadIds([]);
        } else {
            setSelectedLeadIds(leads.map(l => l.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        if (selectedLeadIds.includes(id)) {
            setSelectedLeadIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedLeadIds(prev => [...prev, id]);
        }
    };

    // Email Notification State
    const [sendEmail, setSendEmail] = useState(true);
    const [adminNote, setAdminNote] = useState('');
    const [emailScriptUrl, setEmailScriptUrl] = useState<string>('');

    useEffect(() => {
        // Fetch Email Script URL from app_settings
        const fetchEmailConfig = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'email_script_url').maybeSingle();
            if (data?.value) setEmailScriptUrl(data.value);
        };
        fetchEmailConfig();
    }, []);

    const handleAssign = async () => {
        if (selectedLeadIds.length === 0) return;
        if (!targetRepId) {
            alert("Vui lòng chọn nhân viên để phân bổ!");
            return;
        }

        const targetRep = employees.find(e => e.id === targetRepId);
        if (!targetRep) return;

        setIsAssigning(true);
        try {
            // Update Customers - set is_acknowledged = false for tracking
            const { error } = await supabase
                .from('customers')
                .update({
                    sales_rep: targetRep.full_name,
                    creator_id: targetRepId,
                    pending_transfer_to: null,
                    is_acknowledged: false, // Mark as not yet acknowledged
                    updated_at: new Date().toISOString()
                })
                .in('id', selectedLeadIds);

            if (error) throw error;

            // Log Interactions
            const notes = selectedLeadIds.map(leadId => ({
                customer_id: leadId,
                user_id: userProfile?.id,
                type: 'note',
                content: `[Phân bổ từ Email] Admin đã giao khách cho ${targetRep.full_name}${adminNote ? `. Ghi chú: ${adminNote}` : ''}`,
                created_at: new Date().toISOString()
            }));

            await supabase.from('interactions').insert(notes);

            // Send Email Notification if enabled
            if (sendEmail && emailScriptUrl && targetRep.email) {
                try {
                    // Get full customer data for email
                    const assignedCustomers = leads.filter(l => selectedLeadIds.includes(l.id)).map(c => ({
                        name: c.name,
                        phone: c.phone,
                        interest: c.interest || 'Chưa rõ',
                        location: c.location || ''
                    }));

                    const emailPayload = {
                        recipientEmail: targetRep.email,
                        recipientName: targetRep.full_name,
                        customers: assignedCustomers,
                        adminNote: adminNote || null
                    };

                    // Call Google Apps Script Web App
                    await fetch(emailScriptUrl, {
                        method: 'POST',
                        mode: 'no-cors', // Google Apps Script requires no-cors
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(emailPayload)
                    });

                    console.log('✅ Email notification sent to:', targetRep.email);
                } catch (emailError) {
                    console.error('⚠️ Failed to send email:', emailError);
                    // Don't block the assignment if email fails
                }
            }

            alert(`✅ Đã phân bổ ${selectedLeadIds.length} khách cho ${targetRep.full_name}!${sendEmail && targetRep.email ? '\n📧 Email thông báo đã được gửi.' : ''}`);
            setSelectedLeadIds([]);
            setAdminNote('');
            fetchData();

        } catch (e: any) {
            alert("Lỗi phân bổ: " + e.message);
        } finally {
            setIsAssigning(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-purple-600" size={40} /></div>;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Users className="text-purple-600" /> Trang Chờ Phân Bổ
                    </h1>
                    <p className="text-gray-500 mt-1">Danh sách khách hàng từ Email/Web chưa có Sale chăm sóc</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchData} className="p-2 text-gray-600 hover:text-purple-600 bg-white border border-gray-200 rounded-xl shadow-sm">
                        <RefreshCw size={20} />
                    </button>
                    <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                        <Mail size={18} /> {leads.length} Khách chờ
                    </div>
                </div>
            </div>

            {/* Assignment Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6 sticky top-20 z-10 transition-all">
                <div className="flex flex-col gap-4">
                    {/* Row 1: Selection + Employee Picker + Button */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">

                        {/* Selected Count & Select All Toggle */}
                        <div className="flex items-center justify-between w-full md:w-auto gap-3">
                            <div className="flex items-center gap-2 text-gray-700 font-medium">
                                <CheckSquare size={20} className="text-purple-600" />
                                <span>Đã chọn: <strong className="text-gray-900">{selectedLeadIds.length}</strong></span>
                            </div>

                            {/* Mobile Select All Button */}
                            <button
                                onClick={toggleSelectAll}
                                className="md:hidden text-sm text-purple-600 font-medium hover:bg-purple-50 px-3 py-1 rounded-lg transition-colors border border-purple-100"
                            >
                                {selectedLeadIds.length === leads.length && leads.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col w-full md:w-auto md:flex-row gap-3">
                            <select
                                value={targetRepId}
                                onChange={(e) => setTargetRepId(e.target.value)}
                                className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-purple-500 focus:border-purple-500 block w-full md:w-64 p-2.5 outline-none font-bold"
                                disabled={selectedLeadIds.length === 0}
                            >
                                <option value="">-- Chọn Sale tiếp nhận --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3 w-full md:flex md:w-auto">
                                <button
                                    onClick={handleAssign}
                                    disabled={selectedLeadIds.length === 0 || !targetRepId || isAssigning}
                                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white transition-all shadow-md whitespace-nowrap w-full md:w-auto
                                        ${selectedLeadIds.length > 0 && targetRepId
                                            ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                                            : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
                                >
                                    {isAssigning ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                                    Phân Bổ
                                </button>

                                <button
                                    onClick={handleSelfAssign}
                                    disabled={selectedLeadIds.length === 0 || isAssigning}
                                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white transition-all shadow-md whitespace-nowrap w-full md:w-auto
                                        ${selectedLeadIds.length > 0
                                            ? 'bg-green-600 hover:bg-green-700 shadow-green-200'
                                            : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
                                    title="Nhận các khách hàng đã chọn về danh sách của tôi"
                                >
                                    <CheckSquare size={18} /> Nhận ngay
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Email Options (only show when customers selected) */}
                    {selectedLeadIds.length > 0 && (
                        <div className="border-t border-gray-100 pt-4 space-y-3 animate-fade-in">
                            {/* Email Toggle */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Mail size={18} className={sendEmail ? 'text-green-600' : 'text-gray-400'} />
                                    <span className="text-sm font-medium text-gray-700">Gửi email thông báo</span>
                                    {!emailScriptUrl && <span className="text-xs text-orange-500">(Chưa config)</span>}
                                </div>
                                <div
                                    onClick={() => setSendEmail(!sendEmail)}
                                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${sendEmail ? 'bg-green-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${sendEmail ? 'translate-x-5' : ''}`}></div>
                                </div>
                            </div>

                            {/* Admin Note */}
                            {sendEmail && (
                                <div className="animate-fade-in">
                                    <textarea
                                        value={adminNote}
                                        onChange={(e) => setAdminNote(e.target.value)}
                                        placeholder="Ghi chú cho Sale (tuỳ chọn)..."
                                        className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 outline-none focus:border-purple-400 resize-none"
                                        rows={2}
                                    />
                                </div>
                            )}

                            {/* Target Employee Info */}
                            {targetRepId && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 border border-green-100 rounded-xl p-3 animate-fade-in">
                                    <CheckSquare size={16} className="text-green-600" />
                                    <span>Sẽ gửi email đến: <strong className="text-green-700">{employees.find(e => e.id === targetRepId)?.email || 'Không có email'}</strong></span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>


            {/* Content: Mobile Cards + Desktop Table */}
            <div>
                {/* Mobile View: Cards */}
                <div className="md:hidden flex flex-col gap-3">
                    {leads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-gray-400 bg-white p-8 rounded-2xl border border-gray-200 border-dashed">
                            <div className="bg-gray-50 p-4 rounded-full mb-3"><CheckSquare size={32} /></div>
                            <p className="font-bold text-center">Không có khách hàng nào đang chờ.</p>
                        </div>
                    ) : (
                        leads.map((lead) => (
                            <div
                                key={lead.id}
                                onClick={() => toggleSelectOne(lead.id)}
                                className={`p-4 rounded-2xl border transition-all active:scale-[0.98] ${selectedLeadIds.includes(lead.id)
                                        ? 'bg-purple-50 border-purple-300 shadow-sm ring-1 ring-purple-200'
                                        : 'bg-white border-gray-200 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 flex-shrink-0 transition-colors ${selectedLeadIds.includes(lead.id) ? 'text-purple-600' : 'text-gray-300'}`}>
                                        {selectedLeadIds.includes(lead.id) ? <CheckSquare size={24} /> : <Square size={24} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="font-bold text-gray-900 truncate text-base leading-tight">{lead.name}</h3>
                                            <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                {new Date(lead.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm text-gray-600">{lead.phone}</span>
                                            <span className="text-gray-300">|</span>
                                            <span className="text-sm font-medium text-purple-600">{lead.interest || 'N/A'}</span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                                {lead.source || 'Email'}
                                            </span>
                                            {lead.notes && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-500 bg-gray-50 border border-gray-100 max-w-full truncate">
                                                    {lead.notes}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th scope="col" className="p-4 w-4">
                                        <div className="flex items-center">
                                            <button onClick={toggleSelectAll}>
                                                {leads.length > 0 && selectedLeadIds.length === leads.length ? <CheckSquare className="text-purple-600" size={20} /> : <Square className="text-gray-400" size={20} />}
                                            </button>
                                        </div>
                                    </th>
                                    <th className="px-6 py-3">Ngày nhận</th>
                                    <th className="px-6 py-3">Khách hàng</th>
                                    <th className="px-6 py-3">SĐT / Email</th>
                                    <th className="px-6 py-3">Nguồn</th>
                                    <th className="px-6 py-3">Quan tâm</th>
                                    <th className="px-6 py-3 md:table-cell hidden">Nội dung</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-gray-400">
                                                <div className="bg-gray-50 p-4 rounded-full mb-3"><CheckSquare size={32} /></div>
                                                <p className="font-bold">Tuyệt vời! Không có khách hàng nào đang chờ.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    leads.map((lead) => (
                                        <tr key={lead.id} className={`hover:bg-purple-50 transition-colors ${selectedLeadIds.includes(lead.id) ? 'bg-purple-50' : 'bg-white'}`}>
                                            <td className="p-4 w-4">
                                                <button onClick={() => toggleSelectOne(lead.id)}>
                                                    {selectedLeadIds.includes(lead.id) ? <CheckSquare className="text-purple-600" size={20} /> : <Square className="text-gray-300" size={20} />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 font-medium">
                                                {new Date(lead.created_at).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-900 cursor-pointer hover:text-purple-600" onClick={() => navigate(`/customers/${lead.id}`)}>
                                                {lead.name}
                                            </td>
                                            <td className="px-6 py-4">
                                                {lead.phone}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded border border-blue-200">
                                                    {lead.source || 'Email Form'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-purple-700">
                                                {lead.interest || '---'}
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate text-gray-400 md:table-cell hidden">
                                                {lead.notes || '---'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeadsQueue;
