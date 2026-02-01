import React, { useState } from 'react';
import ChatSidebar from '../components/community/ChatSidebar';
import ChatWindow from '../components/community/ChatWindow';
import { Menu } from 'lucide-react';

const Community: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="flex bg-gray-100 h-[calc(100vh-64px)] overflow-hidden">
            {/* Sidebar - Hidden on Mobile unless open */}
            <div className={`fixed inset-y-0 left-0 z-40 w-80 bg-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <ChatSidebar onMobileClose={() => setMobileMenuOpen(false)} />
            </div>

            {/* Overlay for mobile */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                ></div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white h-full relative">
                <div className="md:hidden absolute top-4 left-4 z-20">
                    <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-white rounded-full shadow-md text-gray-700">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
                <ChatWindow />
            </div>
        </div>
    );
};

export default Community;
