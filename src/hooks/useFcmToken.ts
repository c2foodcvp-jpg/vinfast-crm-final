import { useEffect, useState } from 'react';
import { requestForToken, onMessageListener } from '../lib/firebase';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';

const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission>('default');

    useEffect(() => {
        const retrieveToken = async () => {
            try {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                    if (notificationPermissionStatus === 'granted') {
                        const fcmToken = await requestForToken(); // Renamed to avoid conflict with state `token`
                        if (fcmToken) {
                            setToken(fcmToken);

                            // Save token to Supabase
                            const { error } = await supabase
                                .from('user_devices')
                                .upsert({
                                    user_id: (await supabase.auth.getUser()).data.user?.id,
                                    fcm_token: fcmToken,
                                    device_type: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'web',
                                    last_active: new Date().toISOString()
                                }, { onConflict: 'user_id,fcm_token' });

                            if (error) console.error("Error saving FCM token:", error);
                            else console.log("FCM Token saved to Supabase");
                        }
                    }
                }
            } catch (error) {
                console.error("Error retrieving token:", error);
            }
        };
        retrieveToken();
    }, [notificationPermissionStatus]);

    useEffect(() => {
        onMessageListener().then((payload: any) => {
            console.log('Foreground Message:', payload);
            toast.success(payload?.notification?.title + ': ' + payload?.notification?.body);
        }).catch(err => console.log('failed: ', err));
    }, []);

    return { token, notificationPermissionStatus, setNotificationPermissionStatus };
};

export default useFcmToken;
