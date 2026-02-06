import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MembershipTier } from '../types';
import { Sparkles, Lock, ArrowUpCircle } from 'lucide-react';
import LunarCalendar from '../components/LunarCalendar';

const Utilities: React.FC = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    const isPlatinumOrHigher =
        userProfile?.member_tier === MembershipTier.PLATINUM ||
        userProfile?.member_tier === MembershipTier.DIAMOND;

    if (!isPlatinumOrHigher) {
        return (
            <div className="max-w-4xl mx-auto mt-10 p-8 bg-white border border-gray-100 rounded-3xl shadow-sm text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock className="text-gray-400" size={32} />
                </div>
                <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Tiện ích Cao cấp</h2>
                <p className="text-gray-500 max-w-lg mx-auto mb-8">
                    Trang này chứa các công cụ nâng cao và tiện ích mở rộng chỉ dành cho thành viên hạng
                    <span className="font-bold text-slate-700"> Platinum</span> trở lên.
                </p>

                <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all cursor-default">
                    <ArrowUpCircle size={20} />
                    <span>Nâng cấp hạng thành viên</span>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="text-purple-600" />
                    Tiện ích & Mở rộng
                </h1>
                <p className="text-gray-500">Các công cụ hỗ trợ nâng cao dành cho bạn.</p>
            </div>

            {/* Featured Utility: Lunar Calendar */}
            <div className="mb-10">
                <LunarCalendar />
            </div>

            <div className="border-t border-gray-100 my-8"></div>

            <h3 className="text-lg font-bold text-gray-800 mb-6">Các tiện ích khác</h3>

            {/* Placeholder Grid for Future Tools */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Example Placeholder Card 1 */}
                {/* Finance Tool */}
                <div onClick={() => navigate('/finance/customer')} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
                    <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Sparkles className="text-green-600" size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">Quản lý Thu Chi (Beta)</h3>
                    <p className="text-sm text-gray-500">Theo dõi, quản lý công nợ và lợi nhuận từng khách hàng.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Sparkles className="text-purple-600" size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">Trợ lý AI (Sắp ra mắt)</h3>
                    <p className="text-sm text-gray-500">Tự động phân tích và gợi ý chăm sóc khách hàng dựa trên lịch sử tương tác.</p>
                </div>

                {/* Example Placeholder Card 2 */}
                <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 shadow-sm flex flex-col items-center justify-center text-center opacity-70">
                    <p className="text-sm font-bold text-gray-400">Tính năng đang phát triển...</p>
                </div>
            </div>
        </div>
    );
};

export default Utilities;
