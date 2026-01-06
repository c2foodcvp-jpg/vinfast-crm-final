
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Edit, Save, Loader2, Info, Landmark } from 'lucide-react';

const BankRates: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'bank_rates_html').maybeSingle();
        if (data) {
            setContent(data.value);
            setEditContent(data.value);
        }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleSave = async () => {
      try {
          await supabase.from('app_settings').upsert({ key: 'bank_rates_html', value: editContent });
          setContent(editContent);
          setIsEditing(false);
          alert("Đã cập nhật lãi suất!");
      } catch (e) { alert("Lỗi lưu dữ liệu."); }
  };

  const canEdit = isAdmin || isMod;

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu...</div>;

  return (
    <div className="w-full px-4 space-y-6 pb-20">
      <div className="flex justify-between items-center">
          <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Landmark className="text-green-600" /> Lãi Suất Ngân Hàng</h1>
              <p className="text-gray-500">Thông tin lãi suất vay mua xe, chính sách ngân hàng liên kết.</p>
          </div>
          {canEdit && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold shadow hover:bg-primary-700 transition-all">
                  <Edit size={18} /> Cập nhật
              </button>
          )}
      </div>

      {!content && !isEditing && (
          <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-green-800 flex items-center gap-3">
              <Info size={24} />
              <p>Chưa có thông tin lãi suất nào được cập nhật.</p>
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
