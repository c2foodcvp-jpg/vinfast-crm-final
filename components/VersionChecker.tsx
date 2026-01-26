
import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useVersionCheck } from '../src/hooks/useVersionCheck';

const VersionChecker: React.FC = () => {
    // Check every minute
    const { hasUpdate, reload } = useVersionCheck(60 * 1000);
    const [dismissed, setDismissed] = React.useState(false);

    if (!hasUpdate || dismissed) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-fade-in-up">
            <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-2xl border-2 border-white/20 flex flex-col gap-3 max-w-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-lg flex items-center gap-2">
                            <RefreshCw className="animate-spin-slow" size={20} />
                            Cập nhật mới!
                        </h4>
                        <p className="text-sm text-blue-100 mt-1">
                            Hệ thống đã có phiên bản mới. Vui lòng tải lại để sử dụng tính năng mới nhất.
                        </p>
                    </div>
                    <button
                        onClick={() => setDismissed(true)}
                        className="text-white/60 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <button
                    onClick={reload}
                    className="w-full py-2.5 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                    <RefreshCw size={16} />
                    Tải lại trang ngay
                </button>
            </div>
        </div>
    );
};

export default VersionChecker;
