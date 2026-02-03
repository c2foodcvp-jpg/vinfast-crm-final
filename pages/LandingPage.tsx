import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ArrowLeft, CheckCircle2, Shield, Zap, Users, BarChart3, Globe, Star, Crown, Gem, Check } from 'lucide-react';
import PurchaseModal from '../components/PurchaseModal';

const LandingPage = () => {
    const navigate = useNavigate();
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<'GOLD' | 'PLATINUM' | 'DIAMOND' | 'TRIAL'>('PLATINUM');

    useEffect(() => {
        const fetchSystemLogo = async () => {
            const { data } = await supabase.from('app_settings').select('value').eq('key', 'system_logo_login').maybeSingle();
            if (data?.value) setLogoUrl(data.value);
        };
        fetchSystemLogo();
    }, []);

    const handleBuy = (pkg: 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'TRIAL') => {
        setSelectedPackage(pkg);
        setIsPurchaseModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-[#0F172A] text-white font-sans selection:bg-blue-500 selection:text-white pb-20">
            {/* Header / Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0F172A]/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain" />
                        ) : (
                            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <span className="font-bold text-xl text-white">V</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full font-medium transition-all flex items-center gap-2 group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Quay lại Đăng nhập
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section className="pt-40 pb-20 px-6 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] -z-10"></div>

                <div className="max-w-5xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 font-medium text-sm mb-8 animate-fade-in-up">
                        <Star size={14} fill="currentColor" />
                        <span>Hệ thống CRM SỐ 1 dành cho Sales VinFast</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                        Quản trị Khách hàng <br />
                        <span className="text-blue-500">Chuyên nghiệp & Hiệu quả</span>
                    </h1>

                    <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed mb-12">
                        Giải pháp tối ưu hóa quy trình bán hàng, từ quản lý lead, báo giá tự động,
                        tính lãi ngân hàng đến chăm sóc sau bán hàng. Dành riêng cho đội ngũ kinh doanh VinFast.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                        <button onClick={() => handleBuy('TRIAL')} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 text-lg">
                            Đăng ký dùng thử <Zap size={20} />
                        </button>
                        <button
                            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold transition-all hover:scale-105 flex items-center gap-3 text-lg"
                        >
                            Xem bảng giá
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Feature */}
            <section className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Tính năng Vượt trội</h2>
                        <p className="text-gray-400">Đầy đủ công cụ để bạn bứt phá doanh số</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <Users className="text-blue-400" size={32} />,
                                title: "Quản lý Khách hàng",
                                desc: "Phân loại khách hàng theo phễu (Cold, Warm, Hot). Theo dõi lịch sử chăm sóc chi tiết, đặt lịch hẹn và nhắc nhở tự động."
                            },
                            {
                                icon: <Zap className="text-yellow-400" size={32} />,
                                title: "Báo giá Siêu tốc",
                                desc: "Tạo báo giá lăn bánh chính xác 100% chỉ trong 30s. Xuất file PDF/Ảnh chuyên nghiệp gửi khách hàng ngay lập tức."
                            },
                            {
                                icon: <BarChart3 className="text-emerald-400" size={32} />,
                                title: "Tính lãi vay Ngân hàng",
                                desc: "Công cụ tính lãi vay dư nợ giảm dần chính xác, hỗ trợ nhiều gói vay ưu đãi. Giúp khách hàng dễ dàng ra quyết định."
                            },
                            {
                                icon: <Globe className="text-purple-400" size={32} />,
                                title: "Phân bổ Lead Tự động",
                                desc: "Hệ thống tự động chia Lead từ Marketing cho nhân viên theo quy tắc công bằng hoặc chỉ định. Thông báo Real-time."
                            },
                            {
                                icon: <Shield className="text-red-400" size={32} />,
                                title: "Quản lý Đội nhóm & Quỹ",
                                desc: "Quản lý KPI, hoa hồng, và quỹ đội nhóm (Team Fund) minh bạch. Phân quyền chi tiết (Employee, Mod, Admin)."
                            },
                            {
                                icon: <CheckCircle2 className="text-cyan-400" size={32} />,
                                title: "Kho xe & Chính sách",
                                desc: "Cập nhật tồn kho xe, chính sách bán hàng và khuyến mãi realtime. Không bao giờ bỏ lỡ thông tin quan trọng."
                            }
                        ].map((feature, idx) => (
                            <div key={idx} className="p-8 bg-white/5 border border-white/5 rounded-3xl hover:bg-white/10 transition-colors group">
                                <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="py-20 px-6 relative" id="pricing">
                {/* Background Decor */}
                <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[100px] -z-10"></div>

                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Bảng giá Dịch vụ</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Chi phí linh hoạt theo quy mô đội nhóm. Tối ưu chi phí, tối đa lợi nhuận.
                            <br />
                            <span className="text-sm text-blue-400 mt-2 block">*Mặc định tối đa 06 thành viên. Thêm thành viên: +120k/người/tháng.</span>
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">

                        {/* GOLD */}
                        <div className="p-8 bg-[#1E293B] border border-gray-700 rounded-3xl relative flex flex-col h-full hover:border-yellow-500/30 transition-colors">
                            <h3 className="text-2xl font-bold text-yellow-500 flex items-center gap-2">
                                <Star fill="currentColor" /> GOLD
                            </h3>
                            <div className="my-6">
                                <span className="text-4xl font-bold text-white">800.000đ</span>
                                <span className="text-gray-400">/tháng</span>
                            </div>
                            <p className="text-gray-400 text-sm mb-6 pb-6 border-b border-gray-700 min-h-[60px]">
                                Dành cho đội nhóm nhỏ, showroom mới thành lập.
                            </p>
                            <ul className="space-y-4 text-sm text-gray-300 flex-1">
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> Tối đa 06 thành viên</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> Quản lý Khách hàng cơ bản</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> Báo giá & Tính lãi vay</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> Quản lý quỹ nhóm</li>
                                <li className="flex gap-3 text-gray-500"><XIcon /> Không hỗ trợ API Marketing</li>
                                <li className="flex gap-3 text-gray-500"><XIcon /> Không có phân bổ Lead tự động</li>
                            </ul>
                            <button onClick={() => handleBuy('GOLD')} className="w-full py-4 mt-8 rounded-xl font-bold border border-gray-600 hover:bg-gray-700 transition-colors">
                                Chọn Gói Gold
                            </button>
                        </div>

                        {/* PLATINUM - Popular */}
                        <div className="p-8 bg-gradient-to-b from-blue-900/50 to-[#0F172A] border border-blue-500 rounded-3xl relative md:scale-105 shadow-2xl shadow-blue-900/50 z-10 flex flex-col h-full">
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                Khuyên Dùng
                            </div>
                            <h3 className="text-2xl font-bold text-blue-200 flex items-center gap-2">
                                <Crown fill="currentColor" className="text-blue-400" /> PLATINUM
                            </h3>
                            <div className="my-6">
                                <span className="text-5xl font-bold text-white">1.000.000đ</span>
                                <span className="text-gray-400">/tháng</span>
                            </div>
                            <p className="text-gray-300 text-sm mb-6 pb-6 border-b border-blue-500/30 min-h-[60px]">
                                Đầy đủ tính năng, phù hợp với hầu hết các đội nhóm kinh doanh chuyên nghiệp.
                            </p>
                            <ul className="space-y-4 text-sm text-white flex-1">
                                <li className="flex gap-3"><Check size={18} className="text-blue-400 shrink-0" /> <strong>TẤT CẢ tính năng Gold</strong></li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-400 shrink-0" /> Phân bổ Lead tự động (Automated)</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-400 shrink-0" /> Tích hợp Form Marketing</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-400 shrink-0" /> Báo cáo Analytics chuyên sâu</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-400 shrink-0" /> Xuất file Báo giá PDF/Ảnh High-Res</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-400 shrink-0" /> Hỗ trợ kỹ thuật 24/7</li>
                            </ul>
                            <button onClick={() => handleBuy('PLATINUM')} className="w-full py-4 mt-8 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all transform hover:scale-105">
                                Chọn Platinum
                            </button>
                        </div>

                        {/* DIAMOND */}
                        <div className="p-8 bg-[#1E293B] border border-gray-700 rounded-3xl relative flex flex-col h-full hover:border-cyan-500/30 transition-colors">
                            <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                                <Gem /> DIAMOND
                            </h3>
                            <div className="my-6">
                                <span className="text-4xl font-bold text-white">1.200.000đ</span>
                                <span className="text-gray-400">/tháng</span>
                            </div>
                            <p className="text-gray-400 text-sm mb-6 pb-6 border-b border-gray-700 min-h-[60px]">
                                Dành cho các đại lý lớn, cần tùy biến và tính năng cao cấp nhất.
                            </p>
                            <ul className="space-y-4 text-sm text-gray-300 flex-1">
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> <strong>TẤT CẢ tính năng Platinum</strong></li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> Gửi Email Báo giá tự động</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> Tùy biến Quy trình bán hàng</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> Đào tạo & Setup hệ thống tận nơi</li>
                                <li className="flex gap-3"><Check size={18} className="text-blue-500 shrink-0" /> API riêng biệt</li>
                            </ul>
                            <button onClick={() => handleBuy('DIAMOND')} className="w-full py-4 mt-8 rounded-xl font-bold border border-gray-600 hover:bg-gray-700 transition-colors">
                                Liên hệ Admin
                            </button>
                        </div>

                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10 text-center text-gray-500">
                <p>&copy; 2026 VinFast CRM System. All rights reserved.</p>
            </footer>

            {/* Purchase Modal */}
            <PurchaseModal
                isOpen={isPurchaseModalOpen}
                onClose={() => setIsPurchaseModalOpen(false)}
                selectedPackage={selectedPackage}
            />
        </div>
    );
};

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 opacity-60"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
)

export default LandingPage;
