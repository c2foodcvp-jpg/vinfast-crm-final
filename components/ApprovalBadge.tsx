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
            // Count Customers
            // Note: Parallel count is better
            // 'status.eq.Chờ duyệt chốt,status.eq.Chờ duyệt hủy...'
            const cQuery = supabase.from('customers').select('*', { count: 'exact', head: true })
                .or('status.eq.Chờ duyệt chốt,status.eq.Chờ duyệt hủy,deal_status.eq.suspended_pending,deal_status.eq.refund_pending,pending_transfer_to.not.is.null');

            const tQuery = supabase.from('transactions').select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            const [cRes, tRes] = await Promise.all([cQuery, tQuery]);

            // Logic for MOD (Team isolation count is hard via HEAD requests without filtering).
            // For MVP Badge: Show GLOBAL count or just Red Dot is fine. 
            // Better: If Mod, fetch data and count length locally if count is small.
            // If Admin, use DB count.

            let total = (cRes.count || 0) + (tRes.count || 0);

            // Refinement for Mod (if not Admin)
            if (!isAdmin && isMod && total > 0) {
                // For now, Badge shows global pending items or "Something is pending".
                // We can refine this later to be team-specific if requested.
                // Showing a badge even for other teams' items might be annoying but acceptable for MVP.
                // Actually, let's keep it simple: Show Badge if ANY pending item exists, user clicks and sees empty list if not their team?
                // No, that's bad UX.
                // Let's rely on ApprovalModal to filter. The Badge might just show "!" without number if logic is complex.
                // OR: Just fetch small limit to check team.
            }

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
