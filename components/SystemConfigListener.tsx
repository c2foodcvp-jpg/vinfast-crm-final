import React, { useEffect } from 'react';
import { supabase } from '../supabaseClient';

const SystemConfigListener: React.FC = () => {
    useEffect(() => {
        const updateFavicon = (url: string) => {
            const link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = url;
            document.getElementsByTagName('head')[0].appendChild(link);
        };

        const fetchConfig = async () => {
            try {
                const { data } = await supabase.from('app_settings').select('value').eq('key', 'system_favicon').maybeSingle();
                if (data && data.value) {
                    updateFavicon(data.value);
                }
            } catch (error) {
                console.error("Error fetching system favicon", error);
            }
        };

        fetchConfig();

        // Realtime subscription
        const channel = supabase.channel('system_config_chn')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.system_favicon' },
                (payload) => {
                    if (payload.new && (payload.new as any).value) {
                        updateFavicon((payload.new as any).value);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return null; // Headless component
};

export default SystemConfigListener;
