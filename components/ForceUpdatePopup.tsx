import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const VERSION_KEY = 'vinfast_updated_version';

const ForceUpdatePopup: React.FC = () => {
    const [showPopup, setShowPopup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Check if user is logged in
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsLoggedIn(!!session);
        };
        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsLoggedIn(!!session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Check force_update setting and version
    useEffect(() => {
        if (!isLoggedIn) {
            setShowPopup(false);
            return;
        }

        const checkForceUpdate = async () => {
            try {
                // 1. Check if force_update is enabled
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'force_update')
                    .maybeSingle();

                const forceUpdateEnabled = data?.value === 'true' || data?.value === true;

                if (!forceUpdateEnabled) {
                    setShowPopup(false);
                    return;
                }

                // 2. Get current version from version.json
                const versionRes = await fetch(`/version.json?t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });

                if (!versionRes.ok) {
                    // Can't check version, show popup to be safe
                    setShowPopup(true);
                    return;
                }

                const versionData = await versionRes.json();
                const currentBuildTime = versionData.buildTime;

                // 3. Check user's last updated version from localStorage
                const savedBuildTime = localStorage.getItem(VERSION_KEY);

                // 4. If user already has latest version, don't show popup
                if (savedBuildTime && Number(savedBuildTime) >= currentBuildTime) {
                    console.log('User already on latest version:', savedBuildTime);
                    setShowPopup(false);
                    return;
                }

                // 5. User is on old version, show popup
                setShowPopup(true);

            } catch (e) {
                console.error('Error checking force update:', e);
            }
        };

        checkForceUpdate();

        // Re-check every 30 seconds
        const interval = setInterval(checkForceUpdate, 30000);
        return () => clearInterval(interval);
    }, [isLoggedIn]);

    const handleUpdate = async () => {
        setLoading(true);

        try {
            // Get and save current version before reload
            const versionRes = await fetch(`/version.json?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });

            if (versionRes.ok) {
                const versionData = await versionRes.json();
                localStorage.setItem(VERSION_KEY, String(versionData.buildTime));
                console.log('Saved version:', versionData.buildTime);
            }
        } catch (e) {
            console.error('Error saving version:', e);
        }

        // Clear caches
        if ('caches' in window) {
            caches.keys().then((names) => {
                names.forEach((name) => {
                    caches.delete(name);
                });
            });
        }

        // Force reload
        window.location.reload();
    };

    if (!showPopup || !isLoggedIn) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 animate-fade-in">
                <div className="flex justify-center mb-6">
                    <div className="bg-orange-100 p-4 rounded-full">
                        <AlertTriangle size={48} className="text-orange-500" />
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">
                    Cập nhật phiên bản mới
                </h2>

                <p className="text-gray-600 text-center mb-8 leading-relaxed">
                    Bạn đang sử dụng phiên bản cũ.<br />
                    Vui lòng cập nhật để tiếp tục sử dụng hệ thống.
                </p>

                <button
                    onClick={handleUpdate}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-3 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <RefreshCw size={20} className="animate-spin" />
                            Đang cập nhật...
                        </>
                    ) : (
                        <>
                            <RefreshCw size={20} />
                            Đồng ý cập nhật
                        </>
                    )}
                </button>

                <p className="text-xs text-gray-400 text-center mt-4">
                    Trang sẽ được tải lại sau khi bạn nhấn đồng ý
                </p>
            </div>
        </div>
    );
};

export default ForceUpdatePopup;
