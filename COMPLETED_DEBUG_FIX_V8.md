# ✅ Đã sửa lỗi lưu Cấu hình Hệ thống & Force Update

Tôi đã khắc phục vấn đề `ON CONFLICT` khi lưu cấu hình Force Update và các cài đặt Logo thương hiệu.

### Nguyên nhân
Dữ liệu trong bảng `app_settings` có index duy nhất dựa trên `(key, manager_id)` chứ không phải `key` duy nhất. Lệnh `upsert` cũ sử dụng `onConflict: 'key'` gây ra lỗi vì không tìm thấy constraint tương ứng.

### Giải pháp
Đã cập nhật logic lưu trữ trong `SystemSettingsPanel.tsx`:
1.  **Force Update**: Thay thế `upsert` bằng cơ chế kiểm tra sự tồn tại -> thực hiện `UPDATE` hoặc `INSERT` chính xác kèm `manager_id: null`.
2.  **Cấu hình Logo**: Áp dụng logic tương tự cho việc lưu logo và favicon, đảm bảo không gặp lỗi khi lưu nhiều cấu hình cùng lúc.

Bạn có thể thử lại chức năng "Tắt thông báo" hoặc "Lưu thay đổi" ngay bây giờ!
