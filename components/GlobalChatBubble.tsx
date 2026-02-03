import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { MessageCircle, X, ExternalLink, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatSidebarContent from './community/ChatSidebar';
import ChatWindow from './community/ChatWindow';

const GlobalChatBubble: React.FC = () => {
    const { unreadCount, activeChannel } = useChat();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [view, setView] = useState<'list' | 'chat'>('list');

    // Drag State
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const hasMovedRef = useRef(false);

    // Update position on resize to keep in view if needed (optional, simplified for now)

    // Config: Hide on these pages
    const hiddenPaths = ['/login', '/register', '/update-password', '/intro'];
    const shouldHide = hiddenPaths.includes(location.pathname);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        hasMovedRef.current = false;
        dragStartRef.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        hasMovedRef.current = false;
        const touch = e.touches[0];
        dragStartRef.current = {
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !dragStartRef.current) return;

            e.preventDefault();
            hasMovedRef.current = true;

            const newX = e.clientX - dragStartRef.current.x;
            const newY = e.clientY - dragStartRef.current.y;

            // Boundaries
            const maxX = window.innerWidth - 60;
            const maxY = window.innerHeight - 60;

            setPosition({
                x: Math.min(Math.max(0, newX), maxX),
                y: Math.min(Math.max(0, newY), maxY)
            });
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging || !dragStartRef.current) return;

            // e.preventDefault(); // Might block scrolling if not careful, but needed for drag
            hasMovedRef.current = true;
            const touch = e.touches[0];

            const newX = touch.clientX - dragStartRef.current.x;
            const newY = touch.clientY - dragStartRef.current.y;

            const maxX = window.innerWidth - 60;
            const maxY = window.innerHeight - 60;

            setPosition({
                x: Math.min(Math.max(0, newX), maxX),
                y: Math.min(Math.max(0, newY), maxY)
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging]);

    const handleClick = () => {
        if (!hasMovedRef.current) {
            setIsOpen(!isOpen);
            if (!isOpen) setView(activeChannel ? 'chat' : 'list');
        }
    };

    const handleFullPage = () => {
        navigate('/community');
        setIsOpen(false);
    };

    // Better calculation:
    // Bubble is at left: position.x, top: position.y
    // Bubble size ~ 60px
    // Popover size ~ w-96 (384px) x h-[500px]

    // Default: Open Above
    let popBottom = window.innerHeight - position.y + 10;
    let popLeft = position.x - 384 + 60; // Align right

    // If dragging moves it, we use these coords
    const bubbleStyle: React.CSSProperties = {
        left: position.x,
        top: position.y,
        transition: isDragging ? 'none' : 'all 0.3s ease-out' // Smooth snap if released? No, just smooth when not dragging
    };

    // Adjust popover if offscreen
    if (popLeft < 10) popLeft = 10; // Keep 10px from left
    if (popBottom + 500 > window.innerHeight) {
        // If top clips, maybe move it down? 
        // For now assume user won't drag bubble to very top-left to open chat.
    }

    if (shouldHide) return null;

    return (
        <>
            {/* Floating Bubble */}
            <button
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onClick={handleClick}
                style={bubbleStyle}
                className={`fixed z-[9999] p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-move flex items-center justify-center ${isOpen ? 'bg-red-500 rotate-90 shadow-red-200' : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-200 hover:shadow-blue-300'
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
                <div
                    style={{ left: popLeft, bottom: popBottom }}
                    className="fixed w-96 max-w-[calc(100vw-24px)] h-[500px] max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[9999] flex flex-col overflow-hidden border border-gray-200 animate-in slide-in-from-bottom-2 duration-200"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 bg-blue-600 text-white shrink-0 cursor-default">
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
