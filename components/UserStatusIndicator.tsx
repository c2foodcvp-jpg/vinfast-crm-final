
import React from 'react';
import { usePresence, UserStatus } from '../contexts/PresenceContext';

interface UserStatusIndicatorProps {
    userId: string;
    showText?: boolean;
    className?: string;
}

const UserStatusIndicator: React.FC<UserStatusIndicatorProps> = ({ userId, showText = false, className = '' }) => {
    const { onlineUsers } = usePresence();

    // If user is in the map, they are online or idle. If not, they are offline.
    const userPresence = onlineUsers[userId];
    const status: UserStatus = userPresence ? userPresence.status : 'offline';

    let colorClass = 'bg-gray-400'; // Offline
    let title = 'Ngoại tuyến';

    if (status === 'online') {
        // Green like the image
        colorClass = 'bg-[#10B981]'; // Emerald 500
        title = 'Đang hoạt động';
    } else if (status === 'idle') {
        colorClass = 'bg-amber-400'; // Amber/Orange
        title = 'Treo máy (Idle)';
    }

    return (
        <div className={`flex items-center gap-1.5 ${className}`} title={title}>
            <span className="relative flex h-3 w-3 items-center justify-center">
                {status === 'online' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                {status === 'idle' && (
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorClass} border-2 border-white dark:border-slate-800 shadow-sm`}></span>
            </span>
            {showText && <span className="text-xs text-gray-500">{title}</span>}
        </div>
    );
};

export default UserStatusIndicator;
