import React, { useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import { MessageCircle, X, ExternalLink, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatSidebarContent from './community/ChatSidebar';
import ChatWindow from './community/ChatWindow';

const GlobalChatBubble: React.FC = () => {
    const { unreadCount, activeChannel, setActiveChannel } = useChat();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [view, setView] = useState<'list' | 'chat'>('list');

    // Config: Hide on these pages
    const hiddenPaths = ['/login', '/register', '/update-password', '/intro'];
    if (hiddenPaths.includes(location.pathname)) return null;

    // Sync view only if needed? 
    // If activeChannel changes externally, we might want to switch to chat view?
    // Let's keep it simple: manual navigation.

    const handleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setView(activeChannel ? 'chat' : 'list');
    };

    const handleFullPage = () => {
        navigate('/community');
        setIsOpen(false);
    };

    return (
        <>
            {/* Floating Bubble */}
            <button
                onClick={handleOpen}
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center ${isOpen ? 'bg-red-500 rotate-90 shadow-red-200' : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-200 hover:shadow-blue-300'
                    }`}
            >
                {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white animate-pulse-slow" />}
                {!isOpen && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Chat Popover */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200 animate-in slide-in-from-bottom-5 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 bg-blue-600 text-white shrink-0">
                        <div className="flex items-center gap-2">
                            {view === 'chat' && (
                                <button onClick={() => setView('list')} className="hover:bg-blue-700 p-1 rounded">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            <span className="font-semibold text-sm">
                                {view === 'chat' && activeChannel ? activeChannel.name || 'Chat' : 'Cộng đồng VinFast'}
                            </span>
                        </div>
                        <button onClick={handleFullPage} className="p-1.5 hover:bg-blue-700 rounded text-blue-100" title="Mở toàn màn hình">
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden relative">
                        {view === 'list' ? (
                            <div className="h-full overflow-y-auto">
                                {/* Reuse Sidebar logic but stripped down? We can reuse the component but styling might clash if fixed width */}
                                {/* We can temporarily clear generic container styles via parent div */}
                                <ChatSidebarContent
                                    onMobileClose={() => setView('chat')} // When channel selected, switch view
                                />
                            </div>
                        ) : (
                            <ChatWindow />
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default GlobalChatBubble;
