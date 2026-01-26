
import { useState, useEffect, useCallback } from 'react';

export interface VersionInfo {
    version: string;
    buildTime: number;
}

export const useVersionCheck = (autoCheckInterval = 60 * 1000) => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const checkVersion = useCallback(async (manual = false) => {
        setIsChecking(true);
        try {
            // Add timestamp to query to bypass browser cache
            // Add headers to bypass CDN cache
            const res = await fetch(`/version.json?t=${new Date().getTime()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            });

            if (res.ok) {
                const data: VersionInfo = await res.json();
                setLastChecked(new Date());

                setCurrentVersion(prev => {
                    // Initial load
                    if (!prev) {
                        return data;
                    }

                    // Check if new build time is greater than current stored time
                    if (data.buildTime > prev.buildTime) {
                        console.log(`New version detected! Current: ${prev.buildTime}, New: ${data.buildTime}`);
                        setHasUpdate(true);
                    } else if (manual) {
                        console.log('Manual check: You are on the latest version.');
                    }

                    return prev; // Keep the initial version as "current" reference to compare against
                });

                return data;
            }
        } catch (error) {
            console.error('Version check failed:', error);
        } finally {
            setIsChecking(false);
        }
        return null;
    }, []);

    useEffect(() => {
        // Initial check
        checkVersion();

        if (autoCheckInterval > 0) {
            const interval = setInterval(() => {
                // Don't check if tab is hidden to save resources
                if (!document.hidden) {
                    checkVersion();
                }
            }, autoCheckInterval);
            return () => clearInterval(interval);
        }
    }, [autoCheckInterval, checkVersion]);

    const reload = () => {
        if ('caches' in window) {
            // Optional: Clear caches
            caches.keys().then((names) => {
                names.forEach((name) => {
                    caches.delete(name);
                });
            });
        }
        window.location.reload();
    };

    return {
        hasUpdate,
        isChecking,
        lastChecked,
        currentVersion, // This is the version loaded when the app started
        checkVersion,
        reload
    };
};
