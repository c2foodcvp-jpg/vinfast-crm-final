
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { CarModel, CarVersion, QuoteConfig, BankConfig, BankPackage } from '../types';
import {
    Car, Calculator, Check, ChevronDown, DollarSign, Calendar, Landmark, Download, FileText, Loader2, CheckCircle2, AlertCircle, FileImage, Gift, Crown, Coins, ShieldCheck, Phone, MapPin, Search, TableProperties, Lock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- DATA: BẢNG GIÁ DỊCH VỤ ĐĂNG KÝ 2025 ---
const REGISTRATION_SERVICES = [
    { label: '[Hà Nội] VNEID TOÀN TRÌNH', value: 3000000 },
    { label: '[Hà Nội] VNEID - TRUYỀN THỐNG', value: 3000000 },
    { label: '[Hà Nội] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[HCM] VNEID TOÀN TRÌNH - KHÔNG XE', value: 3000000 },
    { label: '[HCM] VNEID - TRUYỀN THỐNG (KHÔNG XE)', value: 3000000 },
    { label: '[HCM] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Bình Dương] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3000000 },
    { label: '[Bình Dương] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3100000 },
    { label: '[Bình Dương] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Đồng Nai] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3200000 },
    { label: '[Đồng Nai] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3400000 },
    { label: '[Đồng Nai] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Bình Phước] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3700000 },
    { label: '[Bình Phước] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3900000 },
    { label: '[Bình Phước] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Vũng Tàu] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3700000 },
    { label: '[Vũng Tàu] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3900000 },
    { label: '[Vũng Tàu] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Tây Ninh] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3500000 },
    { label: '[Tây Ninh] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3800000 },
    { label: '[Tây Ninh] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Đắk Lắk] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 5000000 },
    { label: '[Đắk Lắk] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 6000000 },
    { label: '[Đắk Lắk] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Quy Nhơn] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 6000000 },
    { label: '[Quy Nhơn] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 6500000 },
    { label: '[Quy Nhơn] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Đắk Nông] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 6500000 },
    { label: '[Đắk Nông] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 6800000 },
    { label: '[Đắk Nông] PHÍ CÀ VẸT NHANH', value: 1000000 },
    { label: '[Gia Lai] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 6500000 },
    { label: '[Gia Lai] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 7500000 },
    { label: '[Gia Lai] PHÍ CÀ VẸT NHANH', value: 1000000 },
    { label: '[Cần Thơ] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 4500000 },
    { label: '[Cần Thơ] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 4800000 },
    { label: '[Cần Thơ] PHÍ CÀ VẸT NHANH', value: 1000000 },
    { label: '[Kom Tum] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 7000000 },
    { label: '[Kom Tum] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 8000000 },
    { label: '[Lâm Đồng] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 5200000 },
    { label: '[Lâm Đồng] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 5700000 },
    { label: '[Lâm Đồng] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[An Giang] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 4500000 },
    { label: '[An Giang] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 4800000 },
    { label: '[An Giang] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Bạc Liêu] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 5000000 },
    { label: '[Bạc Liêu] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 5300000 },
    { label: '[Bạc Liêu] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Bến Tre] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3700000 },
    { label: '[Bến Tre] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3800000 },
    { label: '[Bến Tre] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Cà Mau] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 5000000 },
    { label: '[Cà Mau] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 5500000 },
    { label: '[Cà Mau] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Long An] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3500000 },
    { label: '[Long An] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3800000 },
    { label: '[Long An] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Sóc Trăng] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 4500000 },
    { label: '[Sóc Trăng] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 4800000 },
    { label: '[Sóc Trăng] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Quảng Trị] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 9000000 },
    { label: '[Quảng Trị] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 9000000 },
    { label: '[Quảng Trị] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Tiền Giang] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3500000 },
    { label: '[Tiền Giang] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 3800000 },
    { label: '[Tiền Giang] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Vĩnh Long] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3800000 },
    { label: '[Vĩnh Long] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 4100000 },
    { label: '[Vĩnh Long] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Bình Thuận] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 5000000 },
    { label: '[Bình Thuận] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 5200000 },
    { label: '[Bình Thuận] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Đà Nắng] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 11000000 },
    { label: '[Đà Nắng] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 1100000 },
    { label: '[Đà Nắng] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Nha Trang] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 62000000 },
    { label: '[Nha Trang] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 7500000 },
    { label: '[Nha Trang] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Ninh Thuận] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 57000000 },
    { label: '[Ninh Thuận] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 6200000 },
    { label: '[Ninh Thuận] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Phú Yên] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 90000000 },
    { label: '[Phú Yên] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 9000000 },
    { label: '[Phú Yên] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Quãng Nam] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 11000000 },
    { label: '[Quãng Nam] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 11000000 },
    { label: '[Quãng Nam] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Quãng Ngãi] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 11000000 },
    { label: '[Quãng Ngãi] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 11000000 },
    { label: '[Quãng Ngãi] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Kiên Giang] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 5000000 },
    { label: '[Kiên Giang] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 5300000 },
    { label: '[Kiên Giang] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Đồng Tháp] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 3800000 },
    { label: '[Đồng Tháp] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 4000000 },
    { label: '[Đồng Tháp] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Hà Tĩnh] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 11000000 },
    { label: '[Hà Tĩnh] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 11000000 },
    { label: '[Hà Tĩnh] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Hậu Giang] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 4500000 },
    { label: '[Hậu Giang] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 4800000 },
    { label: '[Hậu Giang] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Trà Vinh] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 4500000 },
    { label: '[Trà Vinh] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 4800000 },
    { label: '[Trà Vinh] PHÍ CÀ VẸT NHANH', value: 1500000 },
    { label: '[Huế] VNEID - TOÀN TRÌNH (KHÔNG XE)', value: 12000000 },
    { label: '[Huế] VNEID - TRUYỀN THỐNG (CÓ XE)', value: 12000000 },
    { label: '[Huế] PHÍ CÀ VẸT NHANH', value: 1500000 },
];

// --- HELPER: WARRANTY TEXT LOGIC ---
const getWarrantyText = (modelName: string) => {
    const name = modelName ? modelName.toUpperCase() : '';
    const tenYearModels = ['VF 7', 'VF 8', 'VF 9', 'VF7', 'VF8', 'VF9', 'LẠC HỒNG', 'DRAGON'];
    if (tenYearModels.some(m => name.includes(m))) {
        return "Bảo hành 10 năm - Không giới hạn Km";
    }
    return "Bảo hành 07 năm hoặc 160.000 Km";
};

// --- 1. MẪU BÁO GIÁ CHUẨN (Dùng để render ẩn và chụp ảnh - Inline CSS 100%) ---
const PrintableQuoteTemplate: React.FC<{ data: any }> = ({ data }) => {
    const {
        carModelName, versionName, listPrice, finalInvoicePrice, totalFees, finalRollingPrice,
        invoiceBreakdown, feeBreakdown, rollingBreakdown, activeGifts, membershipData,
        bankName, loanAmount, upfrontPayment, monthlyPaymentTable, userProfile, prepaidPercent,
        isRegistrationFree
    } = data;

    const formatCurrency = (n: number) => n.toLocaleString('vi-VN');
    const today = new Date().toLocaleDateString('vi-VN');
    const warrantyText = getWarrantyText(carModelName);

    // Inline Styles để đảm bảo tính nhất quán tuyệt đối khi render
    const styles = {
        container: {
            width: '800px', // Cố định chiều rộng chuẩn A4
            backgroundColor: '#ffffff',
            padding: '40px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#111827',
            position: 'relative' as const,
            lineHeight: '1.5',
            boxSizing: 'border-box' as const,
            margin: '0 auto'
        },
        header: {
            borderBottom: '3px solid #059669',
            paddingBottom: '20px',
            marginBottom: '30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
        },
        title: {
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#059669',
            margin: '0 0 5px 0',
            textTransform: 'uppercase' as const
        },
        sectionTitle: {
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '4px',
            margin: '0 0 15px 0',
            display: 'inline-block',
            width: '100%',
            boxSizing: 'border-box' as const
        },
        row: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0',
            borderBottom: '1px solid #f3f4f6'
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse' as const,
            fontSize: '14px',
            marginBottom: '20px'
        },
        td: {
            padding: '8px 5px',
            borderBottom: '1px solid #e5e7eb',
            color: '#374151'
        },
        tdRight: {
            padding: '8px 5px',
            borderBottom: '1px solid #e5e7eb',
            textAlign: 'right' as const,
            fontWeight: 'bold',
            color: '#111827'
        },
        totalRow: {
            backgroundColor: '#ecfdf5',
            fontWeight: 'bold',
            color: '#047857',
            fontSize: '16px'
        }
    };

    return (
        <div id="print-template" style={styles.container}>
            {/* HEADER */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>BÁO GIÁ XE VINFAST</h1>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Ngày báo giá: {today}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '22px', color: '#059669', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>VINFAST AUTO</div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#111827', marginBottom: '4px' }}>{warrantyText}</div>
                    <div style={{ fontSize: '14px', color: '#374151', fontStyle: 'italic' }}>Cứu hộ miễn phí 24/7</div>
                </div>
            </div>

            {/* SECTION 1: XE & GIÁ */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ ...styles.sectionTitle, backgroundColor: '#059669' }}>
                    1. THÔNG TIN XE & GIÁ BÁN
                </h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div><span style={{ color: '#6b7280', fontSize: '13px', display: 'block' }}>Dòng xe</span> <strong style={{ fontSize: '16px' }}>{carModelName}</strong></div>
                    <div><span style={{ color: '#6b7280', fontSize: '13px', display: 'block' }}>Phiên bản</span> <strong style={{ fontSize: '16px' }}>{versionName}</strong></div>
                    <div style={{ textAlign: 'right' }}><span style={{ color: '#6b7280', fontSize: '13px', display: 'block' }}>Giá Niêm Yết</span> <strong style={{ color: '#059669', fontSize: '18px' }}>{formatCurrency(listPrice)} VNĐ</strong></div>
                </div>

                <table style={styles.table}>
                    <tbody>
                        {invoiceBreakdown.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td style={styles.td}>• {item.name}</td>
                                <td style={{ ...styles.tdRight, color: '#dc2626' }}>-{formatCurrency(item.amount)}</td>
                            </tr>
                        ))}
                        <tr style={styles.totalRow}>
                            <td style={{ padding: '12px 10px' }}>GIÁ XUẤT HÓA ĐƠN</td>
                            <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatCurrency(finalInvoicePrice)} VNĐ</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SECTION 2: LĂN BÁNH */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ ...styles.sectionTitle, backgroundColor: '#374151' }}>
                    2. CHI PHÍ LĂN BÁNH (DỰ KIẾN)
                </h2>
                <table style={styles.table}>
                    <tbody>
                        {feeBreakdown.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td style={styles.td}>{idx + 1}. {item.name}</td>
                                <td style={{ ...styles.tdRight, fontWeight: 'normal' }}>{formatCurrency(item.amount)}</td>
                            </tr>
                        ))}

                        {/* TOTAL REGISTRATION FEES ROW */}
                        <tr style={{ backgroundColor: '#f3f4f6' }}>
                            <td style={{ ...styles.td, fontWeight: 'bold', fontStyle: 'italic' }}>TỔNG PHÍ ĐĂNG KÝ</td>
                            <td style={{ ...styles.tdRight, fontWeight: 'bold' }}>{formatCurrency(totalFees)}</td>
                        </tr>

                        {isRegistrationFree && (
                            <tr style={{ backgroundColor: '#f0fdf4' }}>
                                <td style={{ ...styles.td, color: '#166534', fontWeight: 'bold' }}>• Tặng 100% Phí Đăng ký</td>
                                <td style={{ ...styles.tdRight, color: '#166534' }}>-{formatCurrency(totalFees)}</td>
                            </tr>
                        )}
                        {rollingBreakdown.map((item: any, idx: number) => (
                            <tr key={`r-${idx}`} style={{ backgroundColor: '#fff7ed' }}>
                                <td style={{ ...styles.td, color: '#ea580c', fontWeight: 'bold' }}>• {item.name} (Ưu đãi)</td>
                                <td style={{ ...styles.tdRight, color: '#ea580c' }}>-{formatCurrency(item.amount)}</td>
                            </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid #374151' }}>
                            <td style={{ padding: '15px 5px', fontWeight: 'bold', fontSize: '16px' }}>TỔNG CỘNG LĂN BÁNH</td>
                            <td style={{ padding: '15px 5px', textAlign: 'right', fontWeight: 'bold', fontSize: '24px', color: '#dc2626' }}>{formatCurrency(finalRollingPrice)} VNĐ</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* SECTION 3: QUÀ TẶNG */}
            {(activeGifts.length > 0 || membershipData.giftValue > 0) && (
                <div style={{ marginBottom: '30px' }}>
                    <h2 style={{ ...styles.sectionTitle, backgroundColor: '#8b5cf6' }}>
                        3. QUÀ TẶNG & ƯU ĐÃI KHÁC
                    </h2>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#374151', lineHeight: '1.8' }}>
                        {activeGifts.map((g: any, idx: number) => (
                            <li key={idx}>
                                <strong>{g.label}</strong> {g.isVinPoint ? `: ${formatCurrency(g.value)} điểm VinPoint` : (g.value > 0 ? `: ${formatCurrency(g.value)}` : '')}
                            </li>
                        ))}
                        {membershipData.giftValue > 0 && (
                            <li>
                                <strong>Ưu đãi {membershipData.name}:</strong> Tặng thêm {formatCurrency(membershipData.giftValue)} (Voucher/Quà)
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {/* SECTION 4: NGÂN HÀNG */}
            {bankName && loanAmount > 0 && (
                <div style={{ marginBottom: '30px', pageBreakInside: 'avoid' }}>
                    <h2 style={{ ...styles.sectionTitle, backgroundColor: '#2563eb' }}>
                        4. DỰ TÍNH TRẢ GÓP ({bankName})
                    </h2>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                        <div style={{ flex: 1, backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                            <p style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Thanh toán đối ứng</p>
                            <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', margin: '5px 0 0 0' }}>{formatCurrency(upfrontPayment)}</p>
                            <p style={{ fontSize: '11px', color: '#60a5fa', margin: '2px 0 0 0' }}>(Lăn bánh - Vay)</p>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'right' }}>
                            <p style={{ fontSize: '12px', color: '#1e40af', fontWeight: 'bold', textTransform: 'uppercase', margin: 0 }}>Số tiền vay ({100 - prepaidPercent}%)</p>
                            <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e3a8a', margin: '5px 0 0 0' }}>{formatCurrency(loanAmount)}</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {monthlyPaymentTable.map((row: any) => (
                            <div key={row.year} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', textAlign: 'center', backgroundColor: '#f9fafb' }}>
                                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', margin: 0 }}>Vay {row.year} Năm</p>
                                <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#2563eb', margin: '4px 0 0 0' }}>{formatCurrency(row.monthly)}/tháng</p>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: '11px', fontStyle: 'italic', color: '#9ca3af', marginTop: '10px', textAlign: 'center' }}>
                        * Số tiền trả góp tính theo dư nợ giảm dần (Gốc + Lãi tháng đầu). Lãi suất thực tế tuỳ thuộc chính sách ngân hàng tại thời điểm vay.
                    </p>
                </div>
            )}

            <div style={{ marginTop: '40px', borderTop: '1px dashed #d1d5db', paddingTop: '20px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                <p>Bảng báo giá có giá trị tham khảo. Vui lòng liên hệ trực tiếp TVBH để được tư vấn chương trình khuyến mãi chính xác nhất.</p>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const OnlineQuote: React.FC = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const quoteRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);

    // Check if user is locked from using this page
    if (userProfile?.is_locked_quote) {
        return (
            <div className="max-w-2xl mx-auto mt-20 p-8 bg-red-50 border-2 border-red-200 rounded-2xl text-center">
                <Lock className="mx-auto text-red-500 mb-4" size={48} />
                <h2 className="text-2xl font-bold text-red-700 mb-2">Tài khoản bị khoá</h2>
                <p className="text-red-600">Bạn đã bị khoá quyền sử dụng trang Báo giá & Tính lãi.</p>
                <p className="text-gray-500 mt-2 text-sm">Vui lòng liên hệ Quản lý để được hỗ trợ.</p>
                <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                    Về trang chủ
                </button>
            </div>
        );
    }

    // Data Sources
    const [carModels, setCarModels] = useState<CarModel[]>([]);
    const [carVersions, setCarVersions] = useState<CarVersion[]>([]);
    const [promotions, setPromotions] = useState<QuoteConfig[]>([]);
    const [fees, setFees] = useState<QuoteConfig[]>([]);
    const [banks, setBanks] = useState<BankConfig[]>([]);
    const [gifts, setGifts] = useState<QuoteConfig[]>([]);
    const [memberships, setMemberships] = useState<QuoteConfig[]>([]);
    const [warranties, setWarranties] = useState<QuoteConfig[]>([]);

    // --- LOCAL STORAGE PERSISTENCE ---
    const STORAGE_KEY = 'vinfast_quote_state';

    // Helper to get saved state from localStorage
    const getSavedState = <T,>(key: string, defaultValue: T): T => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return parsed[key] !== undefined ? parsed[key] : defaultValue;
            }
        } catch (e) { console.error('Error reading localStorage:', e); }
        return defaultValue;
    };

    // Selection State - Initialize from localStorage
    const [selectedModelId, setSelectedModelId] = useState<string>(() => getSavedState('selectedModelId', ''));
    const [selectedVersionId, setSelectedVersionId] = useState<string>(() => getSavedState('selectedVersionId', ''));
    const [selectedBankId, setSelectedBankId] = useState<string>(() => getSavedState('selectedBankId', ''));
    const [selectedMembershipId, setSelectedMembershipId] = useState<string>(() => getSavedState('selectedMembershipId', ''));

    // Bank Package Selection
    const [selectedPackageIndex, setSelectedPackageIndex] = useState<number>(() => getSavedState('selectedPackageIndex', 0));

    // Input State
    const [prepaidPercent, setPrepaidPercent] = useState<number>(() => getSavedState('prepaidPercent', 20));
    const [manualPrepaidAmount, setManualPrepaidAmount] = useState<number | null>(() => getSavedState('manualPrepaidAmount', null));

    const [appliedPromos, setAppliedPromos] = useState<string[]>(() => getSavedState('appliedPromos', []));
    const [customFees, setCustomFees] = useState<Record<string, number>>(() => getSavedState('customFees', {}));
    const [feeOptions, setFeeOptions] = useState<Record<string, number>>(() => getSavedState('feeOptions', {}));
    const [manualDiscount, setManualDiscount] = useState<string>(() => getSavedState('manualDiscount', ''));
    const [manualServiceFee, setManualServiceFee] = useState<string>(() => getSavedState('manualServiceFee', '3.000.000'));

    // --- NEW: INSURANCE & REG FEE STATE ---
    const [includeInsurance, setIncludeInsurance] = useState(() => getSavedState('includeInsurance', false));
    const [insuranceRate, setInsuranceRate] = useState<number>(() => getSavedState('insuranceRate', 1.2));
    const [feeSearch, setFeeSearch] = useState('');
    const [showFeeList, setShowFeeList] = useState(false);

    // NEW: FREE REGISTRATION FLAG
    const [isRegistrationFree, setIsRegistrationFree] = useState(() => getSavedState('isRegistrationFree', false));

    // --- SAVE STATE TO LOCALSTORAGE ---
    useEffect(() => {
        const stateToSave = {
            selectedModelId, selectedVersionId, selectedBankId, selectedMembershipId,
            selectedPackageIndex, prepaidPercent, manualPrepaidAmount,
            appliedPromos, customFees, feeOptions, manualDiscount, manualServiceFee,
            includeInsurance, insuranceRate, isRegistrationFree
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) { console.error('Error saving to localStorage:', e); }
    }, [
        selectedModelId, selectedVersionId, selectedBankId, selectedMembershipId,
        selectedPackageIndex, prepaidPercent, manualPrepaidAmount,
        appliedPromos, customFees, feeOptions, manualDiscount, manualServiceFee,
        includeInsurance, insuranceRate, isRegistrationFree
    ]);

    useEffect(() => {
        fetchQuoteData();
    }, [userProfile]);

    // Track previous model ID to detect user-initiated changes (not initial load)
    const previousModelId = useRef<string | null>(null);

    useEffect(() => {
        // On first effect run, just record the current model ID without resetting
        if (previousModelId.current === null) {
            previousModelId.current = selectedModelId;
            return;
        }

        // Only reset if model ACTUALLY changed (user selected different model)
        if (previousModelId.current !== selectedModelId) {
            previousModelId.current = selectedModelId;
            setSelectedVersionId('');
            setAppliedPromos([]);
            setManualDiscount('');
        }
    }, [selectedModelId]);

    // Track if bank was changed by user (vs initial load)
    const isInitialBankChange = useRef(true);

    useEffect(() => {
        // Skip reset on initial load (when restoring from localStorage)
        if (isInitialBankChange.current) {
            isInitialBankChange.current = false;
            return;
        }
        setSelectedPackageIndex(0);
    }, [selectedBankId]);

    // Initialize fee options only if no saved state exists
    const isInitialFeeLoad = useRef(true);

    useEffect(() => {
        if (fees.length > 0) {
            const initOptions: Record<string, number> = {};
            fees.forEach(f => {
                if (f.options && f.options.length > 0) {
                    initOptions[f.id] = f.options[0].value;
                } else {
                    initOptions[f.id] = f.value;
                }
            });

            // Only set defaults if no saved feeOptions OR this is a fresh session
            if (isInitialFeeLoad.current) {
                isInitialFeeLoad.current = false;
                // Merge: use saved values if they exist, otherwise use defaults
                const savedFeeOptions = getSavedState('feeOptions', {});
                const mergedOptions = { ...initOptions, ...savedFeeOptions };
                setFeeOptions(mergedOptions);
            }
        }
    }, [fees]);

    // AUTO-SELECT PROMOS - Only on user interaction, not on initial load
    const isInitialPromoLoad = useRef(true);

    useEffect(() => {
        // Skip auto-select on initial load (preserve saved appliedPromos)
        if (isInitialPromoLoad.current) {
            isInitialPromoLoad.current = false;
            return;
        }

        if (promotions.length > 0 && selectedModelId) {
            const validPromos = promotions.filter(p => {
                const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
                let versionMatch = true;
                if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
                    versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
                }
                return modelMatch && versionMatch;
            });
            setAppliedPromos(validPromos.map(p => p.id));
        }
    }, [selectedModelId, selectedVersionId, promotions]);

    const fetchQuoteData = async () => {
        setLoading(true);
        try {
            const [modelsRes, versionsRes, promosRes, feesRes, banksRes, giftsRes, memberRes, warrantyRes] = await Promise.all([
                supabase.from('car_models').select('*'),
                supabase.from('car_versions').select('*'),
                supabase.from('quote_configs').select('*').eq('type', 'promotion').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('quote_configs').select('*').eq('type', 'fee').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('banks').select('*'),
                supabase.from('quote_configs').select('*').eq('type', 'gift').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('quote_configs').select('*').eq('type', 'membership').eq('is_active', true).order('priority', { ascending: true }),
                supabase.from('quote_configs').select('*').eq('type', 'warranty').eq('is_active', true).order('created_at', { ascending: false }),
            ]);

            setCarModels((modelsRes.data as CarModel[]) || []);
            setCarVersions((versionsRes.data as CarVersion[]) || []);
            setPromotions((promosRes.data as QuoteConfig[]) || []);
            setFees((feesRes.data as QuoteConfig[]) || []);
            setBanks((banksRes.data as BankConfig[]) || []);
            setGifts((giftsRes.data as QuoteConfig[]) || []);
            setMemberships((memberRes.data as QuoteConfig[]) || []);
            setWarranties((warrantyRes.data as QuoteConfig[]) || []);

            if (banksRes.data && banksRes.data.length > 0) {
                // Only set default bank if no saved bankId
                const savedBankId = getSavedState('selectedBankId', '');
                if (!savedBankId) {
                    setSelectedBankId(banksRes.data[0].id);
                }
            }

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const selectedVersion = carVersions.find(v => v.id === selectedVersionId);
    const selectedBank = banks.find(b => b.id === selectedBankId);

    // Warranty Logic Helper - Updated to use Config
    const getWarrantyPeriod = (modelId: string) => {
        // Find warranty config for this model
        const config = warranties.find(w => w.apply_to_model_ids && w.apply_to_model_ids.includes(modelId));
        if (config) return config.name;

        // Default Fallback
        return "Theo chính sách VinFast";
    };

    const currentInterestRate = useMemo(() => {
        if (!selectedBank) return 0;
        if (selectedBank.packages && selectedBank.packages.length > 0) {
            return selectedBank.packages[selectedPackageIndex]?.rate || 0;
        }
        return selectedBank.interest_rate_1y || 0;
    }, [selectedBank, selectedPackageIndex]);

    // Filtered Reg Fees for Search
    const filteredRegFees = useMemo(() => {
        if (!feeSearch) return [];
        const lower = feeSearch.toLowerCase();
        return REGISTRATION_SERVICES.filter(s => s.label.toLowerCase().includes(lower));
    }, [feeSearch]);

    // --- REGION DETECTION LOGIC ---
    const currentRegion = useMemo(() => {
        const feeWithOptions = fees.find(f => f.options && f.options.length > 0);
        if (!feeWithOptions) return 'Tỉnh'; // Default fallback

        const selectedVal = feeOptions[feeWithOptions.id];
        const selectedOption = feeWithOptions.options?.find(o => o.value === selectedVal);

        if (!selectedOption) return 'Tỉnh';

        const label = selectedOption.label.toLowerCase();
        if (label.includes('hcm') || label.includes('hồ chí minh') || label.includes('sài gòn')) return 'HCM';
        if (label.includes('hà nội') || label.includes('hn') || label.includes('ha noi')) return 'HN';

        return 'Tỉnh';
    }, [fees, feeOptions]);

    // --- CALCULATIONS ---
    const listPrice = selectedVersion?.price || 0;

    // Membership Logic
    const membershipCalculation = useMemo(() => {
        const selectedMem = memberships.find(m => m.id === selectedMembershipId);
        if (!selectedMem) return { discount: 0, giftValue: 0, name: '' };

        const discount = listPrice * (selectedMem.value / 100);
        const giftValue = listPrice * ((selectedMem.gift_ratio || 0) / 100);

        return { discount, giftValue, name: selectedMem.name, percent: selectedMem.value, giftPercent: selectedMem.gift_ratio };
    }, [selectedMembershipId, listPrice, memberships]);

    // 1. Calculate Final INVOICE Price (Giá Xe Hóa Đơn)
    const invoicePromoCalculation = useMemo(() => {
        let currentPrice = listPrice;
        const breakdown: { name: string, amount: number }[] = [];

        // A. Standard Promos (Target: Invoice)
        const applicable = promotions.filter(p => {
            const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
            let versionMatch = true;
            if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
                versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
            }
            return modelMatch && versionMatch;
        });

        const invoicePromos = applicable.filter(p => !p.target_type || p.target_type === 'invoice');
        invoicePromos.sort((a, b) => a.priority - b.priority);

        invoicePromos.forEach(p => {
            if (appliedPromos.includes(p.id)) {
                let amount = 0;
                if (p.value_type === 'percent') {
                    amount = listPrice * (p.value / 100);
                } else {
                    amount = p.value;
                }
                currentPrice -= amount;
                breakdown.push({ name: p.name, amount });
            }
        });

        // B. Membership Discount
        if (membershipCalculation.discount > 0) {
            currentPrice -= membershipCalculation.discount;
            breakdown.push({ name: `Ưu đãi ${membershipCalculation.name} (-${membershipCalculation.percent}%)`, amount: membershipCalculation.discount });
        }

        return { finalPrice: Math.max(0, currentPrice), breakdown };
    }, [listPrice, promotions, appliedPromos, selectedModelId, selectedVersionId, membershipCalculation]);

    const finalInvoicePrice = invoicePromoCalculation.finalPrice;

    // 2. Fees + INSURANCE
    const feeCalculation = useMemo(() => {
        let totalFees = 0;
        const breakdown: { name: string, amount: number, originalId: string }[] = [];

        fees.forEach(f => {
            let baseValue = f.value;
            if (f.options && f.options.length > 0 && feeOptions[f.id] !== undefined) {
                baseValue = feeOptions[f.id];
            }
            if (customFees[f.id] !== undefined) {
                baseValue = customFees[f.id];
            }

            let amount = baseValue;
            if (f.value_type === 'percent') {
                amount = listPrice * (baseValue / 100);
            }
            totalFees += amount;

            let displayLabel = f.name;
            if (f.options && f.options.length > 0) {
                const selectedOpt = f.options.find(o => o.value === feeOptions[f.id]);
                if (selectedOpt) displayLabel = `${f.name} (${selectedOpt.label})`;
            }

            breakdown.push({ name: displayLabel, amount, originalId: f.id });
        });

        if (includeInsurance) {
            const insuranceAmount = finalInvoicePrice * (insuranceRate / 100);
            totalFees += insuranceAmount;
            breakdown.push({ name: `Bảo hiểm 2 chiều (${insuranceRate}%)`, amount: insuranceAmount, originalId: 'hull_insurance' });
        }

        const serviceFee = Number(manualServiceFee.replace(/\D/g, ''));
        if (serviceFee > 0) {
            totalFees += serviceFee;
            breakdown.push({ name: "Dịch vụ đăng ký (Khác)", amount: serviceFee, originalId: 'manual_service' });
        }

        return { totalFees, breakdown };
    }, [fees, customFees, feeOptions, listPrice, finalInvoicePrice, manualServiceFee, includeInsurance, insuranceRate]);

    const totalFees = feeCalculation.totalFees;

    // 3. Rolling Promos & Manual Discount
    const rollingPromoCalculation = useMemo(() => {
        let totalDiscount = 0;
        const breakdown: { name: string, amount: number }[] = [];

        const applicable = promotions.filter(p => {
            const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
            let versionMatch = true;
            if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
                versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
            }
            return modelMatch && versionMatch;
        });

        const rollingPromos = applicable.filter(p => p.target_type === 'rolling');

        rollingPromos.forEach(p => {
            if (appliedPromos.includes(p.id)) {
                let amount = 0;
                if (p.value_type === 'percent') {
                    amount = listPrice * (p.value / 100);
                } else {
                    amount = p.value;
                }
                totalDiscount += amount;
                breakdown.push({ name: p.name, amount });
            }
        });

        const manualVal = Number(manualDiscount.replace(/\D/g, ''));
        if (manualVal > 0) {
            totalDiscount += manualVal;
            breakdown.push({ name: 'Giảm giá thêm', amount: manualVal });
        }

        return { totalDiscount, breakdown };
    }, [promotions, appliedPromos, selectedModelId, selectedVersionId, listPrice, manualDiscount]);

    // Final Rolling Calculation
    const preRollingPrice = finalInvoicePrice + totalFees;
    const finalRollingPrice = Math.max(0, preRollingPrice - rollingPromoCalculation.totalDiscount);

    // 4. Payment & Loan
    const loanAmount = useMemo(() => {
        if (manualPrepaidAmount !== null) {
            return Math.max(0, finalInvoicePrice - manualPrepaidAmount);
        }
        return finalInvoicePrice * ((100 - prepaidPercent) / 100);
    }, [finalInvoicePrice, prepaidPercent, manualPrepaidAmount]);

    const upfrontPayment = Math.max(0, finalRollingPrice - loanAmount);

    const handlePrepaidPercentChange = (val: number) => {
        setPrepaidPercent(val);
        setManualPrepaidAmount(null);
    };

    const handleManualPrepaidChange = (val: number) => {
        setManualPrepaidAmount(val);
        if (finalInvoicePrice > 0) {
            const pct = (val / finalInvoicePrice) * 100;
            setPrepaidPercent(Math.round(pct));
        }
    };

    // 5. Monthly Payment Table
    const monthlyPaymentTable = useMemo(() => {
        if (!selectedBank || loanAmount <= 0) return [];
        const rate = currentInterestRate / 100;
        const result = [];
        for (let year = 3; year <= 8; year++) {
            const months = year * 12;
            const principal = loanAmount / months;
            const interest = (loanAmount * rate) / 12;
            const firstMonth = principal + interest;
            result.push({ year, monthly: firstMonth });
        }
        return result;
    }, [loanAmount, selectedBank, currentInterestRate]);

    // Helper to check if gift is VinPoint
    const getGiftDetails = (g: QuoteConfig) => {
        // Check if it's VinPoint type (has options mapping)
        if (g.options && g.options.length > 0) {
            // Find mapping for current model
            const mapped = g.options.find(opt => opt.model_id === selectedModelId);
            if (mapped) {
                return { isVinPoint: true, value: mapped.value, label: `${g.name} (Tích điểm)` };
            }
            // If no mapping for this model, return null (gift not applicable)
            return null;
        }
        // Standard Gift
        return { isVinPoint: false, value: g.value, label: g.name };
    };

    const activeGifts = gifts.map(g => getGiftDetails(g)).filter(g => g !== null) as { isVinPoint: boolean, value: number, label: string }[];

    const formatCurrency = (n: number) => n.toLocaleString('vi-VN');

    // --- UPDATED EXPORT LOGIC: GHOST RENDER STRATEGY ---
    const handleExportQuote = async (type: 'excel' | 'pdf' | 'image') => {
        if (type === 'excel') {
            // Keep existing Excel logic
            const data = [
                ["BÁO GIÁ XE VINFAST", ""],
                ["Dòng xe", `${selectedVersion?.name || ''} (${carModels.find(m => m.id === selectedModelId)?.name})`],
                ["Giá Niêm Yết", formatCurrency(listPrice)],
                ...invoicePromoCalculation.breakdown.map(p => [p.name, `-${formatCurrency(p.amount)}`]),
                ["GIÁ XUẤT HÓA ĐƠN", formatCurrency(finalInvoicePrice)],
                ["", ""],
                ["CHI PHÍ LĂN BÁNH", ""],
                ...feeCalculation.breakdown.map(f => [f.name, formatCurrency(f.amount)]),
                ["TỔNG PHÍ", formatCurrency(totalFees)],
                ["", ""],
                ["ƯU ĐÃI LĂN BÁNH", ""],
                ...rollingPromoCalculation.breakdown.map(p => [p.name, `-${formatCurrency(p.amount)}`]),
                ["", ""],
                ["TỔNG CỘNG LĂN BÁNH", formatCurrency(finalRollingPrice)],
                ["", ""],
                ["QUÀ TẶNG KÈM THEO", ""],
                ...activeGifts.map(g => [g.label, g.isVinPoint ? `${formatCurrency(g.value)} điểm` : (g.value > 0 ? formatCurrency(g.value) : 'Hiện vật')]),
                ...(membershipCalculation.giftValue > 0 ? [[`Ưu đãi ${membershipCalculation.name} (Tặng thêm)`, formatCurrency(membershipCalculation.giftValue)]] : []),
                ["", ""],
                ["DỰ TÍNH NGÂN HÀNG", selectedBank?.name],
                ["Trả trước", `${prepaidPercent}% (~${formatCurrency(finalInvoicePrice - loanAmount)})`],
                ["Số tiền vay", formatCurrency(loanAmount)],
                ["Thanh toán đối ứng", formatCurrency(upfrontPayment)],
                ["", ""],
                ["GÓP HÀNG THÁNG (Dư nợ giảm dần)", ""],
                ...monthlyPaymentTable.map(r => [`${r.year} Năm`, `${formatCurrency(r.monthly)} VNĐ/tháng`])
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "BaoGia");
            XLSX.writeFile(wb, "Bao_Gia_VinFast.xlsx");
            return;
        }

        // --- NEW GHOST RENDER LOGIC FOR IMAGE/PDF (Using PrintableQuoteTemplate) ---

        const quoteData = {
            carModelName: carModels.find(m => m.id === selectedModelId)?.name || 'VinFast',
            versionName: selectedVersion?.name || '',
            listPrice,
            finalInvoicePrice,
            totalFees,
            finalRollingPrice,
            invoiceBreakdown: invoicePromoCalculation.breakdown,
            feeBreakdown: feeCalculation.breakdown,
            rollingBreakdown: rollingPromoCalculation.breakdown,
            activeGifts,
            membershipData: membershipCalculation,
            bankName: selectedBank?.name,
            loanAmount,
            upfrontPayment,
            monthlyPaymentTable,
            userProfile,
            prepaidPercent,
            isRegistrationFree // Pass this flag to print template
        };

        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '-10000px';
        container.style.left = '0';
        container.style.zIndex = '-1000';
        document.body.appendChild(container);

        const root = createRoot(container);
        root.render(<PrintableQuoteTemplate data={quoteData} />);

        await new Promise(resolve => setTimeout(resolve, 800));

        const element = document.getElementById('print-template');
        if (!element) {
            document.body.removeChild(container);
            alert("Lỗi tạo mẫu in.");
            return;
        }

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // High resolution
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/jpeg', 1.0);

            if (type === 'image') {
                const link = document.createElement('a');
                link.download = `BaoGia_VinFast_${new Date().getTime()}.jpg`;
                link.href = imgData;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`BaoGia_VinFast_${new Date().getTime()}.pdf`);
            }
        } catch (err) {
            console.error("Export failed", err);
            alert("Lỗi khi xuất file. Vui lòng thử lại.");
        } finally {
            setTimeout(() => {
                root.unmount();
                document.body.removeChild(container);
            }, 100);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-600" /></div>;

    const availablePromos = promotions.filter(p => {
        const modelMatch = !p.apply_to_model_ids || p.apply_to_model_ids.length === 0 || p.apply_to_model_ids.includes(selectedModelId);
        let versionMatch = true;
        if (selectedVersionId && p.apply_to_version_ids && p.apply_to_version_ids.length > 0) {
            versionMatch = p.apply_to_version_ids.includes(selectedVersionId);
        }
        return modelMatch && versionMatch;
    });

    return (
        <div className="max-w-[1200px] mx-auto pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Calculator className="text-emerald-600" /> Báo Giá Online
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">Tạo báo giá, tính lăn bánh & dự tính trả góp.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => navigate('/bank-calculator', {
                            state: {
                                initialLoanAmount: loanAmount,
                                bankName: selectedBank?.name,
                                bankPackage: selectedBank?.packages?.[selectedPackageIndex]
                            }
                        })}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all shadow-sm group"
                    >
                        <TableProperties size={16} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                        Tính lãi Bank
                    </button>
                    <div className="w-px h-8 bg-gray-300 mx-1"></div>
                    <button onClick={() => handleExportQuote('image')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg text-sm">
                        <FileImage size={16} /> Lưu Ảnh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LEFT COLUMN: CONFIGURATION */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Car Selection */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Car size={18} /> Chọn xe</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Dòng xe</label>
                                <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium" value={selectedModelId} onChange={e => setSelectedModelId(e.target.value)}>
                                    <option value="">-- Chọn dòng xe --</option>
                                    {carModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Phiên bản</label>
                                <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium" value={selectedVersionId} onChange={e => setSelectedVersionId(e.target.value)} disabled={!selectedModelId}>
                                    <option value="">-- Chọn phiên bản --</option>
                                    {carVersions.filter(v => v.model_id === selectedModelId).map(v => <option key={v.id} value={v.id}>{v.name} ({formatCurrency(v.price)})</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* MEMBERSHIP & INSURANCE */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Crown size={18} /> Hạng Khách hàng</h3>
                        <div className="space-y-2 mb-4">
                            <label className="flex items-center gap-3 cursor-pointer p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                                <input
                                    type="radio"
                                    name="membership"
                                    className="w-4 h-4 text-emerald-600"
                                    checked={selectedMembershipId === ''}
                                    onChange={() => setSelectedMembershipId('')}
                                />
                                <span className="text-sm text-gray-700">Khách hàng thông thường</span>
                            </label>
                            {memberships.map(m => (
                                <label key={m.id} className="flex items-center gap-3 cursor-pointer p-2 border border-yellow-200 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                                    <input
                                        type="radio"
                                        name="membership"
                                        className="w-4 h-4 text-emerald-600"
                                        checked={selectedMembershipId === m.id}
                                        onChange={() => setSelectedMembershipId(m.id)}
                                    />
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-gray-800">{m.name}</span>
                                        <div className="text-xs text-gray-600 flex gap-2">
                                            <span>Giảm: <strong>{m.value}%</strong></span>
                                            {m.gift_ratio && <span>+ Tặng thêm: <strong>{m.gift_ratio}%</strong></span>}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* INSURANCE CHECKBOX */}
                        <div className="pt-4 border-t border-gray-100">
                            <h4 className="font-bold text-gray-700 text-sm mb-2 flex items-center gap-2"><ShieldCheck size={16} /> Bảo hiểm thân vỏ</h4>
                            <div className="flex items-center justify-between p-2 border border-blue-100 bg-blue-50 rounded-lg">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={includeInsurance}
                                        onChange={(e) => setIncludeInsurance(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-sm font-bold text-blue-800">Mua Bảo Hiểm</span>
                                </label>
                                {includeInsurance && (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={insuranceRate}
                                            onChange={(e) => setInsuranceRate(parseFloat(e.target.value))}
                                            className="w-16 px-2 py-1 text-sm text-right font-bold border border-blue-200 rounded outline-none"
                                        />
                                        <span className="text-xs font-bold text-blue-600">%</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* NEW: QUICK REGISTRATION FEE LOOKUP */}
                        <div className="pt-4 border-t border-gray-100 relative">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Search size={16} /> Tra cứu Phí đăng ký</h4>
                            </div>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 mb-2"
                                placeholder="Nhập tỉnh/thành (VD: HCM, Đồng Nai...)"
                                value={feeSearch}
                                onChange={(e) => {
                                    setFeeSearch(e.target.value);
                                    setShowFeeList(true);
                                }}
                                onFocus={() => setShowFeeList(true)}
                                onBlur={() => setTimeout(() => setShowFeeList(false), 200)}
                            />
                            {showFeeList && feeSearch && (
                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                                    {filteredRegFees.length > 0 ? (
                                        filteredRegFees.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-50 last:border-0"
                                                onMouseDown={() => {
                                                    setManualServiceFee(item.value.toLocaleString('vi-VN'));
                                                    setFeeSearch('');
                                                    setShowFeeList(false);
                                                }}
                                            >
                                                <div className="font-bold text-gray-800">{item.label}</div>
                                                <div className="text-blue-600 font-bold">{item.value.toLocaleString('vi-VN')} VNĐ</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-xs text-gray-500">Không tìm thấy kết quả.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* FEE OPTIONS (Plate, TNDS...) */}
                    {fees.some(f => f.options && f.options.length > 0) && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><MapPin size={18} /> Khu vực & Phí khác</h3>
                            <div className="space-y-4">
                                {fees.filter(f => f.options && f.options.length > 0).map(f => (
                                    <div key={f.id}>
                                        <label className="block text-sm font-bold text-gray-600 mb-1">{f.name}</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-medium"
                                            value={feeOptions[f.id] || (f.options && f.options[0]?.value)}
                                            onChange={(e) => setFeeOptions({ ...feeOptions, [f.id]: Number(e.target.value) })}
                                        >
                                            {f.options?.map((opt, idx) => (
                                                <option key={idx} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            {/* FREE REGISTRATION CHECKBOX */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <label className="flex items-center gap-2 cursor-pointer bg-green-50 p-2 rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isRegistrationFree}
                                        onChange={(e) => setIsRegistrationFree(e.target.checked)}
                                        className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                    />
                                    <span className="text-sm font-bold text-green-800 flex-1">Tặng 100% Phí đăng ký</span>
                                    {isRegistrationFree && <span className="text-xs font-bold text-green-600 bg-white px-2 py-0.5 rounded">Đã áp dụng</span>}
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Promotions */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><DollarSign size={18} /> Khuyến mãi áp dụng</h3>
                        {availablePromos.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">Không có khuyến mãi cho dòng xe này.</p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                {availablePromos.map(p => (
                                    <div key={p.id} className="flex items-center gap-3 p-2 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setAppliedPromos(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${appliedPromos.includes(p.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                                            {appliedPromos.includes(p.id) && <Check size={14} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-800">{p.name}</p>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <p className="text-xs text-emerald-600 font-bold">Giảm {p.value_type === 'percent' ? `${p.value}%` : formatCurrency(p.value)}</p>
                                                {p.target_type === 'rolling' && <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 rounded uppercase font-bold">Lăn bánh</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* MANUAL DISCOUNT FIELD */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Giảm giá thêm (VNĐ)</label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-bold text-red-600"
                                value={manualDiscount}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '');
                                    setManualDiscount(val ? Number(val).toLocaleString('vi-VN') : '');
                                }}
                                placeholder="Nhập số tiền giảm thêm..."
                            />
                            <p className="text-xs text-gray-400 mt-1 italic">Số tiền này sẽ trừ vào giá Lăn bánh cuối cùng.</p>
                        </div>
                    </div>

                    {/* Bank Config */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Landmark size={18} /> Vay Ngân hàng</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1">Ngân hàng</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {banks.map(b => (
                                        <button
                                            key={b.id}
                                            onClick={() => setSelectedBankId(b.id)}
                                            className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all ${selectedBankId === b.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            {b.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Package Selection */}
                            {selectedBank && selectedBank.packages && selectedBank.packages.length > 0 && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1">Gói lãi suất</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none text-sm font-medium"
                                        value={selectedPackageIndex}
                                        onChange={e => setSelectedPackageIndex(Number(e.target.value))}
                                    >
                                        {selectedBank.packages.map((pkg, idx) => (
                                            <option key={idx} value={idx}>{pkg.name} ({pkg.rate}%)</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="block text-sm font-bold text-gray-600">Trả trước (theo XHĐ)</label>
                                    <span className="text-sm font-bold text-blue-600">{prepaidPercent}%</span>
                                </div>

                                {/* Slider */}
                                <input type="range" min="15" max="95" step="5" value={prepaidPercent} onChange={e => handlePrepaidPercentChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2" />
                                <div className="flex justify-between text-xs text-gray-400 mb-2"><span>15%</span><span>50%</span><span>95%</span></div>

                                {/* Manual Prepaid Input */}
                                <label className="block text-xs font-bold text-gray-500 mb-1">Hoặc nhập số tiền (VNĐ)</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 font-bold text-gray-800"
                                    value={manualPrepaidAmount !== null ? formatCurrency(manualPrepaidAmount) : ''}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        handleManualPrepaidChange(val ? Number(val) : 0);
                                    }}
                                    placeholder={formatCurrency(finalInvoicePrice * (prepaidPercent / 100))}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: QUOTE SHEET (VISUAL) */}
                <div className="lg:col-span-7">
                    <div ref={quoteRef} className="bg-[#e6fffa] border-2 border-emerald-500 rounded-2xl overflow-hidden shadow-xl sticky top-6">
                        {/* Header Image Area */}
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-extrabold uppercase tracking-tight">Báo Giá Xe {carModels.find(m => m.id === selectedModelId)?.name || 'VinFast'}</h2>
                                <p className="text-emerald-100 font-medium text-lg mt-1">{selectedVersion?.name || 'Vui lòng chọn phiên bản'}</p>

                                {/* Specs Summary */}
                                {selectedVersion && (
                                    <div className="mt-4 grid grid-cols-2 gap-y-1 text-sm font-medium text-white/90">
                                        <div className="flex items-center gap-1"><CheckCircle2 size={14} /> Giá niêm yết: {formatCurrency(listPrice)}</div>
                                        <div className="flex items-center gap-1"><ShieldCheck size={14} /> {getWarrantyPeriod(selectedModelId)}</div>
                                    </div>
                                )}
                            </div>
                            <Car className="absolute -right-6 -bottom-6 text-white opacity-20 w-48 h-48 transform -rotate-12" />
                        </div>

                        <div className="p-6 space-y-6">
                            {/* 1. PRICE & PROMOS (INVOICE TARGET) */}
                            <div>
                                <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                    <span className="text-sm font-bold text-gray-500 uppercase">Giá xe (Hóa đơn)</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-gray-800">Giá Niêm Yết</span>
                                        <span className="font-bold text-gray-900">{formatCurrency(listPrice)} VNĐ</span>
                                    </div>
                                    {invoicePromoCalculation.breakdown.map((p, idx) => (
                                        <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-emerald-300">
                                            <span>• {p.name}</span>
                                            <span className="font-bold text-red-500">-{formatCurrency(p.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between pt-2 mt-2 border-t border-dashed border-emerald-300">
                                        <span className="font-extrabold text-blue-600 uppercase">GIÁ XUẤT HÓA ĐƠN</span>
                                        <span className="font-extrabold text-blue-600 text-lg">{formatCurrency(finalInvoicePrice)} VNĐ</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. FEES - UPDATED WITH OPTIONS */}
                            <div>
                                <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                    <span className="text-sm font-bold text-gray-500 uppercase">Chi phí lăn bánh (Dự kiến)</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    {fees.map((f) => (
                                        <div key={f.id} className="flex justify-between items-center group">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-700 font-medium">{f.name}</span>
                                                {/* Show Dropdown if Options exist */}
                                                {f.options && f.options.length > 0 && (
                                                    <select
                                                        className="bg-gray-50 border border-gray-300 text-gray-800 text-xs rounded p-1 outline-none font-bold"
                                                        value={feeOptions[f.id] || f.options[0].value}
                                                        onChange={(e) => setFeeOptions({ ...feeOptions, [f.id]: Number(e.target.value) })}
                                                    >
                                                        {f.options.map((opt, idx) => (
                                                            <option key={idx} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Editable Fee if no options */}
                                                <input
                                                    className="text-right font-bold text-gray-800 bg-transparent border-b border-transparent focus:border-emerald-500 focus:bg-white w-28 outline-none transition-all"
                                                    value={formatCurrency(
                                                        (f.options && f.options.length > 0) ? (feeOptions[f.id] || 0) : (customFees[f.id] !== undefined ? customFees[f.id] : f.value)
                                                    )}
                                                    onChange={(e) => {
                                                        // Only allow manual edit if NOT options based
                                                        if (!f.options || f.options.length === 0) {
                                                            const val = Number(e.target.value.replace(/\./g, ''));
                                                            if (!isNaN(val)) setCustomFees({ ...customFees, [f.id]: val });
                                                        }
                                                    }}
                                                    disabled={!!f.options && f.options.length > 0}
                                                />
                                                <span className="text-gray-500 text-xs">VNĐ</span>
                                            </div>
                                        </div>
                                    ))}

                                    {/* MANUAL SERVICE FEE INPUT */}
                                    <div className="flex justify-between items-center group pt-1">
                                        <span className="text-gray-700 font-medium">Dịch vụ đăng ký (Khác)</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="text-right font-bold text-blue-600 bg-blue-50/50 border-b border-blue-200 focus:border-blue-500 w-28 outline-none transition-all"
                                                value={manualServiceFee}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    setManualServiceFee(val ? Number(val).toLocaleString('vi-VN') : '');
                                                }}
                                                placeholder="0"
                                            />
                                            <span className="text-gray-500 text-xs">VNĐ</span>
                                        </div>
                                    </div>

                                    {/* NEW: Insurance Line Visible in Preview when Checked */}
                                    {includeInsurance && (
                                        <div className="flex justify-between items-center group pt-1">
                                            <span className="text-gray-700 font-medium">Bảo hiểm 2 chiều ({insuranceRate}%)</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-right font-bold text-gray-800 w-28">{formatCurrency(finalInvoicePrice * (insuranceRate / 100))}</span>
                                                <span className="text-gray-500 text-xs">VNĐ</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                                        <span className="font-bold text-gray-600 uppercase">TỔNG PHÍ ĐĂNG KÝ</span>
                                        <span className="font-bold text-gray-800">{formatCurrency(totalFees)} VNĐ</span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. ROLLING PROMOS */}
                            {(rollingPromoCalculation.totalDiscount > 0 || isRegistrationFree) && (
                                <div>
                                    <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                        <span className="text-sm font-bold text-gray-500 uppercase">Ưu đãi Lăn bánh / Giảm thêm</span>
                                    </div>
                                    <div className="space-y-2">
                                        {isRegistrationFree && (
                                            <div className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-green-500 bg-green-50/50 p-1 rounded-r">
                                                <span>• Tặng 100% Phí Đăng ký</span>
                                                <span className="font-bold text-green-600">-{formatCurrency(totalFees)}</span>
                                            </div>
                                        )}
                                        {rollingPromoCalculation.breakdown.map((p, idx) => (
                                            <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-orange-300">
                                                <span>• {p.name}</span>
                                                <span className="font-bold text-red-500">-{formatCurrency(p.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 4. TOTAL ROLLING */}
                            <div className="bg-white p-4 rounded-xl border-2 border-red-100 text-center shadow-inner">
                                <p className="text-gray-500 font-bold uppercase text-xs">TỔNG CỘNG LĂN BÁNH</p>
                                <p className="text-3xl font-extrabold text-red-600 tracking-tight">{formatCurrency(finalRollingPrice)} VNĐ</p>
                                <p className="text-[10px] text-gray-400 mt-1">(Đã bao gồm Giá xe + Phí - Khuyến mãi)</p>
                            </div>

                            {/* 5. GIFTS & MEMBERSHIP BONUS (UPDATED with VinPoint) */}
                            {(activeGifts.length > 0 || membershipCalculation.giftValue > 0) && (
                                <div>
                                    <div className="flex justify-between items-end mb-2 border-b border-emerald-200 pb-1">
                                        <span className="text-sm font-bold text-gray-500 uppercase flex items-center gap-1"><Gift size={14} /> QUÀ TẶNG & ƯU ĐÃI THÊM</span>
                                    </div>
                                    <div className="space-y-2">
                                        {activeGifts.map((g, idx) => (
                                            <div key={idx} className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-purple-300">
                                                <span>• {g.label}</span>
                                                {g.isVinPoint ? (
                                                    <span className="font-bold text-yellow-600 flex items-center gap-1"><Coins size={12} /> {formatCurrency(g.value)} điểm</span>
                                                ) : (
                                                    <span className="font-bold text-purple-600">{g.value > 0 ? formatCurrency(g.value) : 'Hiện vật'}</span>
                                                )}
                                            </div>
                                        ))}
                                        {membershipCalculation.giftValue > 0 && (
                                            <div className="flex justify-between text-sm text-gray-600 pl-2 border-l-2 border-yellow-300">
                                                <span>• Ưu đãi {membershipCalculation.name} (Tặng thêm {membershipCalculation.giftPercent}%)</span>
                                                <span className="font-bold text-green-600">+{formatCurrency(membershipCalculation.giftValue)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 6. BANK PREVIEW (UPDATED) */}
                            {selectedBank && loanAmount > 0 && (
                                <div className="bg-white rounded-xl overflow-hidden border border-blue-100">
                                    <div className="bg-blue-50 p-3 flex items-center justify-between border-b border-blue-100">
                                        <div className="flex items-center gap-2 text-blue-800 font-bold"><Landmark size={18} /> BẢNG TÍNH VAY NGÂN HÀNG</div>
                                        <div className="text-xs font-bold bg-white text-blue-600 px-2 py-1 rounded border border-blue-200">
                                            {selectedBank?.packages?.[selectedPackageIndex]?.name || (currentInterestRate > 0 ? `Lãi ${currentInterestRate}%` : 'Chưa có lãi suất')}
                                        </div>
                                    </div>
                                    <div className="p-4 grid grid-cols-2 gap-6 bg-blue-50/30">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Thanh toán đối ứng</p>
                                            <p className="text-lg font-bold text-red-600">{formatCurrency(upfrontPayment)}</p>
                                            <p className="text-[10px] text-gray-400">(Lăn bánh - Vay)</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 uppercase font-bold">Số tiền vay</p>
                                            <p className="text-lg font-bold text-blue-600">{formatCurrency(loanAmount)}</p>
                                            <p className="text-[10px] text-gray-400">({prepaidPercent}% Trả trước)</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 border-t border-gray-100">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-3 text-center">ƯỚC TÍNH TRẢ GÓP (GỐC + LÃI THÁNG ĐẦU)</p>
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            {monthlyPaymentTable.map(row => (
                                                <div key={row.year} className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                    <p className="text-[10px] text-gray-500 font-bold mb-1">{row.year} Năm</p>
                                                    <p className="text-sm font-bold text-blue-700">{formatCurrency(row.monthly)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-center text-gray-400 mt-3 italic flex items-center justify-center gap-1">
                                            <AlertCircle size={10} /> Số tiền tính theo dư nợ giảm dần, lãi suất thả nổi sau ưu đãi.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnlineQuote;

