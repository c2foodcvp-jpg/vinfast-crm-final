
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, CAR_MODELS as DEFAULT_CAR_MODELS, CustomerStatus, CustomerClassification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserPlus, User, MapPin, Phone, MessageSquare, ChevronDown, Save, Loader2, CheckCircle2, Calendar, Upload, ScanText, Search, XCircle, AlertTriangle } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID: string = 'service_tprir4g';   
const EMAILJS_TEMPLATE_ID: string = 'template_tjsj62d'; 
const EMAILJS_PUBLIC_KEY: string = 'HsbStS_wMT4tjJbMe';   

const AssignCustomers: React.FC = () => {
  const { userProfile, isAdmin, isMod } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Dynamic Car List
  const [carList, setCarList] = useState<string[]>(DEFAULT_CAR_MODELS);

  // OCR State
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phone Check State
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [phoneCheckResult, setPhoneCheckResult] = useState<{exists: boolean, name?: string, rep?: string, phone?: string} | null>(null);

  // DUPLICATE MODAL STATE
  const [isDuplicateWarningOpen, setIsDuplicateWarningOpen] = useState(false);
  const [duplicateData, setDuplicateData] = useState<{id: string, name: string, sales_rep: string, phone: string} | null>(null);

  // DATE LOGIC: GMT+7
  const todayStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  const initialFormState = {
    name: '', phone: '', location: '', source: 'MKT Group', interest: '', 
    notes: '', recare_date: todayStr, classification: 'Warm' as CustomerClassification,
    assignedRepId: '', isZaloOnly: false
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    // Allow Admin & Mod access.
    if (!isAdmin && !isMod) { navigate('/'); return; }
    fetchEmployees();
    fetchCarModels();
  }, [userProfile]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // Fetch all active employees first
      const { data: allProfiles } = await supabase.from('profiles').select('*').eq('status', 'active').order('full_name');
      
      let filtered: UserProfile[] = [];
      
      if (allProfiles) {
          const profiles = allProfiles as UserProfile[];
          if (isAdmin) {
              // Admin sees everyone
              filtered = profiles;
          } else if (isMod && userProfile) {
              // MOD sees ONLY self and Subordinates
              filtered = profiles.filter(p => p.id === userProfile.id || p.manager_id === userProfile.id);
          } else {
              // Fallback (e.g. Sales) - sees only self
              filtered = profiles.filter(p => p.id === userProfile?.id);
          }
      }
      setEmployees(filtered);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchCarModels = async () => {
      try {
          const { data } = await supabase.from('car_models').select('name').order('created_at', { ascending: false });
          if (data && data.length > 0) {
              setCarList(data.map(c => c.name));
          }
      } catch (e) { console.error("Error fetching car models", e); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'phone') setPhoneCheckResult(null);
  };

  const toggleZaloOnly = () => {
     setFormData(prev => ({ ...prev, isZaloOnly: !prev.isZaloOnly }));
     setPhoneCheckResult(null);
  }

  const normalizePhone = (p: string) => {
    return p.replace(/\D/g, '');
  };

  const handleCheckPhone = async () => {
      const phoneInput = formData.phone.trim();
      if (!phoneInput || formData.isZaloOnly) return;
      
      let finalPhone = normalizePhone(phoneInput);
      if (finalPhone.length === 9) finalPhone = '0' + finalPhone;
      
      setIsCheckingPhone(true);
      setPhoneCheckResult(null);

      try {
          const { data } = await supabase.from('customers').select('name, sales_rep').eq('phone', finalPhone).maybeSingle();
          if (data) {
              setPhoneCheckResult({ exists: true, name: data.name, rep: data.sales_rep || 'Chưa phân bổ', phone: finalPhone });
          } else {
              setPhoneCheckResult({ exists: false, phone: finalPhone });
          }
      } catch (error) { console.error(error); } finally { setIsCheckingPhone(false); }
  };

  // --- OCR LOGIC ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsProcessingImage(true);
      setOcrProgress(0);
      try {
          const worker = await createWorker('vie'); 
          const ret = await worker.recognize(file);
          const text = ret.data.text;
          await worker.terminate();
          parseOcrText(text);
          setOcrProgress(100);
      } catch (err) { alert("Không thể đọc ảnh."); } finally { setIsProcessingImage(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const parseOcrText = (text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      let extractedData = { ...formData };
      let notesParts: string[] = [];
      const nameRegex = /(?:Tên Bạn|Họ tên|Họ và tên|Name)\s*:?\s*(.*)/i;
      const phoneRegex = /(?:Số Điện Thoại|Điện thoại|Phone|SĐT)\s*:?\s*([\d\.\s]+)/i;
      const interestRegex = /(?:Dòng Xe Quan Tâm|Phiên Bản|Sản phẩm quan tâm|Xe)\s*:?\s*(.*)/i;
      const formSourceRegex = /(?:Form Gửi từ)\s*[:：]?\s*(.*)/i;

      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const nextLine = lines[i+1] || '';
          if (line.match(/Tên Bạn|Họ tên|Họ và tên|Name/i)) {
              const match = line.match(nameRegex);
              if (match && match[1].length > 1) extractedData.name = match[1].trim();
              else if (nextLine) extractedData.name = nextLine.trim();
          }
          if (line.match(/Số Điện Thoại|SĐT|Phone/i)) {
              const match = line.match(phoneRegex);
              if (match && match[1].length > 5) extractedData.phone = match[1].replace(/\D/g, '');
              else if (nextLine && nextLine.replace(/\D/g, '').length > 5) extractedData.phone = nextLine.replace(/\D/g, '');
          }
          if (line.match(/Dòng Xe|Phiên Bản/i)) {
              const match = line.match(interestRegex);
              let rawInterest = '';
              if (match && match[1].length > 1) rawInterest = match[1].trim();
              else if (nextLine) rawInterest = nextLine.trim();
              if (rawInterest) {
                  const matchModel = carList.find(m => rawInterest.toLowerCase().includes(m.toLowerCase()));
                  if (matchModel) extractedData.interest = matchModel;
                  else extractedData.interest = rawInterest;
              }
          }
          if (line.match(/Form Gửi từ/i)) {
              let sourceUrl = '';
              const match = line.match(formSourceRegex);
              if (match && match[1].length > 1) sourceUrl = match[1].trim();
              else if (nextLine) sourceUrl = nextLine.trim();
              if (sourceUrl) notesParts.push(`(Nguồn: ${sourceUrl})`);
          }
      }
      const needsIndex = lines.findIndex(l => l.match(/Nhu cầu/i));
      const formSourceIndex = lines.findIndex(l => l.match(/Form Gửi từ/i));
      if (needsIndex !== -1) {
          let endIndex = formSourceIndex !== -1 ? formSourceIndex : lines.length;
          const needsLines = lines.slice(needsIndex + 1, endIndex);
          const needsText = needsLines.join(', ').replace(/[•-]/g, '').trim();
          if (needsText) notesParts.unshift(needsText);
      }
      if (notesParts.length > 0) extractedData.notes = notesParts.join(' ');
      if (extractedData.notes.includes('http') || extractedData.notes.includes('.com')) extractedData.source = 'MKT Group';
      setFormData(extractedData);
  };

  const sendEmailNotification = async (repEmail: string, repName: string, customerData: any) => {
      if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') return;
      try {
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
              to_email: repEmail, to_name: repName, customer_name: customerData.name, customer_phone: customerData.phone,
              customer_interest: customerData.interest || 'Chưa rõ', notes: customerData.notes || 'Không có', link: window.location.origin
          }, EMAILJS_PUBLIC_KEY);
      } catch (error) { console.error("EmailJS Error:", error); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    if (!formData.assignedRepId) { alert("Vui lòng chọn nhân viên phụ trách (TVBH)."); return; }

    let finalPhone = formData.phone.trim();
    if (!formData.isZaloOnly) {
        const cleanInput = normalizePhone(finalPhone);
        if (cleanInput.length === 9) { finalPhone = '0' + cleanInput; }
        else if (cleanInput.length !== 10) { alert("Số điện thoại không hợp lệ (phải có 10 số)."); return; }
        else { finalPhone = cleanInput; }
    } else {
        finalPhone = 'Zalo-' + Date.now().toString().slice(-6);
    }

    setIsSubmitting(true);

    try {
        if (!formData.isZaloOnly) {
            const { data: existingCust } = await supabase.from('customers').select('id, name, sales_rep').eq('phone', finalPhone).maybeSingle();
            if (existingCust) {
                setDuplicateData({ id: existingCust.id, name: existingCust.name, sales_rep: existingCust.sales_rep || "Chưa phân bổ", phone: finalPhone });
                setIsDuplicateWarningOpen(true);
                setIsSubmitting(false);
                return;
            }
        }
        await executeAssign(finalPhone);
    } catch (err: any) {
        const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        alert("Lỗi khi phân bổ: " + errorMessage);
        setIsSubmitting(false);
    }
  };

  const executeAssign = async (finalPhone: string) => {
      try {
        const assignedRep = employees.find(e => e.id === formData.assignedRepId);
        if (!assignedRep) throw new Error("Nhân viên không tồn tại");

        const payload: any = {
            name: formData.name, phone: finalPhone, location: formData.location, source: formData.source, 
            interest: formData.interest || null, status: CustomerStatus.NEW, creator_id: assignedRep.id, 
            sales_rep: assignedRep.full_name, created_at: new Date().toISOString(), 
            classification: formData.classification, recare_date: formData.recare_date,
        };

        const { data, error } = await supabase.from('customers').insert([payload]).select();
        if (error) throw error;

        if (data && data[0]) {
            await supabase.from('interactions').insert([{
                customer_id: data[0].id, user_id: userProfile?.id, type: 'note',
                content: `[Phân bổ] Khách hàng được phân bổ từ ${userProfile?.role === 'admin' ? 'Admin' : 'MOD'} ${userProfile?.full_name}. Ghi chú: ${formData.notes}`,
                created_at: new Date().toISOString()
            }]);
            if (assignedRep.email) await sendEmailNotification(assignedRep.email, assignedRep.full_name, formData);

            setSuccessMsg(`Đã phân bổ cho ${assignedRep.full_name}. Email thông báo đang được gửi!`);
            setFormData(initialFormState);
            setIsDuplicateWarningOpen(false);
            setDuplicateData(null);
            setPhoneCheckResult(null);
            setTimeout(() => setSuccessMsg(''), 5000);
        }
      } catch (err: any) { alert("Lỗi phân bổ: " + err.message); } finally { setIsSubmitting(false); }
  };

  const handleRequestTransfer = async () => {
      if (!duplicateData || !userProfile) return;
      setIsSubmitting(true);
      try {
          await supabase.from('customers').update({ pending_transfer_to: userProfile.id }).eq('id', duplicateData.id);
          await supabase.from('interactions').insert([{
              customer_id: duplicateData.id, user_id: userProfile.id, type: 'note',
              content: `⚠️ Yêu cầu chuyển quyền chăm sóc từ ${userProfile.full_name} (Admin/Mod).`,
              created_at: new Date().toISOString()
          }]);
          alert("Đã gửi yêu cầu chuyển quyền chăm sóc!");
          setIsDuplicateWarningOpen(false);
          setDuplicateData(null);
          setFormData(initialFormState);
          setPhoneCheckResult(null);
      } catch (e) { alert("Lỗi khi gửi yêu cầu."); } finally { setIsSubmitting(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Đang tải dữ liệu nhân sự...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><UserPlus className="text-primary-600" /> Phân bổ nguồn khách</h1><p className="text-gray-500">Nhập thông tin khách mới và chỉ định TVBH chăm sóc ngay lập tức.</p></div>
      {successMsg && (<div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in shadow-sm"><CheckCircle2 size={24} /><span className="font-bold">{successMsg}</span></div>)}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"><div className="flex flex-col md:flex-row items-center gap-6"><div className="flex-1"><h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><ScanText size={24} className="text-blue-600"/> Bóc tách dữ liệu từ ảnh (OCR)</h3><p className="text-sm text-gray-500 mt-1">Tải lên ảnh chụp màn hình email hoặc form đăng ký.</p></div><div><input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} /><button onClick={() => fileInputRef.current?.click()} disabled={isProcessingImage} className="px-6 py-3 bg-blue-50 text-blue-700 border border-blue-100 font-bold rounded-xl shadow-sm hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-70">{isProcessingImage ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}{isProcessingImage ? 'Đang đọc ảnh...' : 'Chọn ảnh Lead'}</button></div></div></div>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-white"><h3 className="font-bold text-gray-900 text-lg">Thông tin khách hàng</h3></div>
          <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">Họ và tên <span className="text-red-500">*</span></label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input required name="name" value={formData.name} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 font-medium" placeholder="Nguyễn Văn A" /></div></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Số điện thoại <span className="text-red-500">*</span></label><div className="flex gap-2"><div className="relative flex-1"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input required name="phone" value={formData.phone} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 font-medium disabled:bg-gray-50" placeholder="09..." disabled={formData.isZaloOnly} /></div>{!formData.isZaloOnly && (<button type="button" onClick={handleCheckPhone} disabled={isCheckingPhone || !formData.phone} className="px-4 py-2 bg-gray-100 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap">{isCheckingPhone ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} Kiểm tra</button>)}</div>{phoneCheckResult && (<div className={`mt-3 p-3 rounded-lg border flex items-start gap-3 animate-fade-in ${phoneCheckResult.exists ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>{phoneCheckResult.exists ? <XCircle size={20} className="shrink-0 mt-0.5"/> : <CheckCircle2 size={20} className="shrink-0 mt-0.5"/>}<div>{phoneCheckResult.exists ? (<><p className="font-bold">SĐT này đã tồn tại trên hệ thống!</p><p className="text-sm mt-1">Khách hàng: <strong>{phoneCheckResult.name}</strong></p><p className="text-sm">Đang được chăm sóc bởi: <strong className="uppercase">{phoneCheckResult.rep}</strong></p></>) : (<p className="font-medium text-sm">SĐT chưa tồn tại. Có thể thêm mới.</p>)}</div></div>)}<div className="flex items-center gap-2 mt-2"><input type="checkbox" id="zaloOnly" checked={formData.isZaloOnly} onChange={toggleZaloOnly} className="w-4 h-4 text-primary-600 rounded border-gray-300" /><label htmlFor="zaloOnly" className="text-sm text-gray-600 font-medium cursor-pointer">Khách chỉ liên hệ qua Zalo</label></div></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">Khu vực / Địa chỉ</label><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input name="location" value={formData.location} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500" placeholder="VD: Quận 1, TP.HCM" /></div></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Dòng xe quan tâm</label><div className="relative"><select name="interest" value={formData.interest} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-primary-500 appearance-none cursor-pointer"><option value="">-- Chưa xác định --</option>{carList.map(model => (<option key={model} value={model}>{model}</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /></div></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">Nguồn khách</label><div className="relative"><select name="source" value={formData.source} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-primary-500 appearance-none cursor-pointer"><option value="MKT Group">MKT Group</option><option value="Hotline">Hotline</option><option value="Showroom">Showroom</option><option value="Sự kiện">Sự kiện</option><option value="Giới Thiệu">Giới Thiệu</option><option value="Khác">Khác</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /></div></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Phân loại khách</label><div className="relative"><select name="classification" value={formData.classification} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-primary-500 appearance-none cursor-pointer"><option value="Hot">Hot (Tiềm năng cao)</option><option value="Warm">Warm (Quan tâm)</option><option value="Cool">Cool (Tham khảo)</option></select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /></div></div></div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"><h4 className="text-gray-900 font-bold mb-4 flex items-center gap-2"><UserPlus size={20} className="text-blue-600"/> Chỉ định người phụ trách</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-sm font-bold text-gray-700 mb-2">Chọn nhân viên (TVBH) <span className="text-red-500">*</span></label><div className="relative"><select name="assignedRepId" value={formData.assignedRepId} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-primary-500 appearance-none cursor-pointer font-bold shadow-sm"><option value="">-- Chọn nhân viên --</option>{employees.map(emp => (<option key={emp.id} value={emp.id}>{emp.full_name} ({emp.role})</option>))}</select><ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /></div></div><div><label className="block text-sm font-bold text-gray-700 mb-2">Ngày chăm sóc tiếp theo</label><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} /><input type="date" name="recare_date" min={todayStr} value={formData.recare_date} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500" /></div></div></div></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Ghi chú phân bổ / Nhu cầu</label><div className="relative"><MessageSquare className="absolute left-3 top-3 text-gray-400" size={18} /><textarea name="notes" value={formData.notes} onChange={handleInputChange} className="w-full bg-white text-gray-900 border border-gray-300 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-primary-500 h-24 resize-none" placeholder="Nhập ghi chú..." /></div></div>
          </div>
          <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end"><button type="submit" disabled={isSubmitting} className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary-200 transition-all flex items-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Lưu & Phân bổ ngay</button></div>
      </form>
      {isDuplicateWarningOpen && duplicateData && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-fade-in"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl transform scale-100 transition-all border border-red-100"><div className="flex flex-col items-center text-center"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 animate-bounce"><AlertTriangle className="text-red-600" size={32} /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Cảnh báo Trùng lặp!</h3><p className="text-sm text-gray-500 mb-6">Số điện thoại <span className="font-bold text-gray-900">{duplicateData.phone}</span> đã tồn tại trên hệ thống.</p><div className="w-full bg-red-50 rounded-xl p-4 border border-red-100 mb-6 text-left space-y-2"><div className="flex justify-between items-center border-b border-red-200 pb-2"><span className="text-xs font-bold text-red-500 uppercase">Khách hàng cũ</span></div><div><p className="text-xs text-gray-500">Họ tên</p><p className="font-bold text-gray-900">{duplicateData.name}</p></div><div><p className="text-xs text-gray-500">Đang thuộc về TVBH</p><p className="font-bold text-red-600 uppercase">{duplicateData.sales_rep}</p></div></div><div className="flex flex-col gap-3 w-full"><button onClick={handleRequestTransfer} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Yêu cầu chăm sóc Khách hàng này'}</button><button onClick={() => { setIsDuplicateWarningOpen(false); setDuplicateData(null); setIsSubmitting(false); }} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Hủy bỏ</button></div></div></div></div>)}
    </div>
  );
};

export default AssignCustomers;

