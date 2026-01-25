
import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

const CHECK_INTERVAL = 60 * 1000; // Check every 1 minute (for testing/demo), can be increased to 5-10 mins in prod

interface VersionData {
    version: string;
    buildTime: number;
}

const VersionChecker: React.FC = () => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [localBuildTime, setLocalBuildTime] = useState<number | null>(null);

    useEffect(() => {
        // Initial check to set base version
        const fetchInitialVersion = async () => {
            try {
                const res = await fetch('/version.json?t=' + new Date().getTime());
                if (res.ok) {
                    const data: VersionData = await res.json();
                    setLocalBuildTime(data.buildTime);
                    console.log('Current Build Time:', data.buildTime);
                }
            } catch (error) {
                console.error('Failed to fetch version info:', error);
            }
        };

        fetchInitialVersion();

        const interval = setInterval(async () => {
            if (document.hidden) return; // Don't check if tab is inactive

            try {
                // Cache-busting to ensure we get the latest file
                const res = await fetch('/version.json?t=' + new Date().getTime());
                if (res.ok) {
                    const data: VersionData = await res.json();

                    setLocalBuildTime(prevTime => {
                        // Only update if we have a previous time and it's different
                        if (prevTime !== null && data.buildTime > prevTime) {
                            console.log('New version detected!', data.buildTime);
                            setHasUpdate(true);
                        }
                        return prevTime; // Keep original time as reference
                    });
                }
            } catch (error) {
                console.error('Version check failed:', error);
            }
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, []);

    const handleReload = () => {
        // Hard reload ensuring cache is cleared
        window.location.reload();
    };

    if (!hasUpdate) return null;

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
                        onClick={() => setHasUpdate(false)}
                        className="text-white/60 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <button
                    onClick={handleReload}
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
