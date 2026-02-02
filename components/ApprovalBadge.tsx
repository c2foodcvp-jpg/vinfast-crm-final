import React, { useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import ApprovalModal from './ApprovalModal';

interface ApprovalBadgeProps {
    className?: string;
    iconSize?: number;
}

const ApprovalBadge: React.FC<ApprovalBadgeProps> = ({ className, iconSize = 20 }) => {
    const { userProfile, isAdmin, isMod } = useAuth();
    const [count, setCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const fetchCount = async () => {
        if (!isAdmin && !isMod) return;

        try {
            // Determine Team Scope
            let teamIds: string[] = [];
            if (isMod && userProfile) {
                // Mod sees Self + Subordinates
                const { data } = await supabase.from('profiles').select('id')
                    .or(`id.eq.${userProfile.id},manager_id.eq.${userProfile.id}`);
                if (data) teamIds = data.map(p => p.id);
            }

            // Count Customers
            // 'status.eq.Chờ duyệt chốt,status.eq.Chờ duyệt hủy...'
            let cQuery = supabase.from('customers').select('*', { count: 'exact', head: true })
                .or('status.eq.Chờ duyệt chốt,status.eq.Chờ duyệt hủy,deal_status.eq.completed_pending,deal_status.eq.suspended_pending,deal_status.eq.refund_pending,pending_transfer_to.not.is.null');

            // Count Transactions
            let tQuery = supabase.from('transactions').select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // APPLY TEAM FILTER (For Mods)
            if (!isAdmin && isMod && teamIds.length > 0) {
                cQuery = cQuery.in('creator_id', teamIds);
                tQuery = tQuery.in('user_id', teamIds);
            }

            const [cRes, tRes] = await Promise.all([cQuery, tQuery]);

            let total = (cRes.count || 0) + (tRes.count || 0);

            setCount(total);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchCount();
        const interval = setInterval(fetchCount, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [userProfile]);

    // Listen for custom trigger to refresh count (e.g., after approval)
    useEffect(() => {
        if (!isOpen) fetchCount();
    }, [isOpen]);

    if (!isAdmin && !isMod) return null;
    if (count === 0) return null;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`relative p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg group ${className || ''}`}
                title="Trung tâm phê duyệt"
            >
                <Gavel size={iconSize} className="group-hover:text-primary-600 transition-colors" />
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-800 animate-pulse">
                    {count > 99 ? '99+' : count}
                </span>
            </button>
            <ApprovalModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default ApprovalBadge;
