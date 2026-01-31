import React from 'react';
import { X, Mic, Check } from 'lucide-react';

interface VoiceRecordingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    transcript: string;
    isListening: boolean;
}

const VoiceStyles = React.memo(() => (
    <style>
        {`
        @keyframes bounce-wave {
            0%, 100% { height: 10px; }
            50% { height: 30px; }
        }
        .animate-wave {
            animation: bounce-wave 1s ease-in-out infinite;
        }
        `}
    </style>
));

const VoiceRecordingModal: React.FC<VoiceRecordingModalProps> = ({ isOpen, onClose, onConfirm, transcript, isListening }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 animate-fade-in p-4">
            <VoiceStyles />
            <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-zoom-in">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>

                <div className="flex flex-col items-center mt-4">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all ${isListening ? 'bg-red-50 text-red-600 shadow-[0_0_0_8px_rgba(254,202,202,0.4)]' : 'bg-gray-100 text-gray-400'}`}>
                        <Mic size={40} className={isListening ? 'animate-pulse' : ''} />
                    </div>

                    {/* Wave Animation */}
                    <div className="flex items-center justify-center gap-1.5 h-10 mb-6">
                        {isListening ? (
                            [...Array(7)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 bg-gradient-to-t from-red-400 to-red-600 rounded-full animate-wave shadow-sm"
                                    style={{ animationDelay: `${i * 0.1}s`, height: '10px' }}
                                ></div>
                            ))
                        ) : (
                            <span className="text-gray-400 font-bold text-sm">Đã tạm dừng</span>
                        )}
                    </div>

                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">
                        {isListening ? 'Đang chuyển giọng nói thành văn bản...' : 'Nhấn xác nhận để lưu'}
                    </p>

                    <div className="w-full h-[120px] bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200 flex items-center justify-center text-center overflow-y-auto">
                        {transcript ? (
                            <p className="text-lg font-medium text-gray-900 leading-relaxed break-words">
                                "{transcript}"
                            </p>
                        ) : (
                            <p className="text-gray-400 italic">Hãy nói nội dung ghi chú...</p>
                        )}
                    </div>

                    <div className="flex gap-3 w-full">
                        <button onClick={onClose} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                            Hủy
                        </button>
                        <button onClick={onConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-colors">
                            <Check size={20} /> Xác nhận
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(VoiceRecordingModal);
