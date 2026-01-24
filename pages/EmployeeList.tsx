
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, UserRole, AccessDelegation } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Search, Shield, User, Edit2, Save, X, AlertTriangle, ShieldCheck, Users, Copy, Terminal, Trash2, Clock, LogOut, ArrowRightLeft, Share2, Database, Eye, Lock, UserMinus, Key, RotateCcw } from 'lucide-react';

const EmployeeList: React.FC = () => {
    const { userProfile } = useAuth();
    const [employees, setEmployees] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'pending'>('pending');

    // Edit Role State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempRole, setTempRole] = useState<UserRole>(UserRole.EMPLOYEE);
    const [tempManagerId, setTempManagerId] = useState<string>('');
    const [tempIsPartTime, setTempIsPartTime] = useState(false);

    // Approval Modal State
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [selectedUserToApprove, setSelectedUserToApprove] = useState<UserProfile | null>(null);
    const [roleToAssign, setRoleToAssign] = useState<UserRole>(UserRole.EMPLOYEE);
    const [managerIdToAssign, setManagerIdToAssign] = useState<string>('');
    const [assignAsPartTime, setAssignAsPartTime] = useState(false);

    // Delegate Modal State
    const [showDelegateModal, setShowDelegateModal] = useState(false);
    const [delegations, setDelegations] = useState<AccessDelegation[]>([]);
    const [delegateForm, setDelegateForm] = useState({ recipientId: '', targetUserId: '', accessLevel: 'view' as 'view' | 'edit' });
    const [delegationToDelete, setDelegationToDelete] = useState<string | null>(null);

    // Permission Lock Modal
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [targetUserForPerm, setTargetUserForPerm] = useState<UserProfile | null>(null);
    const [permForm, setPermForm] = useState({ lockAdd: false, lockView: false });

    // Confirmation Modal State (Replaces window.confirm)
    const [confirmAction, setConfirmAction] = useState<{
        type: 'terminate' | 'reject' | 'delete' | 'reactivate';
        payload: any;
        title: string;
        message: string;
    } | null>(null);

    // RLS Instruction Modal State
    const [showRLSModal, setShowRLSModal] = useState(false);
    const [showDelegateSql, setShowDelegateSql] = useState(false);

    const isAdmin = userProfile?.role === UserRole.ADMIN;
    const isMod = userProfile?.role === UserRole.MOD;

    useEffect(() => {
        fetchEmployees();
    }, [userProfile]);

    const fetchEmployees = async () => {
        if (!userProfile) return;
        try {
            setLoading(true);

            let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });

            if (!isAdmin) {
                if (isMod) {
                    query = query.or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id},role.eq.admin`);
                } else {
                    if (userProfile.manager_id) {
                        query = query.or(`id.eq.${userProfile.id},id.eq.${userProfile.manager_id},manager_id.eq.${userProfile.manager_id},role.eq.admin`);
                    } else {
                        query = query.or(`id.eq.${userProfile.id},role.eq.admin`);
                    }
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setEmployees(data as UserProfile[] || []);
        } catch (err) {
            console.error("Error fetching employees:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDelegations = async () => {
        try {
            const { data, error } = await supabase.from('access_delegations').select('*');
            if (error) {
                if (error.code === '42P01') { setShowDelegateSql(true); return; } // Table missing
                throw error;
            }
            setDelegations(data as AccessDelegation[]);
        } catch (e) { console.error(e); }
    };

    const handleCreateDelegation = async () => {
        if (!delegateForm.recipientId || !delegateForm.targetUserId) return;
        if (delegateForm.recipientId === delegateForm.targetUserId) { alert("Người nhận và người bị xem không được trùng nhau."); return; }

        try {
            // Check existing
            const existing = delegations.find(d => d.recipient_id === delegateForm.recipientId && d.target_user_id === delegateForm.targetUserId);
            if (existing) {
                // Update
                await supabase.from('access_delegations').update({
                    access_level: delegateForm.accessLevel,
                    grantor_id: userProfile?.id
                }).eq('id', existing.id);
            } else {
                // Insert
                await supabase.from('access_delegations').insert([{
                    recipient_id: delegateForm.recipientId,
                    target_user_id: delegateForm.targetUserId,
                    access_level: delegateForm.accessLevel,
                    grantor_id: userProfile?.id
                }]);
            }
            alert("Đã phân quyền thành công!");
            fetchDelegations();
        } catch (e: any) { alert("Lỗi phân quyền: " + e.message); }
    };

    const handleRevokeDelegation = (id: string) => {
        setDelegationToDelete(id);
    };

    const confirmRevoke = async () => {
        if (!delegationToDelete) return;
        try {
            const { error } = await supabase.from('access_delegations').delete().eq('id', delegationToDelete);
            if (error) throw error;
            fetchDelegations();
        } catch (e) { console.error("Error revoking:", e); }
        setDelegationToDelete(null);
    };

    const getSafeErrorMessage = (err: any) => {
        if (typeof err === 'string') return err;
        if (err?.message) return err.message;
        return JSON.stringify(err);
    };

    const availableManagers = employees.filter(e =>
        e.status === 'active' &&
        (e.role === UserRole.MOD || e.role === UserRole.ADMIN) &&
        e.id !== selectedUserToApprove?.id
    );

    const getManagerName = (managerId?: string | null) => {
        if (!managerId) return null;
        const manager = employees.find(e => e.id === managerId);
        return manager ? manager.full_name : 'Không xác định';
    };

    const openApprovalModal = (user: UserProfile) => {
        setSelectedUserToApprove(user);
        setRoleToAssign(UserRole.EMPLOYEE);
        setAssignAsPartTime(false);
        setManagerIdToAssign(userProfile?.role === UserRole.MOD ? userProfile.id : '');
        setIsApprovalModalOpen(true);
    };

    const closeApprovalModal = () => {
        setIsApprovalModalOpen(false);
        setSelectedUserToApprove(null);
    };

    const confirmApproval = async () => {
        if (!selectedUserToApprove) return;
        const updates: any = {
            status: 'active',
            role: roleToAssign,
            is_part_time: roleToAssign === UserRole.EMPLOYEE ? assignAsPartTime : false
        };
        if (roleToAssign === UserRole.EMPLOYEE && managerIdToAssign) {
            updates.manager_id = managerIdToAssign;
        } else {
            updates.manager_id = null;
        }

        const originalEmployees = [...employees];
        const updatedEmployees = employees.map(e =>
            e.id === selectedUserToApprove.id ? { ...e, ...updates } : e
        );
        setEmployees(updatedEmployees);
        closeApprovalModal();

        try {
            const { data, error } = await supabase.from('profiles').update(updates).eq('id', selectedUserToApprove.id).select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error("RLS_BLOCK");
        } catch (err: any) {
            console.error(err);
            setEmployees(originalEmployees);
            const msg = getSafeErrorMessage(err);
            if (msg === "RLS_BLOCK" || msg.includes("policy")) { setShowRLSModal(true); } else { alert("Lỗi hệ thống: " + msg); }
        }
    };

    const handleReject = (id: string) => {
        setConfirmAction({
            type: 'reject',
            payload: id,
            title: 'Từ chối thành viên?',
            message: 'Hồ sơ này sẽ bị từ chối và chuyển sang trạng thái Blocked.'
        });
    };

    const handleDeleteUser = (id: string) => {
        setConfirmAction({
            type: 'delete',
            payload: id,
            title: 'Xóa Vĩnh Viễn?',
            message: 'CẢNH BÁO: Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa nhân viên này khỏi hệ thống?'
        });
    };

    const handleTerminateContract = (employee: UserProfile) => {
        setConfirmAction({
            type: 'terminate',
            payload: employee,
            title: 'Chấm dứt Hợp đồng?',
            message: `XÁC NHẬN: Bạn có chắc chắn muốn chấm dứt hợp đồng với ${employee.full_name}?\n\nHậu quả:\n- Tài khoản bị KHÓA (Blocked).\n- Mất quyền truy cập hệ thống.\n- Dừng tính lương/thưởng.`
        });
    };

    const handleReactivate = (employee: UserProfile) => {
        setConfirmAction({
            type: 'reactivate',
            payload: employee,
            title: 'Mở lại Hợp đồng?',
            message: `XÁC NHẬN: Bạn có chắc chắn muốn mở lại hợp đồng cho ${employee.full_name}?\n\n- Tài khoản sẽ được MỞ KHÓA (Active).\n- Quyền truy cập sẽ được khôi phục theo vai trò hiện tại.`
        });
    };

    const executeConfirmAction = async () => {
        if (!confirmAction) return;
        const { type, payload } = confirmAction;
        setConfirmAction(null);

        if (type === 'reject') {
            const id = payload as string;
            const originalEmployees = [...employees];
            setEmployees(employees.map(e => e.id === id ? { ...e, status: 'blocked' } : e));
            try {
                const { data, error } = await supabase.from('profiles').update({ status: 'blocked' }).eq('id', id).select();
                if (error) throw error;
                if (!data || data.length === 0) throw new Error("RLS_BLOCK");
            } catch (err: any) {
                setEmployees(originalEmployees);
                const msg = getSafeErrorMessage(err);
                if (msg === "RLS_BLOCK" || msg.includes("policy")) { setShowRLSModal(true); } else { alert("Lỗi: " + msg); }
            }
        }
        else if (type === 'delete') {
            const id = payload as string;
            const originalEmployees = [...employees];
            setEmployees(employees.filter(e => e.id !== id));
            try {
                const { error } = await supabase.from('profiles').delete().eq('id', id);
                if (error) throw error;
            } catch (err: any) {
                setEmployees(originalEmployees);
                alert("Lỗi xóa nhân viên: " + getSafeErrorMessage(err));
            }
        }
        else if (type === 'terminate') {
            const employee = payload as UserProfile;
            const originalEmployees = [...employees];
            setEmployees(employees.map(e => e.id === employee.id ? { ...e, status: 'blocked' } : e));

            try {
                const { data, error } = await supabase.from('profiles').update({ status: 'blocked' }).eq('id', employee.id).select();
                if (error) throw error;
                if (!data || data.length === 0) throw new Error("RLS_BLOCK");

                try {
                    await supabase.from('interactions').insert([{
                        user_id: userProfile?.id,
                        customer_id: null,
                        type: 'note',
                        content: `[HỆ THỐNG] Đã chấm dứt hợp đồng với ${employee.full_name} (${employee.role}).`,
                        created_at: new Date().toISOString()
                    }]);
                } catch (e) { }

                alert("Đã chấm dứt hợp đồng thành công!");
            } catch (err: any) {
                setEmployees(originalEmployees);
                const msg = getSafeErrorMessage(err);
                if (msg === "RLS_BLOCK" || msg.includes("policy")) {
                    setShowRLSModal(true);
                } else {
                    alert("Có lỗi xảy ra: " + msg);
                }
            }
        }
        else if (type === 'reactivate') {
            const employee = payload as UserProfile;
            const originalEmployees = [...employees];
            setEmployees(employees.map(e => e.id === employee.id ? { ...e, status: 'active' } : e));

            try {
                const { data, error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', employee.id).select();
                if (error) throw error;
                if (!data || data.length === 0) throw new Error("RLS_BLOCK");

                try {
                    await supabase.from('interactions').insert([{
                        user_id: userProfile?.id,
                        customer_id: null,
                        type: 'note',
                        content: `[HỆ THỐNG] Admin Đã mở lại hợp đồng cho ${employee.full_name}.`,
                        created_at: new Date().toISOString()
                    }]);
                } catch (e) { }

                alert("Đã mở lại hợp đồng thành công!");
            } catch (err: any) {
                setEmployees(originalEmployees);
                const msg = getSafeErrorMessage(err);
                if (msg === "RLS_BLOCK" || msg.includes("policy")) {
                    setShowRLSModal(true);
                } else {
                    alert("Có lỗi xảy ra: " + msg);
                }
            }
        }
    };

    const openPermissionModal = (emp: UserProfile) => {
        setTargetUserForPerm(emp);
        setPermForm({ lockAdd: !!emp.is_locked_add, lockView: !!emp.is_locked_view });
        setShowPermissionModal(true);
    };

    const handleSavePermission = async () => {
        if (!targetUserForPerm) return;
        try {
            const updates = {
                is_locked_add: permForm.lockAdd,
                is_locked_view: permForm.lockView
            };
            const { error } = await supabase.from('profiles').update(updates).eq('id', targetUserForPerm.id);
            if (error) throw error;

            setEmployees(prev => prev.map(e => e.id === targetUserForPerm.id ? { ...e, ...updates } : e));
            setShowPermissionModal(false);
            alert("Đã cập nhật quyền hạn!");
        } catch (e: any) {
            if (e.code === '42703' || e.message?.includes('column')) {
                setShowRLSModal(true);
            } else {
                alert("Lỗi cập nhật: " + e.message);
            }
        }
    };

    const startEditRole = (employee: UserProfile) => {
        setEditingId(employee.id);
        setTempRole(employee.role);
        setTempManagerId(employee.manager_id || '');
        setTempIsPartTime(employee.is_part_time || false);
    };

    const saveRole = async (id: string) => {
        const originalEmployees = [...employees];
        const updates: any = { role: tempRole };
        if (tempRole === UserRole.EMPLOYEE) {
            updates.manager_id = tempManagerId || null;
            updates.is_part_time = tempIsPartTime;
        } else {
            updates.manager_id = null;
            updates.is_part_time = false;
        }
        setEmployees(employees.map(e => e.id === id ? { ...e, ...updates } : e));
        setEditingId(null);
        try {
            const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select();
            if (error) throw error;
            if (!data || data.length === 0) throw new Error("RLS_BLOCK");
        } catch (err: any) {
            setEmployees(originalEmployees);
            const msg = getSafeErrorMessage(err);
            if (msg === "RLS_BLOCK" || msg.includes("policy")) { setShowRLSModal(true); } else { alert("Lỗi: " + msg); }
        }
    };

    const filteredEmployees = employees.filter(e => {
        if (activeTab === 'pending') return e.status === 'pending';
        return e.status === 'active' || e.status === 'blocked';
    });

    const delegateSql = `
create table if not exists public.access_delegations (
  id uuid default gen_random_uuid() primary key,
  grantor_id uuid references public.profiles(id),
  recipient_id uuid references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  access_level text check (access_level in ('view', 'edit')),
  created_at timestamptz default now()
);
alter table public.access_delegations enable row level security;
create policy "Allow all authenticated" on public.access_delegations for all using (true);
`;

    if (loading) return <div className="p-8 text-center text-gray-500">Đang tải danh sách nhân sự...</div>;

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900">Quản lý Nhân sự (Team)</h1>
                {(isAdmin || isMod) && (
                    <button onClick={() => { setShowDelegateModal(true); fetchDelegations(); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">
                        <Share2 size={18} /> Phân quyền Data
                    </button>
                )}
            </div>

            <div className="flex border-b border-gray-200">
                <button onClick={() => setActiveTab('pending')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'pending' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    Chờ duyệt <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-primary-100' : 'bg-gray-100'}`}>{employees.filter(e => e.status === 'pending').length}</span>
                </button>
                <button onClick={() => setActiveTab('all')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    Danh sách nhân viên
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Thông tin</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Liên hệ</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Vai trò / Quản lý bởi</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredEmployees.length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center text-gray-500">Không có dữ liệu.</td></tr>
                            ) : (
                                filteredEmployees.map(emp => (
                                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden">{emp.avatar_url ? (<img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />) : (emp.full_name?.charAt(0).toUpperCase())}</div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-gray-900 cursor-pointer hover:text-primary-600" onClick={() => (isAdmin || isMod) && emp.status === 'active' && window.location.assign('#/employees/' + emp.id)}>{emp.full_name}</p>
                                                        {emp.is_part_time && (<span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[9px] font-bold rounded uppercase border border-orange-200">Part-time</span>)}
                                                        {/* Permission Icons */}
                                                        {(emp.is_locked_add || emp.is_locked_view) && <div className="flex gap-1 ml-1" title="Bị hạn chế quyền"><Lock size={12} className="text-red-500" /></div>}
                                                    </div>
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${emp.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : emp.status === 'blocked' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{emp.status}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm"><p className="text-gray-900 font-medium">{emp.phone}</p><p className="text-gray-500">{emp.email}</p></td>
                                        <td className="px-6 py-4">
                                            {isAdmin && editingId === emp.id ? (
                                                <div className="flex flex-col gap-2 bg-white border border-primary-300 rounded-lg p-2 shadow-sm min-w-[200px]">
                                                    <div className="flex items-center gap-2"><select value={tempRole} onChange={(e) => setTempRole(e.target.value as UserRole)} className="text-sm border rounded px-1 py-1 w-full bg-white outline-none focus:ring-1 focus:ring-primary-500"><option value={UserRole.EMPLOYEE}>Nhân viên</option><option value={UserRole.MOD}>Quản lý (MOD)</option><option value={UserRole.ADMIN}>Admin</option></select></div>
                                                    {tempRole === UserRole.EMPLOYEE && (<><select value={tempManagerId} onChange={(e) => setTempManagerId(e.target.value)} className="text-xs border rounded px-1 py-1 w-full bg-white outline-none text-gray-700"><option value="">-- Chọn quản lý --</option>{employees.filter(m => (m.role === 'admin' || m.role === 'mod') && m.id !== emp.id).map(m => (<option key={m.id} value={m.id}>{m.full_name}</option>))}</select><div className="flex items-center gap-2 mt-1"><input type="checkbox" id={`parttime-${emp.id}`} checked={tempIsPartTime} onChange={e => setTempIsPartTime(e.target.checked)} className="rounded text-orange-600 focus:ring-orange-500" /><label htmlFor={`parttime-${emp.id}`} className="text-xs font-bold text-orange-700">Part-time</label></div></>)}
                                                    <div className="flex justify-end gap-2 mt-1"><button onClick={() => saveRole(emp.id)} className="text-green-600 hover:bg-green-50 p-1 rounded-md transition-colors bg-green-50"><Save size={16} /></button><button onClick={() => setEditingId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded-md transition-colors bg-gray-50"><X size={16} /></button></div>
                                                </div>
                                            ) : (
                                                <div className="space-y-1"><div className="flex items-center gap-2"><span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-md border ${emp.role === UserRole.ADMIN ? 'bg-red-50 text-red-700 border-red-100' : emp.role === UserRole.MOD ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>{emp.role === UserRole.ADMIN && <Shield size={12} />}{emp.role === UserRole.MOD ? 'Quản lý' : emp.role === UserRole.ADMIN ? 'Admin' : 'Sales'}</span>{isAdmin && emp.status === 'active' && (<button onClick={() => startEditRole(emp)} className="text-gray-400 hover:text-primary-600 p-1 rounded hover:bg-gray-100 transition-colors"><Edit2 size={14} /></button>)}</div>{emp.manager_id && emp.role === UserRole.EMPLOYEE && (<div className="flex items-center gap-1 text-xs text-gray-500"><Users size={12} className="text-gray-400" /> Quản lý bởi: <span className="font-semibold text-gray-700">{getManagerName(emp.manager_id)}</span></div>)}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {emp.status === 'pending' && (isAdmin || isMod) ? (<div className="flex justify-end gap-2"><button onClick={() => openApprovalModal(emp)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-md shadow-green-200 transition-all active:scale-95"><CheckCircle size={14} /> Duyệt</button><button onClick={() => handleReject(emp.id)} className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-all active:scale-95"><XCircle size={14} /> Từ chối</button></div>) :
                                                (isAdmin || isMod) && emp.status === 'active' ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => openPermissionModal(emp)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Cấu hình Quyền hạn (Khóa/Mở)"><Key size={18} /></button>
                                                        <button onClick={() => handleTerminateContract(emp)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Chấm dứt Hợp đồng"><UserMinus size={18} /></button>
                                                        {isAdmin && <button onClick={() => handleDeleteUser(emp.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa Vĩnh viễn"><Trash2 size={18} /></button>}
                                                    </div>
                                                ) : (isAdmin && emp.status === 'blocked') ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleReactivate(emp)} className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Mở lại Hợp đồng"><RotateCcw size={18} /></button>
                                                        <button onClick={() => handleDeleteUser(emp.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa Vĩnh viễn"><Trash2 size={18} /></button>
                                                    </div>
                                                ) : null
                                            }
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- CONFIRMATION MODAL (CUSTOM UI) --- */}
            {confirmAction && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border-2 border-gray-100">
                        <div className="flex flex-col items-center text-center">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${confirmAction.type === 'terminate' ? 'bg-red-100 text-red-600' : confirmAction.type === 'delete' ? 'bg-red-100 text-red-600' : confirmAction.type === 'reactivate' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} animate-pulse`}>
                                {confirmAction.type === 'terminate' ? <UserMinus size={32} /> : confirmAction.type === 'delete' ? <Trash2 size={32} /> : confirmAction.type === 'reactivate' ? <RotateCcw size={32} /> : <AlertTriangle size={32} />}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmAction.title}</h3>
                            <div className="bg-gray-50 p-4 rounded-xl text-left w-full mb-4 border border-gray-200 whitespace-pre-wrap">
                                <p className="text-sm text-gray-700">{confirmAction.message}</p>
                            </div>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setConfirmAction(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                                <button onClick={executeConfirmAction} className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-colors ${confirmAction.type === 'terminate' || confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : confirmAction.type === 'reactivate' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-orange-600 hover:bg-orange-700 shadow-orange-200'}`}>
                                    Xác nhận
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PERMISSION MODAL --- */}
            {showPermissionModal && targetUserForPerm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Key className="text-blue-600" /> Phân quyền Hạn chế</h3>
                            <button onClick={() => setShowPermissionModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">Điều chỉnh quyền hạn tạm thời cho <strong>{targetUserForPerm.full_name}</strong>.</p>

                        <div className="space-y-3 mb-6">
                            <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl">
                                <div>
                                    <span className="block text-sm font-bold text-red-900">Khóa quyền Thêm khách</span>
                                    <span className="text-xs text-red-700">Không thể thêm khách mới.</span>
                                </div>
                                <div onClick={() => setPermForm({ ...permForm, lockAdd: !permForm.lockAdd })} className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${permForm.lockAdd ? 'bg-red-600' : 'bg-gray-300'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${permForm.lockAdd ? 'translate-x-5' : ''}`}></div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-xl">
                                <div>
                                    <span className="block text-sm font-bold text-orange-900">Khóa quyền Xem/Sửa</span>
                                    <span className="text-xs text-orange-700">Không thấy danh sách khách.</span>
                                </div>
                                <div onClick={() => setPermForm({ ...permForm, lockView: !permForm.lockView })} className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${permForm.lockView ? 'bg-orange-600' : 'bg-gray-300'}`}>
                                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${permForm.lockView ? 'translate-x-5' : ''}`}></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowPermissionModal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Hủy</button>
                            <button onClick={handleSavePermission} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200">Lưu</button>
                        </div>
                    </div>
                </div>
            )}

            {isApprovalModalOpen && selectedUserToApprove && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100"><div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Shield className="text-primary-600" size={20} /> Phê duyệt thành viên</h3><button onClick={closeApprovalModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div><div className="p-6 space-y-4"><div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100"><div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg"> {selectedUserToApprove.full_name?.charAt(0).toUpperCase()}</div><div><p className="font-bold text-gray-900">{selectedUserToApprove.full_name}</p><p className="text-sm text-gray-600">{selectedUserToApprove.email}</p><p className="text-xs text-gray-500 mt-0.5">{selectedUserToApprove.phone}</p></div></div><div><label className="block text-sm font-semibold text-gray-700 mb-2">1. Cấp vai trò</label><div className="grid grid-cols-1 gap-2"><button onClick={() => setRoleToAssign(UserRole.EMPLOYEE)} className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${roleToAssign === UserRole.EMPLOYEE ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-300'}`}><div className="p-2 bg-white rounded-lg shadow-sm text-gray-600"><User size={18} /></div><div><p className={`font-semibold text-sm ${roleToAssign === UserRole.EMPLOYEE ? 'text-primary-900' : 'text-gray-900'}`}>Nhân viên Sales</p><p className="text-xs text-gray-500">Quyền cơ bản.</p></div></button><button onClick={() => setRoleToAssign(UserRole.MOD)} className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${roleToAssign === UserRole.MOD ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-200 hover:border-gray-300'}`}><div className="p-2 bg-white rounded-lg shadow-sm text-purple-600"><Shield size={18} /></div><div><p className={`font-semibold text-sm ${roleToAssign === UserRole.MOD ? 'text-purple-900' : 'text-gray-900'}`}>Quản lý (MOD)</p><p className="text-xs text-gray-500">Quản lý Sales team.</p></div></button>{isAdmin && (<button onClick={() => setRoleToAssign(UserRole.ADMIN)} className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${roleToAssign === UserRole.ADMIN ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-gray-200 hover:border-gray-300'}`}><div className="p-2 bg-white rounded-lg shadow-sm text-red-600"><ShieldCheck size={18} className="text-red-600" /></div><div><p className={`font-semibold text-sm ${roleToAssign === UserRole.ADMIN ? 'text-red-900' : 'text-gray-900'}`}>Administrator</p><p className="text-xs text-gray-500">Toàn quyền.</p></div></button>)}</div></div>{roleToAssign === UserRole.EMPLOYEE && (<div className="animate-fade-in space-y-4"><div><label className="block text-sm font-semibold text-gray-700 mb-2">2. Quản lý trực tiếp (MOD)</label><div className="relative"><Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><select value={managerIdToAssign} onChange={(e) => setManagerIdToAssign(e.target.value)} className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none appearance-none bg-white"><option value="">-- Chọn quản lý --</option>{availableManagers.map(manager => (<option key={manager.id} value={manager.id}>{manager.full_name} ({manager.role === UserRole.ADMIN ? 'Admin' : 'MOD'})</option>))}</select></div></div><div className="p-3 bg-orange-50 border border-orange-100 rounded-xl flex items-center gap-3"><input type="checkbox" id="partTimeCheck" checked={assignAsPartTime} onChange={e => setAssignAsPartTime(e.target.checked)} className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500" /><label htmlFor="partTimeCheck" className="text-sm font-bold text-orange-800 cursor-pointer">Nhân viên Part-time?<p className="text-xs font-normal text-orange-700 mt-0.5">Không KPI, tính 30% doanh thu.</p></label></div></div>)}</div><div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end"><button onClick={closeApprovalModal} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Hủy bỏ</button><button onClick={confirmApproval} className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-lg shadow-primary-200 transition-all active:scale-95 flex items-center gap-2"><CheckCircle size={16} /> Xác nhận</button></div></div></div>)}

            {/* --- DELEGATE MODAL --- */}
            {showDelegateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative">
                        {/* CONFIRMATION OVERLAY FOR REVOKE */}
                        {delegationToDelete && (
                            <div className="absolute inset-0 bg-white/95  z-[60] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 animate-bounce">
                                    <Trash2 size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận thu hồi quyền?</h3>
                                <p className="text-gray-500 mb-6 max-w-xs">Người được ủy quyền sẽ không còn truy cập được dữ liệu này nữa.</p>
                                <div className="flex gap-3 w-full max-w-xs">
                                    <button onClick={() => setDelegationToDelete(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                                    <button onClick={confirmRevoke} className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors">Xác nhận Thu hồi</button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Share2 size={20} className="text-indigo-600" /> Phân quyền Data (Tạm thời)</h3>
                            <button onClick={() => setShowDelegateModal(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                        </div>

                        {showDelegateSql ? (
                            <div className="p-4 bg-slate-900 text-green-400 rounded-xl font-mono text-xs overflow-auto mb-4 relative">
                                <pre>{delegateSql}</pre>
                                <button onClick={() => { navigator.clipboard.writeText(delegateSql); alert("Đã sao chép SQL"); }} className="absolute top-2 right-2 p-1 bg-white/20 rounded hover:bg-white/30"><Copy size={12} /></button>
                                <p className="text-gray-400 mt-2">Chạy lệnh trên trong Supabase SQL Editor để tạo bảng access_delegations.</p>
                                <button onClick={() => setShowDelegateSql(false)} className="mt-2 text-white underline">Đã chạy xong, quay lại</button>
                            </div>
                        ) : (
                            <div className="space-y-4 overflow-y-auto flex-1 p-1">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <h4 className="font-bold text-indigo-900 mb-2 text-sm uppercase">Cấp quyền mới</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-indigo-700 block mb-1">Người nhận quyền (User A)</label>
                                            <select className="w-full text-sm border rounded-lg p-2" value={delegateForm.recipientId} onChange={e => setDelegateForm({ ...delegateForm, recipientId: e.target.value })}>
                                                <option value="">-- Chọn --</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-indigo-700 block mb-1">Dữ liệu của ai (User B)</label>
                                            <select className="w-full text-sm border rounded-lg p-2" value={delegateForm.targetUserId} onChange={e => setDelegateForm({ ...delegateForm, targetUserId: e.target.value })}>
                                                <option value="">-- Chọn --</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-indigo-700 block mb-1">Quyền hạn</label>
                                            <div className="flex gap-2">
                                                <select className="w-full text-sm border rounded-lg p-2" value={delegateForm.accessLevel} onChange={e => setDelegateForm({ ...delegateForm, accessLevel: e.target.value as any })}>
                                                    <option value="view">Chỉ xem</option>
                                                    <option value="edit">Được chỉnh sửa</option>
                                                </select>
                                                <button onClick={handleCreateDelegation} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 font-bold text-xs shrink-0">Cấp</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-gray-900 mb-2 text-sm">Danh sách quyền đang cấp</h4>
                                    {delegations.length === 0 ? <p className="text-sm text-gray-500">Chưa có phân quyền nào.</p> : (
                                        <div className="border rounded-xl overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                                    <tr>
                                                        <th className="px-4 py-2">Người xem</th>
                                                        <th className="px-4 py-2">Xem của</th>
                                                        <th className="px-4 py-2">Quyền</th>
                                                        <th className="px-4 py-2 text-right">Hủy</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {delegations.map(d => (
                                                        <tr key={d.id}>
                                                            <td className="px-4 py-2 font-bold">{employees.find(e => e.id === d.recipient_id)?.full_name || 'Unknown'}</td>
                                                            <td className="px-4 py-2">{employees.find(e => e.id === d.target_user_id)?.full_name || 'Unknown'}</td>
                                                            <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs font-bold ${d.access_level === 'edit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{d.access_level === 'edit' ? 'Sửa' : 'Xem'}</span></td>
                                                            <td className="px-4 py-2 text-right"><button onClick={() => handleRevokeDelegation(d.id)} className="text-red-500 hover:underline text-xs font-bold">Thu hồi</button></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!showDelegateSql && (
                            <div className="mt-4 pt-4 border-t flex justify-between items-center">
                                <button onClick={() => setShowDelegateSql(true)} className="text-xs text-gray-400 hover:underline flex items-center gap-1"><Database size={12} /> Setup Database</button>
                                <button onClick={() => setShowDelegateModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200">Đóng</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showRLSModal && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70  animate-fade-in"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"><div className="p-6 bg-red-50 border-b border-red-100 flex gap-4 items-start"><div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0"><AlertTriangle size={24} /></div><div><h3 className="text-xl font-bold text-gray-900">Cập nhật Database</h3><p className="text-sm text-gray-600 mt-1">Database của bạn đang thiếu các cột phân quyền hoặc chính sách bảo mật (RLS). Vui lòng chạy lệnh SQL sau:</p></div><button onClick={() => setShowRLSModal(false)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={24} /></button></div><div className="p-6 overflow-y-auto space-y-4"><div className="relative bg-gray-900 rounded-xl p-4 font-mono text-sm text-green-400 overflow-x-auto border border-gray-700 shadow-inner"><pre>{`-- 1. Bổ sung cột phân quyền hạn chế (Fix lỗi 400 Bad Request)
alter table profiles add column if not exists is_locked_add boolean default false;
alter table profiles add column if not exists is_locked_view boolean default false;

-- 2. Cập nhật Policy để Admin/Mod sửa được Profile
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins can update all profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;

create policy "Admins can update all profiles"
on profiles for update
to authenticated
using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

create policy "Users can update own profile"
on profiles for update
to authenticated
using ( auth.uid() = id );`}</pre><button onClick={() => {
                    const code = `-- 1. Bổ sung cột phân quyền hạn chế (Fix lỗi 400 Bad Request)
alter table profiles add column if not exists is_locked_add boolean default false;
alter table profiles add column if not exists is_locked_view boolean default false;

-- 2. Cập nhật Policy để Admin/Mod sửa được Profile
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins can update all profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;

create policy "Admins can update all profiles"
on profiles for update
to authenticated
using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

create policy "Users can update own profile"
on profiles for update
to authenticated
using ( auth.uid() = id );`; navigator.clipboard.writeText(code); alert("Đã sao chép SQL!");
                }} className="absolute top-3 right-3 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"><Copy size={14} /> Sao chép</button></div></div></div></div>)}

        </div>
    );
};

export default EmployeeList;

