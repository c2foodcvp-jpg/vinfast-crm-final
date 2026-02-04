import { useEffect, useState } from 'react';
import { requestForToken, onMessageListener } from '../lib/firebase';
import { supabase } from '@/supabaseClient';
import toast from 'react-hot-toast';

const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission>('default');

    const retrieveToken = async () => {
        try {
            if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                const fcmToken = await requestForToken();
                if (fcmToken) {
                    setToken(fcmToken);

                    // Save token to Supabase
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { error } = await supabase
                            .from('user_devices')
                            .upsert({
                                user_id: user.id,
                                fcm_token: fcmToken,
                                device_type: /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'web',
                                last_active: new Date().toISOString()
                            }, { onConflict: 'user_id,fcm_token' });

                        if (error) console.error("Error saving FCM token:", error);
                    }
                }
            }
        } catch (error) {
            console.error("Error retrieving token:", error);
        }
    };

    const requestPermission = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) return;

        try {
            const permission = await Notification.requestPermission();
            setNotificationPermissionStatus(permission);
            if (permission === 'granted') {
                await retrieveToken();
                toast.success('Đã bật thông báo!');
            }
        } catch (err) {
            console.error('Error requesting permission:', err);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermissionStatus(Notification.permission);
            if (Notification.permission === 'granted') {
                retrieveToken();
            }
        }
    }, []);

    useEffect(() => {
        onMessageListener().then((payload: any) => {
            console.log('Foreground Message:', payload);
            toast.success(payload?.notification?.title || 'New Message');
        }).catch(err => console.log('failed: ', err));
    }, []);

    return { token, notificationPermissionStatus, requestPermission };
};

export default useFcmToken;
