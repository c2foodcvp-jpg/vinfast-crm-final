
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { CheckCircle2, XCircle, X, Info } from 'lucide-react';

// --- Types ---
type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
}

interface NotificationContextType {
  addNotification: (title: string, message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// --- Component hiển thị Toast ---
const ToastContainer: React.FC<{ notifications: Notification[]; remove: (id: string) => void }> = ({ notifications, remove }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`pointer-events-auto min-w-[320px] max-w-sm rounded-xl shadow-lg border p-4 flex items-start gap-3 transform transition-all duration-300 animate-fade-in ${notif.type === 'success' ? 'bg-white border-green-200 text-green-800' :
            notif.type === 'error' ? 'bg-white border-red-200 text-red-800' :
              'bg-white border-blue-200 text-blue-800'
            }`}
        >
          <div className={`mt-0.5 p-1 rounded-full shrink-0 ${notif.type === 'success' ? 'bg-green-100 text-green-600' :
            notif.type === 'error' ? 'bg-red-100 text-red-600' :
              'bg-blue-100 text-blue-600'
            }`}>
            {notif.type === 'success' ? <CheckCircle2 size={18} /> :
              notif.type === 'error' ? <XCircle size={18} /> :
                <Info size={18} />}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-sm">{notif.title}</h4>
            <p className="text-xs mt-1 opacity-90 leading-relaxed">{notif.message}</p>
            <p className="text-[10px] mt-2 opacity-60 uppercase font-semibold">Vừa xong</p>
          </div>
          <button onClick={() => remove(notif.id)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

// --- Provider ---
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Sound effect ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload a simple notification sound (Data URI for efficiency)
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.volume = 0.5;
    audioRef.current = audio;
  }, []);

  const playSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn("Audio play blocked", e));
    }
  };

  const addNotification = (title: string, message: string, type: NotificationType = 'info') => {
    const id = Date.now().toString();
    const newNotif = { id, type, title, message, timestamp: Date.now() };

    setNotifications((prev) => [newNotif, ...prev]);
    playSound();

    // Auto remove after 6 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // --- REALTIME SUBSCRIPTION LOGIC ---
  useEffect(() => {
    if (!userProfile) return;

    const channel = supabase.channel('realtime_notifications')
      // 1. Listen to Transactions (Advance, Expense, etc.)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transactions' },
        (payload) => {
          const newData = payload.new;
          const oldData = payload.old;

          // Check if this transaction belongs to the current user
          if (newData.user_id !== userProfile.id) return;

          // Check if status changed from pending
          if (oldData.status === 'pending' && newData.status !== 'pending') {
            const type = newData.status === 'approved' ? 'success' : 'error';
            const title = newData.status === 'approved' ? 'Yêu cầu được Duyệt' : 'Yêu cầu bị Từ chối';
            const reasonSnippet = newData.reason ? `"${newData.reason.substring(0, 20)}..."` : 'giao dịch';
            const msg = `Yêu cầu tài chính ${reasonSnippet} của bạn đã được ${newData.status === 'approved' ? 'duyệt' : 'từ chối'}.`;

            addNotification(title, msg, type);
          }
        }
      )
      // 2. Listen to Proposals (Salary Advance, Demo Car)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'proposals' },
        (payload) => {
          const newData = payload.new;
          const oldData = payload.old;

          if (newData.user_id !== userProfile.id) return;

          if (oldData.status === 'pending' && newData.status !== 'pending') {
            const type = newData.status === 'approved' ? 'success' : 'error';
            const proposalType = newData.type === 'salary_advance' ? 'ứng lương' : 'mượn xe Demo';
            const title = newData.status === 'approved' ? 'Đề xuất được Duyệt' : 'Đề xuất bị Từ chối';
            const msg = `Đề xuất ${proposalType} với số tiền ${Number(newData.amount).toLocaleString('vi-VN')} VNĐ đã có kết quả.`;

            addNotification(title, msg, type);
          }
        }
      )
      // 3. Listen to Team Fund Expenses
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_fund_expenses' },
        (payload) => {
          const newData = payload.new;
          const oldData = payload.old;

          // 'created_by' is the column name in this table
          if (newData.created_by !== userProfile.id) return;

          if (oldData.status === 'pending' && newData.status !== 'pending') {
            const type = newData.status === 'approved' ? 'success' : 'error';
            const title = newData.status === 'approved' ? 'Chi Quỹ được Duyệt' : 'Chi Quỹ bị Từ chối';
            const msg = `Yêu cầu chi quỹ "${newData.reason}" đã được xử lý.`;

            addNotification(title, msg, type);
          }
        }
      )
      .subscribe();

    // 4. Centralized System Notifications (Chat, Finance, Leads...)
    const systemChannel = supabase.channel('system_notifications_channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_notifications' },
        (payload) => {
          const newNotif = payload.new;
          // Check if targeted
          if (newNotif.target_user_ids && newNotif.target_user_ids.includes(userProfile.id)) {
            let type: NotificationType = 'info';
            if (newNotif.type.includes('error') || newNotif.type.includes('rejected')) type = 'error';
            else if (newNotif.title.toLowerCase().includes('duyệt') || newNotif.type.includes('approved') || newNotif.type.includes('success')) type = 'success';

            addNotification(newNotif.title, newNotif.content, type);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(systemChannel);
    };
  }, [userProfile]);

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      <ToastContainer notifications={notifications} remove={removeNotification} />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

