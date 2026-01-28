
# Hướng Dẫn Cài Đặt Email Báo Cáo Sáng (6:00 AM)

Tính năng này sẽ tự động tổng hợp danh sách khách hàng đến hạn, quá hạn và hết hạn CS dài hạn để gửi cho từng nhân viên vào mỗi 6:00 sáng.

## Bước 1: Chuẩn Bị Thông Tin Supabase

Bạn cần lấy 2 thông tin từ **Supabase Dashboard**:

1.  **Project URL**: (`Settings` -> `API` -> `Project URL`)
2.  **Service Role Key** (Quan trọng): (`Settings` -> `API` -> `Project API keys` -> `service_role`)
    *   *Lưu ý: Phải dùng `service_role` key để script có quyền đọc dữ liệu của tất cả nhân viên mà không bị chặn bởi RLS.*

## Bước 2: Tạo Google Apps Script

1.  Truy cập [script.google.com](https://script.google.com).
2.  Tạo dự án mới: **"VinFast CRM Daily Report"**.
3.  Copy toàn bộ nội dung từ file `docs/DAILY_REPORT_SCRIPT.gs` trong dự án này và dán vào file `Code.gs` trên trình duyệt.

## Bước 3: Cấu Hình Bảo Mật (Script Properties)

Để bảo mật API Key, chúng ta không paste trực tiếp vào code.

1.  Trong giao diện Apps Script, bấm vào biểu tượng **Bánh răng (Project Settings)** ở menu bên trái.
2.  Cuộn xuống phần **Script Properties**.
3.  Bấm **Add script property** và thêm 2 dòng sau:

| Property | Value |
| :--- | :--- |
| `SUPABASE_URL` | `https://ksrzwrizbqkjyzqhkfkn.supabase.co` |
| `SUPABASE_KEY` | *(Paste Service Role Key của bạn vào đây)* |

4.  Bấm **Save script properties**.

## Bước 4: Chạy Thử

1.  Quay lại tab **Editor (Biểu tượng mã nguồn)**.
2.  Ở thanh công cụ phía trên, chọn hàm `sendDailyReport`.
3.  Bấm nút **Run**.
4.  Cấp quyền (Review Permissions) nếu Google hỏi (Cho phép gửi Email và kết nối External Service).
5.  Kiểm tra **Execution Log** phía dưới. Nếu thấy `✅ Hoàn tất gửi báo cáo`, hãy kiểm tra hòm thư của bạn.

## Bước 5: Cài Đặt Lịch Tự Động (Trigger)

1.  Bấm vào biểu tượng **Đồng hồ (Triggers)** ở menu bên trái.
2.  Bấm nút **+ Add Trigger** (góc dưới phải).
3.  Cấu hình như sau:
    *   **Choose which function to run**: `sendDailyReport`
    *   **Choose which deployment should run**: `Head`
    *   **Select event source**: `Time-driven`
    *   **Select type of time based trigger**: `Day timer`
    *   **Select time of day**: `6am to 7am`
4.  Bấm **Save**.

---
**Hoàn tất!** Hệ thống sẽ tự động quét và gửi email mỗi sáng.
