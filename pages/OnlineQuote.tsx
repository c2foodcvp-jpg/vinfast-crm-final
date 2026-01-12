
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { CarModel, CarVersion, QuoteConfig, BankConfig, BankPackage } from '../types';
import { 
  Car, Calculator, Check, ChevronDown, DollarSign, Calendar, Landmark, Download, FileText, Loader2, CheckCircle2, AlertCircle, FileImage, Gift, Crown, Coins, ShieldCheck
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const OnlineQuote: React.FC = () => {
  const { userProfile } = useAuth();
  const quoteRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  
  // Data Sources
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [carVersions, setCarVersions] = useState<CarVersion[]>([]);
  const [promotions, setPromotions] = useState<QuoteConfig[]>([]);
  const [fees, setFees] = useState<QuoteConfig[]>([]);
  const [banks, setBanks] = useState<BankConfig[]>([]);
  const [gifts, setGifts] = useState<QuoteConfig[]>([]);
  const [memberships, setMemberships] = useState<QuoteConfig[]>([]);
  const [warranties, setWarranties] = useState<QuoteConfig[]>([]);

  // Selection State
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>(''); // For Membership Selection
  
  // Bank Package Selection
  const [selectedPackageIndex, setSelectedPackageIndex] = useState<number>(0);

  // Input State
  const [prepaidPercent, setPrepaidPercent] = useState<number>(20);
  const [manualPrepaidAmount, setManualPrepaidAmount] = useState<number | null>(null);

  const [appliedPromos, setAppliedPromos] = useState<string[]>([]);
  const [customFees, setCustomFees] = useState<Record<string, number>>({});
  const [feeOptions, setFeeOptions] = useState<Record<string, number>>({});
  const [manualDiscount, setManualDiscount] = useState<string>('');
  const [manualServiceFee, setManualServiceFee] = useState<string>('');

  useEffect(() => {
    fetchQuoteData();
  }, [userProfile]);

  useEffect(() => {
      setSelectedVersionId('');
      setAppliedPromos([]);
      setManualDiscount('');
  }, [selectedModelId]);

  useEffect(() => {
      setSelectedPackageIndex(0);
  }, [selectedBankId]);

  useEffect(() => {
      if (fees.length > 0) {
          const initOptions: Record<string, number> = {};
          fees.forEach(f => {
              if (f.options && f.options.length > 0) {
                  initOptions[f.id] = f.options[0].value;
              } else {
                  initOptions[f.id] = f.value;
              }
          });
          setFeeOptions(initOptions);
      }
  }, [fees]);

  // AUTO-SELECT PROMOS
  useEffect(() => {
      if (promotions.length > 0 && selectedModelId) {
          const validPromos = promotions.filter(p => {
              const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
              let versionMatch = true;
              if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
                  versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
              }
              return modelMatch && versionMatch;
          });
          setAppliedPromos(validPromos.map(p => p.id));
      }
  }, [selectedModelId, selectedVersionId, promotions]);

  const fetchQuoteData = async () => {
    setLoading(true);
    try {
        const [modelsRes, versionsRes, promosRes, feesRes, banksRes, giftsRes, memberRes, warrantyRes] = await Promise.all([
            supabase.from('car_models').select('*'),
            supabase.from('car_versions').select('*'),
            supabase.from('quote_configs').select('*').eq('type', 'promotion').eq('is_active', true).order('priority', {ascending: true}),
            supabase.from('quote_configs').select('*').eq('type', 'fee').eq('is_active', true).order('priority', {ascending: true}),
            supabase.from('banks').select('*'),
            supabase.from('quote_configs').select('*').eq('type', 'gift').eq('is_active', true).order('priority', {ascending: true}),
            supabase.from('quote_configs').select('*').eq('type', 'membership').eq('is_active', true).order('priority', {ascending: true}),
            supabase.from('quote_configs').select('*').eq('type', 'warranty').eq('is_active', true).order('created_at', {ascending: false}),
        ]);

        setCarModels((modelsRes.data as CarModel[]) || []);
        setCarVersions((versionsRes.data as CarVersion[]) || []);
        setPromotions((promosRes.data as QuoteConfig[]) || []);
        setFees((feesRes.data as QuoteConfig[]) || []);
        setBanks((banksRes.data as BankConfig[]) || []);
        setGifts((giftsRes.data as QuoteConfig[]) || []);
        setMemberships((memberRes.data as QuoteConfig[]) || []);
        setWarranties((warrantyRes.data as QuoteConfig[]) || []);
        
        if (banksRes.data && banksRes.data.length > 0) {
            setSelectedBankId(banksRes.data[0].id);
        }

    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const selectedVersion = carVersions.find(v => v.id === selectedVersionId);
  const selectedBank = banks.find(b => b.id === selectedBankId);

  // --- UPDATED WARRANTY LOGIC (Hardcoded as requested) ---
  const getWarrantyPeriod = (modelId: string) => {
      const model = carModels.find(m => m.id === modelId);
      if (!model) return "Theo chính sách VinFast";

      const name = model.name.toUpperCase();
      
      // Logic: VF 7, 8, 9, Lac Hong -> 10 Years
      if (name.includes('VF 7') || name.includes('VF 8') || name.includes('VF 9') || name.includes('LẠC HỒNG')) {
          return "10 Năm không giới hạn Km";
      }
      
      // Default: 7 Years
      return "07 năm hoặc 160.000 Km";
  };

  const currentInterestRate = useMemo(() => {
      if (!selectedBank) return 0;
      if (selectedBank.packages && selectedBank.packages.length > 0) {
          return selectedBank.packages[selectedPackageIndex]?.rate || 0;
      }
      return selectedBank.interest_rate_1y || 0;
  }, [selectedBank, selectedPackageIndex]);

  // --- CALCULATIONS ---
  const listPrice = selectedVersion?.price || 0;

  // Membership Logic
  const membershipCalculation = useMemo(() => {
      const selectedMem = memberships.find(m => m.id === selectedMembershipId);
      if (!selectedMem) return { discount: 0, giftValue: 0, name: '' };
      
      const discount = listPrice * (selectedMem.value / 100);
      const giftValue = listPrice * ((selectedMem.gift_ratio || 0) / 100);
      
      return { discount, giftValue, name: selectedMem.name, percent: selectedMem.value, giftPercent: selectedMem.gift_ratio };
  }, [selectedMembershipId, listPrice, memberships]);

  // 1. Calculate Final INVOICE Price (Giá Xe Hóa Đơn)
  const invoicePromoCalculation = useMemo(() => {
      let currentPrice = listPrice;
      const breakdown: {name: string, amount: number}[] = [];
      
      // A. Standard Promos (Target: Invoice)
      const applicable = promotions.filter(p => {
          const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
          let versionMatch = true;
          if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
              versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
          }
          return modelMatch && versionMatch;
      });
      
      const invoicePromos = applicable.filter(p => !p.target_type || p.target_type === 'invoice');
      invoicePromos.sort((a,b) => a.priority - b.priority);

      invoicePromos.forEach(p => {
          if (appliedPromos.includes(p.id)) {
              let amount = 0;
              if (p.value_type === 'percent') {
                  amount = listPrice * (p.value / 100);
              } else {
                  amount = p.value;
              }
              currentPrice -= amount;
              breakdown.push({ name: p.name, amount });
          }
      });

      // B. Membership Discount
      if (membershipCalculation.discount > 0) {
          currentPrice -= membershipCalculation.discount;
          breakdown.push({ name: `Ưu đãi ${membershipCalculation.name} (-${membershipCalculation.percent}%)`, amount: membershipCalculation.discount });
      }
      
      return { finalPrice: Math.max(0, currentPrice), breakdown };
  }, [listPrice, promotions, appliedPromos, selectedModelId, selectedVersionId, membershipCalculation]);

  const finalInvoicePrice = invoicePromoCalculation.finalPrice;

  // 2. Fees
  const feeCalculation = useMemo(() => {
      let totalFees = 0;
      const breakdown: {name: string, amount: number, originalId: string}[] = [];
      
      fees.forEach(f => {
          let baseValue = f.value;
          if (f.options && f.options.length > 0 && feeOptions[f.id] !== undefined) {
              baseValue = feeOptions[f.id];
          }
          if (customFees[f.id] !== undefined) {
              baseValue = customFees[f.id];
          }

          let amount = baseValue;
          if (f.value_type === 'percent') {
              amount = listPrice * (baseValue / 100);
          }
          totalFees += amount;
          
          let displayLabel = f.name;
          if (f.options && f.options.length > 0) {
             const selectedOpt = f.options.find(o => o.value === feeOptions[f.id]);
             if (selectedOpt) displayLabel = `${f.name} (${selectedOpt.label})`;
          }

          breakdown.push({ name: displayLabel, amount, originalId: f.id });
      });
      
      const serviceFee = Number(manualServiceFee.replace(/\D/g, ''));
      if (serviceFee > 0) {
          totalFees += serviceFee;
          breakdown.push({ name: "Dịch vụ đăng ký (Khác)", amount: serviceFee, originalId: 'manual_service' });
      }

      return { totalFees, breakdown };
  }, [fees, customFees, feeOptions, listPrice, manualServiceFee]);

  const totalFees = feeCalculation.totalFees;

  // 3. Rolling Promos & Manual Discount
  const rollingPromoCalculation = useMemo(() => {
      let totalDiscount = 0;
      const breakdown: {name: string, amount: number}[] = [];

      const applicable = promotions.filter(p => {
          const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
          let versionMatch = true;
          if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
              versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
          }
          return modelMatch && versionMatch;
      });

      const rollingPromos = applicable.filter(p => p.target_type === 'rolling');

      rollingPromos.forEach(p => {
          if (appliedPromos.includes(p.id)) {
              let amount = 0;
              if (p.value_type === 'percent') {
                  amount = listPrice * (p.value / 100);
              } else {
                  amount = p.value;
              }
              totalDiscount += amount;
              breakdown.push({ name: p.name, amount });
          }
      });

      const manualVal = Number(manualDiscount.replace(/\D/g, ''));
      if (manualVal > 0) {
          totalDiscount += manualVal;
          breakdown.push({ name: 'Giảm giá thêm', amount: manualVal });
      }

      return { totalDiscount, breakdown };
  }, [promotions, appliedPromos, selectedModelId, selectedVersionId, listPrice, manualDiscount]);

  // Final Rolling Calculation
  const preRollingPrice = finalInvoicePrice + totalFees;
  const finalRollingPrice = Math.max(0, preRollingPrice - rollingPromoCalculation.totalDiscount);

  // 4. Payment & Loan
  const loanAmount = useMemo(() => {
      if (manualPrepaidAmount !== null) {
          return Math.max(0, finalInvoicePrice - manualPrepaidAmount);
      }
      return finalInvoicePrice * ((100 - prepaidPercent) / 100);
  }, [finalInvoicePrice, prepaidPercent, manualPrepaidAmount]);

  const upfrontPayment = Math.max(0, finalRollingPrice - loanAmount);

  const handlePrepaidPercentChange = (val: number) => {
      setPrepaidPercent(val);
      setManualPrepaidAmount(null);
  };

  const handleManualPrepaidChange = (val: number) => {
      setManualPrepaidAmount(val);
      if (finalInvoicePrice > 0) {
          const pct = (val / finalInvoicePrice) * 100;
          setPrepaidPercent(Math.round(pct));
      }
  };

  // 5. Monthly Payment Table
  const monthlyPaymentTable = useMemo(() => {
      if (!selectedBank || loanAmount <= 0) return [];
      const rate = currentInterestRate / 100;
      const result = [];
      for (let year = 3; year <= 8; year++) {
          const months = year * 12;
          const principal = loanAmount / months;
          const interest = (loanAmount * rate) / 12;
          const firstMonth = principal + interest;
          result.push({ year, monthly: firstMonth });
      }
      return result;
  }, [loanAmount, selectedBank, currentInterestRate]);

  // Helper to check if gift is VinPoint
  const getGiftDetails = (g: QuoteConfig) => {
      if (g.options && g.options.length > 0) {
          const mapped = g.options.find(opt => opt.model_id === selectedModelId);
          if (mapped) {
              return { isVinPoint: true, value: mapped.value, label: `${g.name} (Tích điểm)` };
          }
          return null;
      }
      return { isVinPoint: false, value: g.value, label: g.name };
  };

  const activeGifts = gifts.map(g => getGiftDetails(g)).filter(g => g !== null) as {isVinPoint: boolean, value: number, label: string}[];

  const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

  // --- IMPROVED EXPORT LOGIC WITH CLONE ---
  const handleExportQuote = async (type: 'pdf' | 'image') => {
      if (!quoteRef.current) return;
      
      // 1. Create a deep clone of the element
      const originalElement = quoteRef.current;
      const clone = originalElement.cloneNode(true) as HTMLElement;
      
      // 2. Setup the clone container with fixed desktop-like dimensions
      // This ensures the layout is always consistent regardless of current screen size
      clone.style.width = '1000px'; 
      clone.style.height = 'auto';
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.zIndex = '-1000';
      clone.style.backgroundColor = '#ffffff'; // Force white background
      
      // Remove classes that might cause issues (like sticky positioning)
      clone.classList.remove('sticky', 'top-6');
      const stickyElements = clone.querySelectorAll('.sticky');
      stickyElements.forEach(el => el.classList.remove('sticky'));

      // 3. Append to body so html2canvas can see it
      document.body.appendChild(clone);

      try {
          // 4. Capture using html2canvas
          const canvas = await html2canvas(clone, { 
              scale: 2, // High resolution for better text clarity
              useCORS: true, 
              backgroundColor: '#ffffff',
              width: 1000,
              windowWidth: 1280 // Simulate a desktop window width
          });
          
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          
          if (type === 'image') {
              const link = document.createElement('a');
              link.download = `BaoGia_VinFast_${new Date().getTime()}.jpg`;
              link.href = imgData;
              link.click();
          } else {
              // PDF Export
              const pdf = new jsPDF('p', 'mm', 'a4');
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = pdf.internal.pageSize.getHeight();
              
              // Calculate scaled height to fit A4 width
              const imgProps = pdf.getImageProperties(imgData);
              const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
              
              pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight);
              pdf.save(`BaoGia_VinFast_${new Date().getTime()}.pdf`);
          }
      } catch (err) {
          console.error("Export failed", err);
          alert("Lỗi khi xuất file. Vui lòng thử lại.");
      } finally {
          // 5. Cleanup: Remove the clone from DOM
          document.body.removeChild(clone);
      }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600"/></div>;

  const availablePromos = promotions.filter(p => {
      const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
      let versionMatch = true;
      if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
          versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
      }
      return modelMatch && versionMatch;
  });

  return (
    <div className="max-w-[1200px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calculator className="text-emerald-600"/> Báo Giá Online
          </h1>
          <div className="flex gap-2">
              <button onClick={() => handleExportQuote('image')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg text-sm">
                  <FileImage size={16}/> Lưu Ảnh
              </button>
              <button onClick={() => handleExportQuote('pdf')} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg text-sm">
                  <FileText size={16}/> Xuất PDF
              </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: CONFIGURATION */}
          <div className="lg:col-span-5 space-y-6">
              {/* Car Selection */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Car size={18}/> Chọn xe</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-600 mb-1">Dòng xe</label>
                          <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium" value={selectedModelId} onChange={e => setSelectedModelId(e.target.value)}>
                              <option value="">-- Chọn dòng xe --</option>
                              {carModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-600 mb-1">Phiên bản</label>
                          <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium" value={selectedVersionId} onChange={e => setSelectedVersionId(e.target.value)} disabled={!selectedModelId}>
                              <option value="">-- Chọn phiên bản --</option>
                              {carVersions.filter(v => v.model_id === selectedModelId).map(v => <option key={v.id} value={v.id}>{v.name} ({formatCurrency(v.price)})</option>)}
                          </select>
                      </div>
                  </div>
              </div>

              {/* MEMBERSHIP */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Crown size={18}/> Hạng Khách hàng</h3>
                  <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <input 
                              type="radio" 
                              name="membership" 
                              className="w-4 h-4 text-emerald-600"
                              checked={selectedMembershipId === ''}
                              onChange={() => setSelectedMembershipId('')}
                          />
                          <span className="text-sm text-gray-700">Khách hàng thông thường</span>
                      </label>
                      {memberships.map(m => (
                          <label key={m.id} className="flex items-center gap-3 cursor-pointer p-2 border border-yellow-200 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                              <input 
                                  type="radio" 
                                  name="membership" 
                                  className="w-4 h-4 text-emerald-600"
                                  checked={selectedMembershipId === m.id}
                                  onChange={() => setSelectedMembershipId(m.id)}
                              />
                              <div className="flex-1">
                                  <span className="text-sm font-bold text-gray-800">{m.name}</span>
                                  <div className="text-xs text-gray-600 flex gap-2">
                                      <span>Giảm: <strong>{m.value}%</strong></span>
                                      {m.gift_ratio && <span>+ Tặng thêm: <strong>{m.gift_ratio}%</strong></span>}
                                  </div>
                              </div>
                          </label>
                      ))}
                  </div>
              </div>

              {/* Promotions */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18}/> Khuyến mãi áp dụng</h3>
                  {availablePromos.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">Không có khuyến mãi cho dòng xe này.</p>
                  ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                          {availablePromos.map(p => (
                              <div key={p.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setAppliedPromos(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}>
                                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${appliedPromos.includes(p.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                                      {appliedPromos.includes(p.id) && <Check size={14}/>}
                                  </div>
                                  <div className="flex-1">
                                      <p className="text-sm font-bold text-gray-800">{p.name}</p>
                                      <div className="flex justify-between items-center mt-0.5">
                                          <p className="text-xs text-emerald-600 font-bold">Giảm {p.value_type === 'percent' ? `${p.value}%` : formatCurrency(p.value)}</p>
                                          {p.target_type === 'rolling' && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 rounded uppercase font-bold">Lăn bánh</span>}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
                  
                  {/* MANUAL DISCOUNT FIELD */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                      <label className="block text-sm font-bold text-gray-700 mb-1">Giảm giá thêm (VNĐ)</label>
                      <input 
                          type="text" 
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-bold text-red-600"
                          value={manualDiscount}
                          onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setManualDiscount(val ? Number(val).toLocaleString('vi-VN') : '');
                          }}
                          placeholder="Nhập số tiền giảm thêm..."
                      />
                      <p className="text-xs text-gray-400 mt-1 italic">Số tiền này sẽ trừ vào giá Lăn bánh cuối cùng.</p>
                  </div>
              </div>

              {/* Bank Config */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Landmark size={18}/> Vay Ngân hàng</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-600 mb-1">Ngân hàng</label>
                          <div className="grid grid-cols-2 gap-2">
                              {banks.map(b => (
                                  <button 
                                    key={b.id} 
                                    onClick={() => setSelectedBankId(b.id)}
                                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${selectedBankId === b.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                  >
                                      {b.name}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Package Selection */}
                      {selectedBank && selectedBank.packages && selectedBank.packages.length > 0 && (
                          <div>
                              <label className="block text-sm font-bold text-gray-600 mb-1">Gói lãi suất</label>
                              <select 
                                  className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none text-sm font-medium"
                                  value={selectedPackageIndex}
                                  onChange={e => setSelectedPackageIndex(Number(e.target.value))}
                              >
                                  {selectedBank.packages.map((pkg, idx) => (
                                      <option key={idx} value={idx}>{pkg.name} ({pkg.rate}%)</option>
                                  ))}
                              </select>
                          </div>
                      )}

                      <div>
                          <div className="flex justify-between mb-1">
                              <label className="block text-sm font-bold text-gray-600">Trả trước (theo XHĐ)</label>
                              <span className="text-sm font-bold text-blue-600">{prepaidPercent}%</span>
                          </div>
                          
                          {/* Slider */}
                          <input type="range" min="15" max="95" step="5" value={prepaidPercent} onChange={e => handlePrepaidPercentChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2"/>
                          <div className="flex justify-between text-xs text-gray-400 mb-2"><span>15%</span><span>50%</span><span>95%</span></div>
                          
                          {/* Manual Prepaid Input */}
                          <label className="block text-xs font-bold text-gray-500 mb-1">Hoặc nhập số tiền (VNĐ)</label>
                          <input 
                              type="text" 
                              className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-bold text-gray-800"
                              value={manualPrepaidAmount !== null ? formatCurrency(manualPrepaidAmount) : ''}
                              onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  handleManualPrepaidChange(val ? Number(val) : 0);
                              }}
                              placeholder={formatCurrency(finalInvoicePrice * (prepaidPercent / 100))}
                          />
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT COLUMN: QUOTE SHEET (VISUAL) */}
          <div className="lg:col-span-7">
              <div ref={quoteRef} className="bg-[#e6fffa] border-2 border-emerald-500 rounded-2xl overflow-hidden shadow-xl sticky top-6">
                  {/* Header Image Area */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white relative overflow-hidden">
                      <div className="relative z-10">
                          <h2 className="text-3xl font-extrabold uppercase tracking-tight">Báo Giá Xe {carModels.find(m=>m.id===selectedModelId)?.name || 'VinFast'}</h2>
                          <p className="text-emerald-100 font-medium text-lg mt-1">{selectedVersion?.name || 'Vui lòng chọn phiên bản'}</p>
                          
                          {/* Specs Summary */}
                          {selectedVersion && (
                              <div className="mt-4 grid grid-cols-2 gap-y-1 text-sm font-medium text-white/90">
                                  <div className="flex items-center gap-1"><CheckCircle2 size={14}/> Giá niêm yết: {formatCurrency(listPrice)}</div>
                                  <div className="flex items-center gap-1"><ShieldCheck size={14}/> {getWarrantyPeriod(selectedModelId)}</div>
                              </div>
                          )}
                      </div>
                      <Car className="absolute -right-6 -bottom-6 text-white opacity-20 w-48 h-48 transform -rotate-12"/>
                  </div>

                  <div className="p-6 space-y-6">
                      {/* 1. PRICE & PROMOS (INVOICE TARGET) */}
                      <div>
                          <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                              <span className="text-sm font-bold text-gray-500 uppercase">Giá xe (Hóa đơn)</span>
                          </div>
                          <div className="space-y-2">
                              <div className="flex justify-between">
                                  <span className="font-bold text-gray-800">Giá Niêm Yết</span>
                                  <span className="font-bold text-gray-900">{formatCurrency(listPrice)} VNĐ</span>
                              </div>
                              {invoicePromoCalculation.breakdown.map((p, idx) => (
                                  <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-emerald-300">
                                      <span>• {p.name}</span>
                                      <span className="font-bold text-red-500">-{formatCurrency(p.amount)}</span>
                                  </div>
                              ))}
                              <div className="flex justify-between pt-2 mt-2 border-t border-dashed border-emerald-300">
                                  <span className="font-extrabold text-blue-600 uppercase">GIÁ XUẤT HÓA ĐƠN</span>
                                  <span className="font-extrabold text-blue-600 text-lg">{formatCurrency(finalInvoicePrice)} VNĐ</span>
                              </div>
                          </div>
                      </div>

                      {/* 2. FEES - UPDATED WITH OPTIONS */}
                      <div>
                          <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                              <span className="text-sm font-bold text-gray-500 uppercase">Chi phí lăn bánh (Dự kiến)</span>
                          </div>
                          <div className="space-y-2 text-sm">
                              {fees.map((f) => (
                                  <div key={f.id} className="flex justify-between items-center group">
                                      <div className="flex items-center gap-2">
                                          <span className="text-gray-700 font-medium">{f.name}</span>
                                          {/* Show Dropdown if Options exist */}
                                          {f.options && f.options.length > 0 && (
                                              <select 
                                                  className="bg-gray-50 border border-gray-300 text-gray-800 text-xs rounded p-1 outline-none font-bold"
                                                  value={feeOptions[f.id] || f.options[0].value}
                                                  onChange={(e) => setFeeOptions({...feeOptions, [f.id]: Number(e.target.value)})}
                                              >
                                                  {f.options.map((opt, idx) => (
                                                      <option key={idx} value={opt.value}>{opt.label}</option>
                                                  ))}
                                              </select>
                                          )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                          {/* Editable Fee if no options */}
                                          <input 
                                            className="text-right font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-emerald-500 focus:bg-white w-28 outline-none transition-all"
                                            value={formatCurrency(
                                                (f.options && f.options.length > 0) ? (feeOptions[f.id] || 0) : (customFees[f.id] !== undefined ? customFees[f.id] : f.value)
                                            )}
                                            onChange={(e) => {
                                                // Only allow manual edit if NOT options based
                                                if (!f.options || f.options.length === 0) {
                                                    const val = Number(e.target.value.replace(/\./g, ''));
                                                    if (!isNaN(val)) setCustomFees({...customFees, [f.id]: val});
                                                }
                                            }}
                                            disabled={!!f.options && f.options.length > 0}
                                          />
                                          <span className="text-gray-500 text-xs">VNĐ</span>
                                      </div>
                                  </div>
                              ))}
                              
                              {/* MANUAL SERVICE FEE INPUT */}
                              <div className="flex justify-between items-center group pt-1">
                                  <span className="text-gray-700 font-medium">Dịch vụ đăng ký (Khác)</span>
                                  <div className="flex items-center gap-2">
                                      <input 
                                        className="text-right font-bold text-blue-600 bg-blue-50/50 border-b border-blue-200 focus:border-blue-500 w-28 outline-none transition-all"
                                        value={manualServiceFee}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setManualServiceFee(val ? Number(val).toLocaleString('vi-VN') : '');
                                        }}
                                        placeholder="0"
                                      />
                                      <span className="text-gray-500 text-xs">VNĐ</span>
                                  </div>
                              </div>

                              <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                                  <span className="font-bold text-gray-600 uppercase">TỔNG PHÍ ĐĂNG KÝ</span>
                                  <span className="font-bold text-gray-800">{formatCurrency(totalFees)} VNĐ</span>
                              </div>
                          </div>
                      </div>

                      {/* 3. ROLLING PROMOS */}
                      {rollingPromoCalculation.totalDiscount > 0 && (
                          <div>
                              <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                  <span className="text-sm font-bold text-gray-500 uppercase">Ưu đãi Lăn bánh / Giảm thêm</span>
                              </div>
                              <div className="space-y-2">
                                  {rollingPromoCalculation.breakdown.map((p, idx) => (
                                      <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-orange-300">
                                          <span>• {p.name}</span>
                                          <span className="font-bold text-red-500">-{formatCurrency(p.amount)}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* 4. TOTAL ROLLING */}
                      <div className="bg-white p-4 rounded-xl border-2 border-red-100 text-center shadow-inner">
                          <p className="text-gray-500 font-bold uppercase text-xs">TỔNG CỘNG LĂN BÁNH</p>
                          <p className="text-3xl font-extrabold text-red-600 tracking-tight">{formatCurrency(finalRollingPrice)} VNĐ</p>
                          <p className="text-[10px] text-gray-400 mt-1">(Đã bao gồm Giá xe + Phí - Khuyến mãi)</p>
                      </div>

                      {/* 5. GIFTS & MEMBERSHIP BONUS (UPDATED with VinPoint) */}
                      {(activeGifts.length > 0 || membershipCalculation.giftValue > 0) && (
                          <div>
                              <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                  <span className="text-sm font-bold text-gray-500 uppercase flex items-center gap-1"><Gift size={14}/> QUÀ TẶNG & ƯU ĐÃI THÊM</span>
                              </div>
                              <div className="space-y-2">
                                  {activeGifts.map((g, idx) => (
                                      <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-purple-300">
                                          <span>• {g.label}</span>
                                          {g.isVinPoint ? (
                                              <span className="font-bold text-yellow-600 flex items-center gap-1"><Coins size={12}/> {formatCurrency(g.value)} điểm</span>
                                          ) : (
                                              <span className="font-bold text-purple-600">{g.value > 0 ? formatCurrency(g.value) : 'Hiện vật'}</span>
                                          )}
                                      </div>
                                  ))}
                                  {membershipCalculation.giftValue > 0 && (
                                      <div className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-yellow-300">
                                          <span>• Ưu đãi {membershipCalculation.name} (Tặng thêm {membershipCalculation.giftPercent}%)</span>
                                          <span className="font-bold text-green-600">+{formatCurrency(membershipCalculation.giftValue)}</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}

                      {/* 6. BANK PREVIEW (UPDATED) */}
                      {selectedBank && loanAmount > 0 && (
                          <div className="bg-white rounded-xl overflow-hidden border border-blue-100">
                              <div className="bg-blue-50 p-3 flex items-center justify-between border-b border-blue-100">
                                  <div className="flex items-center gap-2 text-blue-800 font-bold"><Landmark size={18}/> BẢNG TÍNH VAY NGÂN HÀNG</div>
                                  <div className="text-xs font-bold bg-white text-blue-600 px-2 py-1 rounded border border-blue-200">
                                      {currentInterestRate > 0 ? `Lãi ${currentInterestRate}% năm đầu` : 'Chưa có lãi suất'}
                                  </div>
                              </div>
                              <div className="p-4 grid grid-cols-2 gap-6 bg-blue-50/30">
                                  <div>
                                      <p className="text-xs text-gray-500 uppercase font-bold">Thanh toán đối ứng</p>
                                      <p className="text-lg font-bold text-red-600">{formatCurrency(upfrontPayment)}</p>
                                      <p className="text-[10px] text-gray-400">(Lăn bánh - Vay)</p>
                                  </div>
                                  <div className="text-right">
                                      <p className="text-xs text-gray-500 uppercase font-bold">Số tiền vay</p>
                                      <p className="text-lg font-bold text-blue-600">{formatCurrency(loanAmount)}</p>
                                      <p className="text-[10px] text-gray-400">({prepaidPercent}% Trả trước)</p>
                                  </div>
                              </div>
                              <div className="bg-white p-4 border-t border-gray-100">
                                  <p className="text-xs font-bold text-gray-500 uppercase mb-3 text-center">ƯỚC TÍNH TRẢ GÓP (GỐC + LÃI THÁNG ĐẦU)</p>
                                  <div className="grid grid-cols-3 gap-3 text-center">
                                      {monthlyPaymentTable.map(row => (
                                          <div key={row.year} className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                              <p className="text-[10px] text-gray-500 font-bold mb-1">{row.year} Năm</p>
                                              <p className="text-sm font-bold text-blue-700">{formatCurrency(row.monthly)}</p>
                                          </div>
                                      ))}
                                  </div>
                                  <p className="text-[10px] text-center text-gray-400 mt-3 italic flex items-center justify-center gap-1">
                                      <AlertCircle size={10}/> Số tiền tính theo dư nợ giảm dần, lãi suất thả nổi sau ưu đãi.
                                  </p>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default OnlineQuote;
