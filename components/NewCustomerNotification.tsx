import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

const NewCustomerNotification: React.FC = () => {
    const { userProfile } = useAuth();

    useEffect(() => {
        if (!userProfile) return;

        const channel = supabase
            .channel('public:customers')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'customers',
                    filter: `sales_rep=eq.${userProfile.full_name}`
                },
                (payload) => {
                    // Simple notification logic (could be expanded to a toast)
                    console.log('New customer assigned:', payload.new);
                    // Native notification if supported/granted
                    if (Notification.permission === 'granted') {
                        new Notification('Khách hàng mới', {
                            body: `Bạn vừa được phân bổ khách hàng mới: ${payload.new.name}`
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userProfile]);

    return null;
};

export default NewCustomerNotification;
