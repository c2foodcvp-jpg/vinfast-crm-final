
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { UserRole, TeamInventory } from '../types';
import { Edit, Save, Loader2, Info, Box } from 'lucide-react';

const Inventory: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const [inventory, setInventory] = useState<TeamInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, [userProfile]);

  const fetchInventory = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
        let targetManagerId = userProfile.id; 
        
        if (userProfile.role === UserRole.EMPLOYEE) {
            targetManagerId = userProfile.manager_id || '';
        }

        // If employee has no manager, try to fetch policy from an Admin
        if (!targetManagerId && userProfile.role === UserRole.EMPLOYEE) {
             const { data: adminData } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();
             if (adminData) targetManagerId = adminData.id;
        }

        setManagerId(targetManagerId);

        if (targetManagerId) {
            const { data } = await supabase.from('team_inventory').select('*').eq('manager_id', targetManagerId).single();
            if (data) {
                setInventory(data as TeamInventory);
                setEditContent(data.content);
            }
        }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSave = async () => {
      if (!managerId) return;
      try {
          // Check if exists
          const { data: existing } = await supabase.from('team_inventory').select('id').eq('manager_id', managerId).single();
          
          if (existing) {
              await supabase.from('team_inventory').update({ content: editContent, updated_at: new Date().toISOString() }).eq('manager_id', managerId);
          } else {
              await supabase.from('team_inventory').insert([{
                  manager_id: managerId,
                  content: editContent,
                  updated_at: new Date().toISOString()
              }]);
          }
          
          setIsEditing(false);
          fetchInventory();
      } catch (e: any) { 
          if (e.code === '42P01') alert("Chưa có bảng dữ liệu. Vui lòng chạy mã SQL.");
          else alert("Lỗi lưu thông tin tồn kho."); 
      }
  };

  const canEdit = isAdmin || isMod;

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải kho xe...</div>;

  return (
    <div className="w-full px-4 space-y-6 pb-20">
      <div className="flex justify-between items-center">
          <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Box className="text-primary-600"/> Kho xe & Tồn kho</h1>
              <p className="text-gray-500">Thông tin xe sẵn có của Team.</p>
          </div>
          {canEdit && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold shadow hover:bg-primary-700">
                  <Edit size={18} /> Cập nhật
              </button>
          )}
      </div>

      {!inventory && !isEditing && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-blue-800 flex items-center gap-3">
              <Info size={24} />
              <p>Chưa có thông tin tồn kho nào được cập nhật cho nhóm của bạn.</p>
          </div>
      )}

      {isEditing ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <label className="block font-bold text-gray-700">Soạn thảo nội dung (Hỗ trợ HTML cơ bản)</label>
              <textarea 
                className="w-full h-96 border border-gray-300 rounded-xl p-4 font-mono text-sm focus:border-primary-500 outline-none"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="Nhập nội dung tồn kho... Ví dụ: <ul><li>VF3 - Trắng: 5 xe</li>...</ul>"
              ></textarea>
              <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="px-6 py-2 bg-gray-100 font-bold text-gray-600 rounded-xl">Hủy</button>
                  <button onClick={handleSave} className="px-6 py-2 bg-green-600 font-bold text-white rounded-xl flex items-center gap-2"><Save size={18}/> Lưu & Đăng</button>
              </div>
          </div>
      ) : (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
              {inventory ? (
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: inventory.content }} />
              ) : (
                  <div className="text-center text-gray-400 py-20">
                      <p>Chưa có thông tin.</p>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Inventory;
