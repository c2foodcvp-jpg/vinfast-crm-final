
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { Edit, Save, Loader2, Info, Landmark, Database, Copy, Terminal, AlertCircle } from 'lucide-react';

const BankRates: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);

  // SQL Help State
  const [showSql, setShowSql] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchContent();
  }, [userProfile]);

  const fetchContent = async () => {
    if (!userProfile) return;
    setLoading(true);
    setErrorMsg(null);
    try {
        let targetManagerId = userProfile.id; 
        
        if (userProfile.role === UserRole.EMPLOYEE) {
            targetManagerId = userProfile.manager_id || '';
        }

        // If employee has no manager, try to fetch from an Admin
        if (!targetManagerId && userProfile.role === UserRole.EMPLOYEE) {
             const { data: adminData } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle();
             if (adminData) targetManagerId = adminData.id;
        }

        setManagerId(targetManagerId);

        if (targetManagerId) {
            // New logic: Fetch from team_content table with type 'bank_rates'
            const { data, error } = await supabase.from('team_content')
                .select('content')
                .eq('manager_id', targetManagerId)
                .eq('type', 'bank_rates')
                .maybeSingle();
            
            if (error) {
                if (error.code === '42P01') {
                    setErrorMsg("TABLE_MISSING");
                } else {
                    throw error;
                }
            }

            if (data) {
                setContent(data.content);
                setEditContent(data.content);
            }
        }
    } catch (err: any) { 
        console.error(err); 
        setErrorMsg(err.message || "Lỗi tải dữ liệu");
    } finally { 
        setLoading(false); 
    }
  };

  const handleSave = async () => {
      if (!managerId) return;
      try {
          // Upsert logic into team_content
          const payload = {
              manager_id: managerId,
              type: 'bank_rates',
              content: editContent,
              updated_at: new Date().toISOString()
          };
          
          // Check if exists to decide upsert strategy
          const { error } = await supabase.from('team_content').upsert(payload, { onConflict: 'manager_id, type' });
          
          if (error) throw error;

          setContent(editContent);
          setIsEditing(false);
          alert("Đã cập nhật lãi suất!");
      } catch (e: any) { 
          if (e.code === '42P01') {
              alert("Lỗi: Bảng dữ liệu chưa được tạo. Vui lòng chạy mã SQL.");
              setShowSql(true);
          } else {
              alert("Lỗi lưu dữ liệu: " + e.message); 
          }
      }
  };

  const setupSQL = `
-- 1. Tạo bảng team_content (nếu chưa có) để chứa nội dung chung
create table if not exists public.team_content (
  id uuid default gen_random_uuid() primary key,
  manager_id uuid references public.profiles(id),
  type text not null, -- 'car_prices', 'bank_rates'
  content text,
  updated_at timestamptz default now(),
  unique(manager_id, type)
);

-- 2. Bật RLS
alter table public.team_content enable row level security;

-- 3. Xóa policy cũ
drop policy if exists "Read Team Content" on public.team_content;
drop policy if exists "Write Team Content" on public.team_content;

-- 4. Tạo Policy mới
-- Cho phép mọi người ĐỌC
create policy "Read Team Content" on public.team_content for select using (true);

-- Cho phép Manager/Admin GHI
create policy "Write Team Content" on public.team_content for all using (
  auth.uid() = manager_id or 
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
`;

  const canEdit = isAdmin || isMod;

  if (loading) return <div className="p-8 text-center text-gray-500 flex flex-col items-center"><Loader2 className="animate-spin mb-2 text-primary-600"/> Đang tải dữ liệu...</div>;

  return (
    <div className="w-full px-4 space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Landmark className="text-green-600" /> Lãi Suất Ngân Hàng (Team)</h1>
              <p className="text-gray-500">Thông tin lãi suất vay mua xe, chính sách ngân hàng liên kết.</p>
          </div>
          <div className="flex gap-2">
              {isAdmin && (
                  <button onClick={() => setShowSql(!showSql)} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200">
                      <Database size={16}/> {showSql ? 'Ẩn SQL' : 'Hiện mã SQL'}
                  </button>
              )}
              {canEdit && !isEditing && (
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold shadow hover:bg-primary-700 transition-all">
                      <Edit size={18} /> Cập nhật
                  </button>
              )}
          </div>
      </div>

      {/* SQL Setup Block */}
      {(showSql || errorMsg === "TABLE_MISSING") && isAdmin && (
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 shadow-xl overflow-hidden animate-fade-in">
              <div className="flex justify-between items-center mb-2">
                  <span className="text-green-400 font-mono text-xs font-bold flex items-center gap-2"><Terminal size={14}/> Setup Database (Chạy trong Supabase SQL Editor)</span>
                  <button onClick={() => { navigator.clipboard.writeText(setupSQL); alert("Đã copy SQL!"); }} className="text-xs bg-white/10 text-white px-2 py-1 rounded hover:bg-white/20 flex items-center gap-1">
                      <Copy size={12}/> Copy
                  </button>
              </div>
              <pre className="text-xs text-slate-300 font-mono overflow-x-auto p-2 bg-black/30 rounded border border-white/10">
                  {setupSQL}
              </pre>
              <div className="mt-2 text-right">
                  <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">Mở Supabase Dashboard &rarr;</a>
              </div>
          </div>
      )}

      {errorMsg && errorMsg !== "TABLE_MISSING" && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-2">
              <AlertCircle size={20}/>
              <span>{errorMsg}</span>
          </div>
      )}

      {!content && !isEditing && (
          <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-green-800 flex items-center gap-3">
              <Info size={24} />
              <p>Chưa có thông tin lãi suất nào được cập nhật cho Team của bạn.</p>
          </div>
      )}

      {isEditing ? (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 animate-fade-in">
              <label className="block font-bold text-gray-700">Soạn thảo nội dung (HTML)</label>
              <textarea 
                className="w-full h-96 border border-gray-300 rounded-xl p-4 font-mono text-sm focus:border-primary-500 outline-none focus:ring-2 focus:ring-primary-100"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="Nhập mã HTML lãi suất... Ví dụ: <ul><li>VIB: 7.5%</li>...</ul>"
              ></textarea>
              <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="px-6 py-2 bg-gray-100 font-bold text-gray-600 rounded-xl hover:bg-gray-200 transition-colors">Hủy</button>
                  <button onClick={handleSave} className="px-6 py-2 bg-green-600 font-bold text-white rounded-xl flex items-center gap-2 hover:bg-green-700 transition-colors"><Save size={18}/> Lưu & Đăng</button>
              </div>
          </div>
      ) : (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
              {content ? (
                  <div className="prose max-w-none prose-img:rounded-xl prose-a:text-green-600 prose-headings:text-gray-900" dangerouslySetInnerHTML={{ __html: content }} />
              ) : (
                  <div className="text-center text-gray-400 py-20">
                      <p>Nội dung trống.</p>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default BankRates;

