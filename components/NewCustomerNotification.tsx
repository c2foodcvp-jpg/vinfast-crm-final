import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { User, X, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Customer {
    id: string;
    name: string;
    sales_rep?: string;
}

interface NotificationItem {
    id: string;
    customer: Customer;
    visible: boolean;
}

const NewCustomerNotification: React.FC = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        if (!userProfile) return;

        const channel = supabase
            .channel('public:customers_ui')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'customers',
                    // Filter: Only for me (Creator OR Sales Rep)
                    filter: `sales_rep=eq.${userProfile.full_name}`
                },
                (payload) => {
                    const newCustomer = payload.new as Customer;

                    // Add to state
                    const notifId = Math.random().toString(36).substr(2, 9);
                    setNotifications(prev => [...prev, { id: notifId, customer: newCustomer, visible: true }]);

                    // Play Sound
                    try {
                        const audio = new Audio('/notification.mp3'); // Ensure this file exists or use a base64 string
                        audio.play().catch(e => console.log('Audio play failed', e));
                    } catch (e) { }

                    // Auto hide after 5s
                    setTimeout(() => {
                        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, visible: false } : n));
                    }, 5000);

                    // Remove from DOM after 6s
                    setTimeout(() => {
                        setNotifications(prev => prev.filter(n => n.id !== notifId));
                    }, 6000);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userProfile]);

    if (notifications.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
            {notifications.map(n => (
                <div
                    key={n.id}
                    onClick={() => navigate('/customers')}
                    className={`
                        pointer-events-auto cursor-pointer
                        transform transition-all duration-500 ease-in-out
                        ${n.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
                        bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-blue-100 dark:border-slate-700
                        p-4 w-80 flex items-start gap-4 relative overflow-hidden
                    `}
                >
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full -mr-4 -mt-4"></div>

                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-sm border border-blue-100 dark:border-blue-900/50">
                        <User className="animate-bounce" size={24} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 z-10">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                <Bell size={10} /> Khách mới
                            </span>
                            <span className="text-[10px] text-slate-400">Vừa xong</span>
                        </div>
                        <h4 className="font-bold text-slate-900 dark:text-white truncate text-base leading-tight mb-1">
                            {n.customer.name}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
                            Vừa được phân bổ cho bạn. Nhấn để xem chi tiết.
                        </p>
                    </div>

                    {/* Close Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setNotifications(prev => prev.filter(item => item.id !== n.id));
                        }}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default NewCustomerNotification;
