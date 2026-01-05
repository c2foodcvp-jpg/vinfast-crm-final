# VinFast CRM Enterprise

Hệ thống quản lý quan hệ khách hàng (CRM) chuyên nghiệp dành cho đại lý và nhân viên kinh doanh VinFast.

## Tính năng chính

- **Quản lý Khách hàng:** Phân loại Hot/Warm/Cool, nhắc lịch chăm sóc, lịch sử tương tác.
- **Phân quyền:** Admin, Mod (Quản lý team), Sales (Nhân viên).
- **Tài chính & Quỹ:** Quản lý thu/chi, nộp quỹ, xin ứng tiền, QR Code.
- **Leads:** Tự động quét Leads từ ảnh (OCR) hoặc Form.
- **Báo cáo:** Biểu đồ hiệu suất, tỷ lệ chốt deal.

## Cài đặt và Chạy dự án

1. Clone dự án:
   ```bash
   git clone <link-repo>
   ```

2. Cài đặt thư viện:
   ```bash
   npm install
   ```

3. Chạy môi trường Dev:
   ```bash
   npm run dev
   ```

4. Build để Deploy:
   ```bash
   npm run build
   ```

## Công nghệ sử dụng

- React + Vite
- TypeScript
- Tailwind CSS
- Supabase (Database & Auth)
- Recharts (Biểu đồ)
- Tesseract.js (OCR)
