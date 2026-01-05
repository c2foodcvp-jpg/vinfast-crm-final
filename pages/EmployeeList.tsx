import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Search, Shield, User, Edit2, Save, X, AlertTriangle, ShieldCheck, Users, Copy, Terminal, Trash2 } from 'lucide-react';

const EmployeeList: React.FC = () => {
  const { userProfile } = useAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('pending');
  
  // Edit Role State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempRole, setTempRole] = useState<UserRole>(UserRole.EMPLOYEE);
  const [tempManagerId, setTempManagerId] = useState<string>('');

  // Approval Modal State
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedUserToApprove, setSelectedUserToApprove] = useState<UserProfile | null>(null);
  const [roleToAssign, setRoleToAssign] = useState<UserRole>(UserRole.EMPLOYEE);
  const [managerIdToAssign, setManagerIdToAssign] = useState<string>('');

  // RLS Instruction Modal State
  const [showRLSModal, setShowRLSModal] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [userProfile]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setEmployees(data as UserProfile[] || []);
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setLoading(false);
    }
  };

  // Derived list of potential managers (Active MODs or Admins)
  const availableManagers = employees.filter(e => 
    e.status === 'active' && 
    (e.role === UserRole.MOD || e.role === UserRole.ADMIN) &&
    e.id !== selectedUserToApprove?.id // Can't be own manager
  );

  // Helper to get manager name
  const getManagerName = (managerId?: string | null) => {
    if (!managerId) return null;
    const manager = employees.find(e => e.id === managerId);
    return manager ? manager.full_name : 'Không xác định';
  };

  // --- APPROVAL LOGIC ---
  const openApprovalModal = (user: UserProfile) => {
    setSelectedUserToApprove(user);
    setRoleToAssign(UserRole.EMPLOYEE); 
    // If current user is MOD, auto-assign to themselves. If Admin, leave empty to choose.
    setManagerIdToAssign(userProfile?.role === UserRole.MOD ? userProfile.id : ''); 
    setIsApprovalModalOpen(true);
  };

  const closeApprovalModal = () => {
    setIsApprovalModalOpen(false);
    setSelectedUserToApprove(null);
  };

  const confirmApproval = async () => {
    if (!selectedUserToApprove) return;

    // 1. Prepare Payload
    const updates: any = {
      status: 'active',
      role: roleToAssign
    };
    if (roleToAssign === UserRole.EMPLOYEE && managerIdToAssign) {
      updates.manager_id = managerIdToAssign;
    } else {
      updates.manager_id = null; 
    }

    // 2. Optimistic Update (Update UI immediately)
    const originalEmployees = [...employees];
    const updatedEmployees = employees.map(e => 
        e.id === selectedUserToApprove.id 
          ? { ...e, ...updates } 
          : e
    );
    setEmployees(updatedEmployees);
    closeApprovalModal();

    try {
      // 3. Send to DB with .select() to verify persistence
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', selectedUserToApprove.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("RLS_BLOCK");
      
    } catch (err: any) {
      console.error(err);
      setEmployees(originalEmployees);
      const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      if (msg === "RLS_BLOCK" || msg.includes("policy")) {
          setShowRLSModal(true);
      } else {
          alert("Lỗi hệ thống: " + msg);
      }
    }
  };

  const handleReject = async (id: string) => {
      if (!window.confirm("Từ chối và khóa thành viên này?")) return;
      const originalEmployees = [...employees];
      setEmployees(employees.map(e => e.id === id ? { ...e, status: 'blocked' } : e));

      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ status: 'blocked' })
          .eq('id', id)
          .select();
  
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("RLS_BLOCK");

      } catch (err: any) {
        setEmployees(originalEmployees);
        const msg = err?.message || String(err);
        if (msg === "RLS_BLOCK" || msg.includes("policy")) { setShowRLSModal(true); } else { alert("Lỗi: " + msg); }
      }
  };

  const handleDeleteUser = async (id: string) => {
      if (!window.confirm("CẢNH BÁO: Bạn có chắc chắn muốn xóa nhân viên này? Hành động này sẽ xóa vĩnh viễn hồ sơ và không thể hoàn tác.")) return;
      
      const originalEmployees = [...employees];
      setEmployees(employees.filter(e => e.id !== id));

      try {
          const { error } = await supabase.from('profiles').delete().eq('id', id);
          if (error) throw error;
      } catch (err: any) {
          setEmployees(originalEmployees);
          alert("Lỗi xóa nhân viên: " + (err.message || err));
      }
  };

  // --- INLINE EDIT LOGIC ---
  const startEditRole = (employee: UserProfile) => {
    setEditingId(employee.id);
    setTempRole(employee.role);
    setTempManagerId(employee.manager_id || '');
  };

  const saveRole = async (id: string) => {
    const originalEmployees = [...employees];
    const updates: any = { role: tempRole };
    
    if (tempRole === UserRole.EMPLOYEE) {
        updates.manager_id = tempManagerId || null;
    } else {
        updates.manager_id = null;
    }

    setEmployees(employees.map(e => e.id === id ? { ...e, ...updates } : e));
    setEditingId(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("RLS_BLOCK");
      
    } catch (err: any) {
      setEmployees(originalEmployees);
      const msg = err?.message || String(err);
      if (msg === "RLS_BLOCK" || msg.includes("policy")) { setShowRLSModal(true); } else { alert("Lỗi: " + msg); }
    }
  };

  const filteredEmployees = employees.filter(e => {
      if (activeTab === 'pending') return e.status === 'pending';
      return e.status === 'active' || e.status === 'blocked';
  });

  const isAdmin = userProfile?.role === UserRole.ADMIN;

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải danh sách nhân sự...</div>;

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý Nhân sự</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Chờ duyệt
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pending' ? 'bg-primary-100' : 'bg-gray-100'}`}>
            {employees.filter(e => e.status === 'pending').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
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
                                  <div className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden">
                                      {emp.avatar_url ? (
                                        <img src={emp.avatar_url} alt="" className="w-full h-full object-cover"/>
                                      ) : (
                                        emp.full_name?.charAt(0).toUpperCase()
                                      )}
                                  </div>
                                  <div>
                                      <p className="font-semibold text-gray-900">{emp.full_name}</p>
                                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                        emp.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                        emp.status === 'blocked' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                      }`}>
                                          {emp.status}
                                      </span>
                                  </div>
                              </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                              <p className="text-gray-900 font-medium">{emp.phone}</p>
                              <p className="text-gray-500">{emp.email}</p>
                          </td>
                          <td className="px-6 py-4">
                              {/* Edit Mode for Active Users */}
                              {isAdmin && editingId === emp.id ? (
                                <div className="flex flex-col gap-2 bg-white border border-primary-300 rounded-lg p-2 shadow-sm min-w-[200px]">
                                  <div className="flex items-center gap-2">
                                      <select 
                                        value={tempRole}
                                        onChange={(e) => setTempRole(e.target.value as UserRole)}
                                        className="text-sm border rounded px-1 py-1 w-full bg-white outline-none focus:ring-1 focus:ring-primary-500"
                                      >
                                        <option value={UserRole.EMPLOYEE}>Nhân viên</option>
                                        <option value={UserRole.MOD}>Quản lý (MOD)</option>
                                        <option value={UserRole.ADMIN}>Admin</option>
                                      </select>
                                  </div>
                                  
                                  {tempRole === UserRole.EMPLOYEE && (
                                      <select 
                                        value={tempManagerId}
                                        onChange={(e) => setTempManagerId(e.target.value)}
                                        className="text-xs border rounded px-1 py-1 w-full bg-white outline-none text-gray-700"
                                      >
                                          <option value="">-- Chọn quản lý --</option>
                                          {employees.filter(m => (m.role === 'admin' || m.role === 'mod') && m.id !== emp.id).map(m => (
                                              <option key={m.id} value={m.id}>{m.full_name}</option>
                                          ))}
                                      </select>
                                  )}

                                  <div className="flex justify-end gap-2 mt-1">
                                      <button onClick={() => saveRole(emp.id)} className="text-green-600 hover:bg-green-50 p-1 rounded-md transition-colors bg-green-50">
                                        <Save size={16} />
                                      </button>
                                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded-md transition-colors bg-gray-50">
                                        <X size={16} />
                                      </button>
                                  </div>
                                </div>
                              ) : (
                                // View Mode
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-md border ${
                                      emp.role === UserRole.ADMIN ? 'bg-red-50 text-red-700 border-red-100' :
                                      emp.role === UserRole.MOD ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                      'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}>
                                        {emp.role === UserRole.ADMIN && <Shield size={12} />}
                                        {emp.role === UserRole.MOD ? 'Quản lý' : emp.role === UserRole.ADMIN ? 'Admin' : 'Sales'}
                                    </span>
                                    {isAdmin && emp.status === 'active' && (
                                      <button onClick={() => startEditRole(emp)} className="text-gray-400 hover:text-primary-600 p-1 rounded hover:bg-gray-100 transition-colors">
                                        <Edit2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                  {/* Show Manager Name if exists */}
                                  {emp.manager_id && emp.role === UserRole.EMPLOYEE && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                       <Users size={12} className="text-gray-400" />
                                       Quản lý bởi: <span className="font-semibold text-gray-700">{getManagerName(emp.manager_id)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {emp.status === 'pending' && (isAdmin || userProfile?.role === UserRole.MOD) ? (
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => openApprovalModal(emp)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-md shadow-green-200 transition-all active:scale-95"
                                    >
                                        <CheckCircle size={14} /> Duyệt
                                    </button>
                                    <button 
                                        onClick={() => handleReject(emp.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-all active:scale-95"
                                    >
                                        <XCircle size={14} /> Từ chối
                                    </button>
                                </div>
                            ) : isAdmin && (
                                <button 
                                    onClick={() => handleDeleteUser(emp.id)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Xóa nhân viên"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                          </td>
                      </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- APPROVAL MODAL --- */}
      {isApprovalModalOpen && selectedUserToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Shield className="text-primary-600" size={20} />
                Phê duyệt thành viên
              </h3>
              <button onClick={closeApprovalModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="h-12 w-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg">
                   {selectedUserToApprove.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                   <p className="font-bold text-gray-900">{selectedUserToApprove.full_name}</p>
                   <p className="text-sm text-gray-600">{selectedUserToApprove.email}</p>
                   <p className="text-xs text-gray-500 mt-0.5">{selectedUserToApprove.phone}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Cấp vai trò</label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => setRoleToAssign(UserRole.EMPLOYEE)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      roleToAssign === UserRole.EMPLOYEE ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="p-2 bg-white rounded-lg shadow-sm text-gray-600"><User size={18} /></div>
                    <div>
                      <p className={`font-semibold text-sm ${roleToAssign === UserRole.EMPLOYEE ? 'text-primary-900' : 'text-gray-900'}`}>Nhân viên Sales</p>
                      <p className="text-xs text-gray-500">Quyền cơ bản.</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setRoleToAssign(UserRole.MOD)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      roleToAssign === UserRole.MOD ? 'border-purple-500 bg-purple-50 ring-1 ring-purple-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="p-2 bg-white rounded-lg shadow-sm text-purple-600"><Shield size={18} /></div>
                    <div>
                      <p className={`font-semibold text-sm ${roleToAssign === UserRole.MOD ? 'text-purple-900' : 'text-gray-900'}`}>Quản lý (MOD)</p>
                      <p className="text-xs text-gray-500">Quản lý Sales team.</p>
                    </div>
                  </button>

                  {isAdmin && (
                    <button 
                        onClick={() => setRoleToAssign(UserRole.ADMIN)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        roleToAssign === UserRole.ADMIN ? 'border-red-500 bg-red-50 ring-1 ring-red-500' : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                        <div className="p-2 bg-white rounded-lg shadow-sm text-red-600"><ShieldCheck size={18} className="text-red-600" /></div>
                        <div>
                        <p className={`font-semibold text-sm ${roleToAssign === UserRole.ADMIN ? 'text-red-900' : 'text-gray-900'}`}>Administrator</p>
                        <p className="text-xs text-gray-500">Toàn quyền.</p>
                        </div>
                    </button>
                  )}
                </div>
              </div>

              {/* MANAGER SELECTION - Only if Role is Employee */}
              {roleToAssign === UserRole.EMPLOYEE && (
                 <div className="animate-fade-in">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">2. Quản lý trực tiếp (MOD)</label>
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select
                            value={managerIdToAssign}
                            onChange={(e) => setManagerIdToAssign(e.target.value)}
                            className="w-full rounded-xl border border-gray-300 pl-10 pr-4 py-2.5 text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none appearance-none bg-white"
                        >
                            <option value="">-- Chọn quản lý --</option>
                            {availableManagers.map(manager => (
                                <option key={manager.id} value={manager.id}>
                                    {manager.full_name} ({manager.role === UserRole.ADMIN ? 'Admin' : 'MOD'})
                                </option>
                            ))}
                        </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5 ml-1">Nhân viên này sẽ thuộc team của quản lý được chọn.</p>
                 </div>
              )}

            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
               <button 
                 onClick={closeApprovalModal}
                 className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
               >
                 Hủy bỏ
               </button>
               <button 
                 onClick={confirmApproval}
                 className="px-6 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-lg shadow-primary-200 transition-all active:scale-95 flex items-center gap-2"
               >
                 <CheckCircle size={16} />
                 Xác nhận
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ... RLS Modal (unchanged) ... */}
      {showRLSModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* ... same content ... */}
              <div className="p-6 bg-red-50 border-b border-red-100 flex gap-4 items-start"><div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0"><AlertTriangle size={24} /></div><div><h3 className="text-xl font-bold text-gray-900">Thiếu quyền Database (RLS Policy)</h3><p className="text-sm text-gray-600 mt-1">Admin chưa được cấp phép để sửa dữ liệu người khác. Đây là cơ chế bảo mật mặc định của Supabase.</p></div><button onClick={() => setShowRLSModal(false)} className="ml-auto text-gray-400 hover:text-gray-600"><X size={24} /></button></div><div className="p-6 overflow-y-auto space-y-4"><p className="text-sm font-semibold text-gray-800">Hãy chạy đoạn SQL này trong <span className="text-primary-600">Supabase SQL Editor</span> để khắc phục:</p><div className="relative bg-gray-900 rounded-xl p-4 font-mono text-sm text-green-400 overflow-x-auto border border-gray-700 shadow-inner"><pre>{`-- 1. Xóa chính sách cũ để tránh lỗi trùng lặp
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins can update all profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;

-- 2. Tạo lại chính sách cho Admin
create policy "Admins can update all profiles"
on profiles for update
to authenticated
using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- 3. Tạo lại chính sách cho User tự sửa mình
create policy "Users can update own profile"
on profiles for update
to authenticated
using ( auth.uid() = id );`}</pre><button onClick={() => { const code = `-- 1. Xóa chính sách cũ để tránh lỗi trùng lặp
drop policy if exists "Users can update own profile" on profiles;
drop policy if exists "Admins can update all profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;

-- 2. Tạo lại chính sách cho Admin
create policy "Admins can update all profiles"
on profiles for update
to authenticated
using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- 3. Tạo lại chính sách cho User tự sửa mình
create policy "Users can update own profile"
on profiles for update
to authenticated
using ( auth.uid() = id );`; navigator.clipboard.writeText(code); alert("Đã sao chép SQL!"); }} className="absolute top-3 right-3 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"><Copy size={14} /> Sao chép</button></div></div>
           </div>
        </div>
      )}

    </div>
  );
};

export default EmployeeList;