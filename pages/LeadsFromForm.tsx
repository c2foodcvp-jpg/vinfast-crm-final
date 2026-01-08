
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Customer, UserProfile, CAR_MODELS as DEFAULT_CAR_MODELS, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, UserPlus, Search, X, CheckCircle2, Loader2, Phone, CarFront, MessageSquare, Users, ChevronDown, Clock
} from 'lucide-react';

const LeadsFromForm: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dynamic Car List (Used for matching logic if needed later, currently leads come with interest text)
  const [carList, setCarList] = useState<string[]>(DEFAULT_CAR_MODELS);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Customer | null>(null);
  const [selectedRepId, setSelectedRepId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    // Allow Admins, Mods, and Employees to access this page to claim leads
    fetchData();
    fetchCarModels();
  }, [userProfile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: customers, error } = await supabase.from('customers').select('*').or('sales_rep.is.null,sales_rep.eq.""').order('created_at', { ascending: false });
      if (error) throw error;
      setLeads(customers as Customer[]);

      // FETCH EMPLOYEES: Get all active, then filter in JS to ensure strict logic
      const { data: allProfiles } = await supabase.from('profiles').select('id, full_name, role, manager_id, status').eq('status', 'active');
      
      let filtered: any[] = [];
      
      if (allProfiles) {
          if (isAdmin) {
              // Admin sees all
              filtered = allProfiles;
          } else if (isMod && userProfile) {
              // MOD: See Self + Subordinates (manager_id = me)
              filtered = allProfiles.filter(p => p.id === userProfile.id || p.manager_id === userProfile.id);
          } else if (userProfile) {
              // SALES (Employee): See Self + Peers (Same Manager, Same Role)
              // Strict Logic: Must have same manager_id AND be an employee role.
              if (userProfile.manager_id) {
                  filtered = allProfiles.filter(p => 
                      p.id === userProfile.id || 
                      (p.manager_id === userProfile.manager_id && p.role === UserRole.EMPLOYEE)
                  );
              } else {
                  // Fallback: If no manager assigned, only see self
                  filtered = allProfiles.filter(p => p.id === userProfile.id);
              }
          }
      }
      
      setEmployees(filtered as UserProfile[]);
    } catch (err) { console.error("Error fetching data:", err); } finally { setLoading(false); }
  };

  const fetchCarModels = async () => {
      try {
          const { data } = await supabase.from('car_models').select('name').order('created_at', { ascending: false });
          if (data && data.length > 0) {
              setCarList(data.map(c => c.name));
          }
      } catch (e) { console.error("Error fetching car models", e); }
  };

  const handleOpenAssign = (lead: Customer) => {
      setSelectedLead(lead);
      setSelectedRepId('');
      setIsModalOpen(true);
  };

  const confirmAssign = async () => {
      if (!selectedLead || !selectedRepId) return;
      setIsAssigning(true);

      try {
          const rep = employees.find(e => e.id === selectedRepId);
          if (!rep) throw new Error("Nhân viên không tồn tại");

          const { error } = await supabase.from('customers').update({ sales_rep: rep.full_name, creator_id: rep.id }).eq('id', selectedLead.id);
          if (error) throw error;

          await supabase.from('interactions').insert([{
              customer_id: selectedLead.id, user_id: userProfile?.id, type: 'note',
              content: `[Phân bổ từ Form] ${userProfile?.full_name} đã chuyển khách này cho ${rep.full_name}.`,
              created_at: new Date().toISOString()
          }]);

          setLeads(prev => prev.filter(l => l.id !== selectedLead.id));
          setIsModalOpen(false);
          setSelectedLead(null);

      } catch (err: any) {
          const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
          alert("Lỗi phân bổ: " + errorMessage);
      } finally { setIsAssigning(false); }
  };

  const filteredLeads = leads.filter(l => (l.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (l.phone || '').includes(searchTerm));

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Zap className="text-yellow-500 fill-yellow-500" /> Khách mới từ Email / Form</h1><p className="text-gray-500 mt-1">Danh sách khách hàng tự động đổ về từ Email, chưa có người phụ trách.</p></div>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Tìm kiếm tên, sđt..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-gray-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all" /></div></div>
      {loading ? (<div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-primary-600" /></div>) : filteredLeads.length === 0 ? (<div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed"><CheckCircle2 size={48} className="mx-auto text-green-200 mb-3" /><p className="text-gray-500">Tuyệt vời! Đã phân bổ hết khách hàng mới.</p></div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{filteredLeads.map(lead => (<div key={lead.id} className="bg-white rounded-2xl p-5 shadow-sm border border-red-100 relative overflow-hidden group hover:shadow-md transition-all"><div className="absolute top-0 right-0 p-2"><span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full animate-pulse">Mới</span></div><div className="flex items-center gap-3 mb-4"><div className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-lg">{lead.name?.charAt(0).toUpperCase()}</div><div><h3 className="font-bold text-gray-900">{lead.name}</h3><div className="flex items-center gap-1 text-xs text-gray-500"><Clock size={12}/> {new Date(lead.created_at).toLocaleString('vi-VN')}</div></div></div><div className="space-y-2 text-sm text-gray-700 mb-4"><div className="flex items-center gap-2"><Phone size={14} className="text-gray-400" /> <span className="font-mono font-bold">{lead.phone}</span></div><div className="flex items-center gap-2"><CarFront size={14} className="text-gray-400" /><span className="text-primary-700 font-bold">{lead.interest || 'Chưa rõ'}</span></div><div className="flex items-start gap-2"><MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" /><p className="text-xs bg-gray-50 p-2 rounded-lg w-full text-gray-600 italic">"{lead.notes || 'Không có ghi chú'}"</p></div><div className="flex items-center gap-2 pt-2 border-t border-gray-50"><span className="text-xs text-gray-400">Nguồn:</span><span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{lead.source}</span></div></div><button onClick={() => handleOpenAssign(lead)} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-200 flex items-center justify-center gap-2 transition-all active:scale-95"><UserPlus size={16} /> Phân bổ ngay</button></div>))}</div>)}
      {isModalOpen && selectedLead && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-md p-6"><div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Phân bổ khách hàng</h3><button onClick={() => setIsModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button></div><div className="bg-gray-50 p-3 rounded-xl mb-4 text-sm text-gray-700 border border-gray-100"><p><strong>Khách:</strong> {selectedLead.name}</p><p><strong>Quan tâm:</strong> {selectedLead.interest}</p></div><div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-2">Chọn nhân viên phụ trách</label><div className="relative"><Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><select value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="w-full border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500 appearance-none bg-white font-medium"><option value="">-- Chọn TVBH --</option>{employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /></div></div><div className="flex justify-end gap-2 pt-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 font-bold bg-gray-100 hover:bg-gray-200 rounded-xl">Hủy</button><button onClick={confirmAssign} disabled={isAssigning || !selectedRepId} className="px-6 py-2 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 flex items-center gap-2 shadow-lg disabled:opacity-70 disabled:shadow-none">{isAssigning && <Loader2 className="animate-spin" size={16} />} Xác nhận</button></div></div></div>)}
    </div>
  );
};

export default LeadsFromForm;
