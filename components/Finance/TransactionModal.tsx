import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Calendar, DollarSign, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { Customer, TransactionType } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    customer?: Customer;
    type: 'revenue' | 'expense' | 'debt'; // Reduced types for simplicity in this modal
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSuccess, customer, type }) => {
    const { userProfile } = useAuth();
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setReason('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!amount || !reason || !date) {
            setError('Vui lòng nhập đầy đủ thông tin');
            return;
        }

        const numAmount = Number(amount.replace(/\./g, ''));
        if (isNaN(numAmount) || numAmount <= 0) {
            setError('Số tiền không hợp lệ');
            return;
        }

        if (!customer?.id) {
            setError('Không xác định được khách hàng');
            return;
        }

        setLoading(true);
        setError('');

        try {
            let transactionType: 'revenue' | 'expense' = 'revenue';
            let actualReason = reason;

            if (type === 'revenue') {
                transactionType = 'revenue';
                actualReason = `Thu tiền: ${reason}`;
            } else if (type === 'expense') {
                transactionType = 'expense';
                actualReason = `Chi tiền: ${reason}`;
                // Expense might need approval if not Admin/Mod? 
                // For now let's assume direct expense for TVBH on their own customer is logged but maybe pending?
                // Requirement: "TVBH sẽ nhập Tên khoản chi..." -> Let's keep it approved for simplicity unless spec says otherwise.
                // Re-reading spec: "TVBH nhập...". Usually expenses subtract from balance.
                actualReason = `Chi tiền: ${reason}`;
            }

            const { error: insertError } = await supabase.from('customer_transactions').insert([{
                customer_id: customer.id,
                created_by: userProfile?.id,
                type: transactionType,
                amount: numAmount,
                reason: actualReason,
                transaction_date: new Date(date).toISOString(),
                created_at: new Date().toISOString()
            }]);

            if (insertError) throw insertError;

            // Update Customer Deal Details Actual Revenue if it is REVENUE
            if (type === 'revenue') {
                const currentActual = customer.deal_details?.actual_revenue || 0;
                const newActual = currentActual + numAmount;

                await supabase.from('customers').update({
                    deal_details: {
                        ...customer.deal_details,
                        actual_revenue: newActual
                    }
                }).eq('id', customer.id);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrencyInput = (value: string) => {
        const raw = value.replace(/\D/g, '');
        return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(formatCurrencyInput(e.target.value));
    };

    const title = type === 'revenue' ? 'Thêm Khoản Thu' : type === 'expense' ? 'Thêm Khoản Chi' : 'Ghi Nợ';
    const colorClass = type === 'revenue' ? 'text-green-600' : type === 'expense' ? 'text-red-600' : 'text-orange-600';
    const bgClass = type === 'revenue' ? 'bg-green-600 hover:bg-green-700' : type === 'expense' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 transition-opacity duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${colorClass}`}>
                        {type === 'revenue' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                        {title}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Khách hàng</label>
                        <div className="font-bold text-gray-900 text-lg">{customer?.name}</div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Số tiền (VNĐ)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={amount}
                                onChange={handleAmountChange}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl font-bold text-lg text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                                placeholder="0"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Ngày ghi nhận</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl font-medium text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Nội dung / Lý do</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-gray-400" size={18} />
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl font-medium text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none h-24"
                                placeholder={`Nhập lý do ${type === 'revenue' ? 'thu' : 'chi'}...`}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`flex-1 py-3 text-white font-bold rounded-xl transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2 ${bgClass} ${loading ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {loading ? 'Đang xử lý...' : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransactionModal;
