
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Customer, CustomerStatus } from '../types';
import {
    Bell, X, UserCheck, ChevronRight, Phone, Car, MapPin,
    ExternalLink, CheckCircle2, Loader2
} from 'lucide-react';

interface PendingCustomer extends Customer {
    // Extended for display
}

const NewCustomerNotification: React.FC = () => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const navigate = useNavigate();

    const [pendingCustomers, setPendingCustomers] = useState<PendingCustomer[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isAcknowledging, setIsAcknowledging] = useState<string | null>(null);
    const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());

    // Fetch pending customers for current user
    const fetchPendingCustomers = async () => {
        if (!userProfile?.id) return;

        try {
            // For regular employees: fetch their unacknowledged customers
            // For Admin/MOD: don't show this popup (they see in Dashboard)
            if (isAdmin || isMod) {
                setPendingCustomers([]);
                return;
            }

            const { data, error } = await supabase
                .from('customers')
                .select('id, name, phone, interest, location, source, created_at')
                .eq('creator_id', userProfile.id)
                .eq('status', CustomerStatus.NEW)
                .eq('is_acknowledged', false)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            if (data && data.length > 0) {
                setPendingCustomers(data as PendingCustomer[]);
                setIsOpen(true);
            } else {
                setPendingCustomers([]);
            }
        } catch (e) {
            console.error('Error fetching pending customers:', e);
        }
    };

    // Initial fetch + polling every 30 seconds
    useEffect(() => {
        fetchPendingCustomers();

        const interval = setInterval(() => {
            fetchPendingCustomers();
            setLastCheckTime(new Date());
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [userProfile?.id]);

    // Subscribe to realtime changes
    useEffect(() => {
        if (!userProfile?.id || isAdmin || isMod) return;

        const channel = supabase
            .channel('new-customer-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'customers',
                    filter: `creator_id=eq.${userProfile.id}`
                },
                (payload) => {
                    // If a customer was just assigned to this user with is_acknowledged = false
                    if (payload.new && payload.new.is_acknowledged === false) {
                        fetchPendingCustomers();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userProfile?.id]);

    // Acknowledge a single customer
    const handleAcknowledge = async (customerId: string) => {
        setIsAcknowledging(customerId);
        try {
            await supabase
                .from('customers')
                .update({ is_acknowledged: true })
                .eq('id', customerId);

            // Add interaction note
            await supabase.from('interactions').insert({
                customer_id: customerId,
                user_id: userProfile?.id,
                type: 'note',
                content: 'Đã tiếp nhận khách hàng từ thông báo popup.',
                created_at: new Date().toISOString()
            });

            // Remove from list
            setPendingCustomers(prev => prev.filter(c => c.id !== customerId));

            // If no more pending, close popup
            if (pendingCustomers.length <= 1) {
                setIsOpen(false);
            }
        } catch (e) {
            console.error('Error acknowledging customer:', e);
        } finally {
            setIsAcknowledging(null);
        }
    };

    // Acknowledge all at once
    const handleAcknowledgeAll = async () => {
        if (pendingCustomers.length === 0) return;

        setIsAcknowledging('all');
        try {
            const ids = pendingCustomers.map(c => c.id);

            await supabase
                .from('customers')
                .update({ is_acknowledged: true })
                .in('id', ids);

            // Add interaction notes
            const notes = ids.map(id => ({
                customer_id: id,
                user_id: userProfile?.id,
                type: 'note',
                content: 'Đã tiếp nhận khách hàng từ thông báo popup.',
                created_at: new Date().toISOString()
            }));

            await supabase.from('interactions').insert(notes);

            setPendingCustomers([]);
            setIsOpen(false);
        } catch (e) {
            console.error('Error acknowledging all:', e);
        } finally {
            setIsAcknowledging(null);
        }
    };

    // Don't render if no pending customers or user is Admin/MOD
    if (pendingCustomers.length === 0 || isAdmin || isMod) {
        return null;
    }

    return (
        <>
            {/* Floating Bell Icon (when popup is closed) */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform animate-bounce"
                >
                    <div className="relative">
                        <Bell size={24} />
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                            {pendingCustomers.length}
                        </span>
                    </div>
                </button>
            )}

            {/* Popup Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 bg-black/60 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all animate-slide-up max-h-[85vh] flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-xl">
                                        <Bell size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">Khách hàng mới!</h3>
                                        <p className="text-sm text-green-100">Bạn có {pendingCustomers.length} khách cần tiếp nhận</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Customer List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {pendingCustomers.map((customer) => (
                                <div
                                    key={customer.id}
                                    className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-green-200 transition-colors"
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-900 truncate">{customer.name}</h4>
                                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-600">
                                                {customer.interest && (
                                                    <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                                        <Car size={12} /> {customer.interest}
                                                    </span>
                                                )}
                                                {customer.location && (
                                                    <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                                        <MapPin size={12} /> {customer.location}
                                                    </span>
                                                )}
                                                {customer.source && (
                                                    <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                                        {customer.source}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2">
                                                {new Date(customer.created_at).toLocaleString('vi-VN')}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-2 shrink-0">
                                            <button
                                                onClick={() => handleAcknowledge(customer.id)}
                                                disabled={isAcknowledging === customer.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {isAcknowledging === customer.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <UserCheck size={14} />
                                                )}
                                                Tiếp nhận
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    navigate(`/customers/${customer.id}`);
                                                }}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                                            >
                                                <ExternalLink size={14} /> Chi tiết
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex-1 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-colors"
                            >
                                Để sau
                            </button>
                            <button
                                onClick={handleAcknowledgeAll}
                                disabled={isAcknowledging === 'all'}
                                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isAcknowledging === 'all' ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <CheckCircle2 size={18} />
                                )}
                                Tiếp nhận tất cả
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NewCustomerNotification;
