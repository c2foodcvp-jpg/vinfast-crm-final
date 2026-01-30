import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Home, Search, AlertCircle, ArrowLeft } from 'lucide-react';

const { Link, useNavigate } = ReactRouterDOM as any;

const NotFound: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                <div className="mb-8 relative inline-block">
                    {/* Animated Circles */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary-100 dark:bg-primary-900/20 rounded-full animate-ping opacity-75"></div>
                    <div className="relative z-10 w-24 h-24 bg-white dark:bg-slate-800 rounded-full shadow-xl flex items-center justify-center mx-auto border border-primary-100 dark:border-primary-900/50">
                        <Search className="w-12 h-12 text-primary-600 dark:text-primary-400" />
                    </div>
                </div>

                <h1 className="text-6xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">404</h1>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Không tìm thấy trang</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    Có vẻ như đường dẫn bạn truy cập không tồn tại hoặc đã được chuyển hướng.
                    Vui lòng kiểm tra lại URL hoặc quay về trang chủ.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <ArrowLeft size={18} />
                        Quay lại
                    </button>
                    <Link
                        to="/"
                        className="px-6 py-3 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/20 transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                        <Home size={18} />
                        Về Trang chủ
                    </Link>
                </div>

                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 uppercase tracking-widest font-bold">
                    VinFast CRM Enterprise
                </div>
            </div>
        </div>
    );
};

export default NotFound;
