# ✅ Đã cập nhật Hiển thị Số tiền Chưa vào quỹ (Version Final)

Tôi đã điều chỉnh logic để hiển thị chính xác con số bạn cần: **Số tiền thực tế chưa vào quỹ**.

### Công thức tính:
*   **Chưa vào quỹ** = [Doanh thu dự kiến] - [Tổng số tiền đã nộp (Approved Payment)]

### Ví dụ áp dụng:
1.  **Trường hợp khách Lộc 1**:
    *   Doanh thu: 10.000.000 đ
    *   Đã nộp: 2.000.000 đ
    *   Hệ thống báo: *"Chưa hoàn tất thu hồi công nợ (Chưa vào quỹ: **8.000.000 đ**)"* -> **KHỚP** với hình bạn khoanh tròn.

2.  **Trường hợp khách Test 1**:
    *   Doanh thu: 10.000.000 đ
    *   Đã nộp: 0 đ
    *   Hệ thống báo: *"Chưa hoàn tất thu hồi công nợ (Chưa vào quỹ: **10.000.000 đ**)"*

Giờ đây bảng cảnh báo sẽ phản ánh đúng số tiền thực tế cần thu hồi còn lại của từng khách hàng.

Bạn hãy kiểm tra lại nhé!
