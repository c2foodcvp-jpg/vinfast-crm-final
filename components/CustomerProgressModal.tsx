import React, { useState, useEffect, useMemo } from 'react';
import { Customer, DeliveryProgress } from '../types';
import { supabase } from '../supabaseClient';
import { CheckCircle2, Circle, X, History, Truck, CarFront } from 'lucide-react';

interface Props {
    customer: Customer;
    visible: boolean;
    onClose: () => void;
    onUpdate?: () => void;
}

export const DELIVERY_STEPS = [
    { key: 'deposited', label: 'Đã cọc', description: 'Khách hàng đã đặt cọc xe' },
    { key: 'contract_signed', label: 'Lên hợp đồng', description: 'Ký hợp đồng mua bán' },
    { key: 'bank_approved', label: 'Đã xong ngân hàng', description: 'Ngân hàng ra thông báo cho vay', condition: (c: Customer) => c.deal_details?.payment_method === 'Ngân hàng' },
    { key: 'payment_invoice', label: 'Đóng tiền XHĐ', description: 'Khách đóng tiền để xuất hóa đơn' },
    { key: 'invoiced', label: 'Đã Xuất hoá đơn', description: 'Hoàn tất xuất hóa đơn GTGT' },
    { key: 'plate_registration', label: 'Bấm biển số', description: 'Hoàn tất đăng ký, bấm biển' },
    { key: 'accessories_pdi', label: 'Làm phụ kiện & PDI', description: 'Lắp phụ kiện và kiểm tra xe (PDI)' },
    { key: 'handover', label: 'Đã bàn giao xe', description: 'Giao xe cho khách hàng' },
    { key: 'collection_return', label: 'Đợi thu hồi tiền về', description: 'Chờ tiền giải ngân/tiền hàng về đủ' },
    { key: 'money_recovered', label: 'Đã thu hồi tiền', description: 'Tiền đã về đủ, hoàn tất quy trình' }
];

const CustomerProgressModal: React.FC<Props> = ({ customer, visible, onClose, onUpdate }) => {
    const [progress, setProgress] = useState<DeliveryProgress>(customer.delivery_progress || {});

    useEffect(() => {
        if (customer.delivery_progress) {
            setProgress(customer.delivery_progress);
        } else {
            setProgress({});
        }
    }, [customer]);

    // Calculate applicable steps
    const applicableSteps = useMemo(() => {
        return DELIVERY_STEPS.filter(step => !step.condition || step.condition(customer));
    }, [customer]);

    // Local state for 'Waiting for Car'
    const [isWaitCar, setIsWaitCar] = useState(customer.deal_details?.car_availability === 'Đợi xe');

    useEffect(() => {
        setIsWaitCar(customer.deal_details?.car_availability === 'Đợi xe');
    }, [customer]);

    // Calculate completion percentage
    const percentComplete = useMemo(() => {
        if (isWaitCar) return 0; // If waiting for car, progress is not calculated
        if (applicableSteps.length === 0) return 0;
        const completedCount = applicableSteps.filter(step => progress[step.key]?.completed).length;
        return Math.round((completedCount / applicableSteps.length) * 100);
    }, [applicableSteps, progress, isWaitCar]);

    const handleToggleWaitCar = async () => {
        const newVal = !isWaitCar;
        setIsWaitCar(newVal);
        const newStatus = newVal ? 'Đợi xe' : 'Sẵn xe';

        try {
            // Update deal_details in DB
            // We need to fetch current deal_details first or assume customer.deal_details is fresh enough? 
            // Better to merge safely if possible, but for now we'll update the JSON column field if Supabase supports generic JSONB update or just replace the field in the object.
            // Since we are updating a specific row, allow existing fields to remain.

            const updatedDealDetails = {
                ...customer.deal_details,
                car_availability: newStatus
            };

            const { error } = await supabase
                .from('customers')
                .update({ deal_details: updatedDealDetails })
                .eq('id', customer.id);

            if (error) throw error;
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error("Error updating car availability:", err);
            setIsWaitCar(!newVal); // Revert on error
            alert("Lỗi cập nhật trạng thái xe: " + err.message);
        }
    };

    const handleToggleStep = async (stepKey: string) => {
        const isCompleted = !progress[stepKey]?.completed;
        const newProgress = {
            ...progress,
            [stepKey]: {
                completed: isCompleted,
                timestamp: isCompleted ? new Date().toISOString() : undefined
            }
        };

        setProgress(newProgress);

        // Auto-save logic can be here, or use a "Save" button. 
        // User asked for "Check click", implying immediate interaction or simple flow.
        // Let's autosave for smooth UX, but maybe debounced? 
        // Or just save immediately since it's a critical state.

        try {
            const { error } = await supabase
                .from('customers')
                .update({ delivery_progress: newProgress })
                .eq('id', customer.id);

            if (error) throw error;
            if (onUpdate) onUpdate();
        } catch (err: any) {
            console.error("Error saving progress:", err);
            alert("Lỗi lưu tiến trình: " + err.message);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Truck className="text-blue-600" />
                            Tiến trình giao xe
                        </h2>
                        <p className="text-sm text-gray-500 mt-1 font-medium">{customer.name} - {customer.interest}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Progress Bar Container */}
                <div className="px-8 py-6 bg-white">
                    {/* Wait Car Toggle - Hide if Plate Registration is done */}
                    {!(progress['plate_registration']?.completed || progress['accessories_pdi']?.completed || progress['handover']?.completed) && (
                        <div
                            onClick={handleToggleWaitCar}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all mb-4 ${isWaitCar ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-blue-200'}`}
                        >
                            <div className={`w-6 h-6 rounded flex items-center justify-center border ${isWaitCar ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 text-transparent'}`}>
                                <CheckCircle2 size={16} />
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-bold text-sm ${isWaitCar ? 'text-orange-800' : 'text-gray-700'}`}>Báo chờ xe (Đợi xe về)</h3>
                                <p className="text-xs text-gray-500">Nếu chọn, tiến độ sẽ tạm dừng tính toán.</p>
                            </div>
                            <CarFront size={24} className={isWaitCar ? 'text-orange-500' : 'text-gray-300'} />
                        </div>
                    )}

                    <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="text-blue-600">Tiến độ hoàn thành</span>
                        <span className="text-blue-600">{percentComplete}%</span>
                    </div>
                    <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div
                            className={`h-full transition-all duration-700 ease-out shadow-lg relative ${isWaitCar ? 'bg-gray-300' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                            style={{ width: `${isWaitCar ? 100 : percentComplete}%` }} // Full gray bar if waiting, or 0? User said "không được tính". Let's show 0% filled? Or full Gray to indicate "Paused"?
                        // Re-reading: "toàn bộ các tiến trình sẽ không được tính". 
                        // Suggests visual 0%.
                        >
                            {/* Override style for 0 width if isWaitCar is causing 0 percent */}
                        </div>
                    </div>
                </div>

                {/* Steps List */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
                    {applicableSteps.map((step, index) => {
                        const isCompleted = progress[step.key]?.completed;
                        const timestamp = progress[step.key]?.timestamp;

                        // Check previous step completion
                        const isPreviousCompleted = index === 0 || progress[applicableSteps[index - 1].key]?.completed;
                        const isDisabled = !isPreviousCompleted;

                        return (
                            <div
                                key={step.key}
                                onClick={() => {
                                    // Modified: ONLY allow toggle if NOT disabled AND NOT completed
                                    // User Requirement: Cannot deselect completed steps.
                                    if (!isDisabled && !isCompleted) handleToggleStep(step.key);
                                }}
                                className={`
                                    group relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200
                                    ${isDisabled
                                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                        : isCompleted
                                            ? 'border-green-100 bg-green-50/50 cursor-default' // Completed: No pointer, green style
                                            : 'cursor-pointer border-gray-100 hover:border-blue-200 hover:bg-blue-50/30' // Active: Pointer, hover effect
                                    }
                                    ${isWaitCar ? 'opacity-50 grayscale pointer-events-none' : ''}
                                `}
                            >
                                {/* Checkbox/Icon */}
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300
                                    ${isCompleted
                                        ? 'bg-green-500 text-white shadow-green-200 shadow-md'
                                        : isDisabled
                                            ? 'bg-gray-100 text-gray-300'
                                            : 'bg-gray-200 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-500'
                                    }
                                `}>
                                    {isCompleted ? <CheckCircle2 size={18} strokeWidth={3} /> : <Circle size={18} />}
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <h3 className={`font-bold text-base ${isCompleted ? 'text-green-800' : 'text-gray-700'}`}>
                                        {step.label}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">{step.description}</p>

                                    {isCompleted && timestamp && (
                                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
                                            <History size={12} />
                                            Hoàn thành: {new Date(timestamp).toLocaleDateString('vi-VN')} {new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>

                                {/* Connector Line (Visual only) */}
                                {index < applicableSteps.length - 1 && (
                                    <div className={`absolute left-[31px] -bottom-6 w-0.5 h-6 -z-10 ${progress[step.key]?.completed ? 'bg-green-200' : 'bg-gray-200'}`} />
                                )}
                            </div>
                        );
                    })}
                </div>

            </div>
        </div>
    );
};

export default CustomerProgressModal;
