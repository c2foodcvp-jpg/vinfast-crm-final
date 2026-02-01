# ✅ Đã hoàn thành Feature Enhancement: Cảnh báo Hoàn tất Quỹ

Tôi đã thêm tính năng cảnh báo an toàn khi bạn nhấn **"Hoàn thành Quỹ"**.

### Chi tiết tính năng:

1.  **Tự động kiểm tra**: Hệ thống sẽ quét toàn bộ khách hàng trong kỳ quỹ.
2.  **Phát hiện vi phạm**:
    *   Khách chưa hoàn thành bước **"Đã thu hồi tiền"**.
    *   Khách còn dư nợ quỹ (**Đại lý nợ / Cho mượn** > 0).
3.  **Hành động**:
    *   Hiện Popup cảnh báo với danh sách chi tiết các khách hàng vi phạm.
    *   Cho phép **"Vẫn hoàn thành"** (Force Complete) nếu bạn muốn bỏ qua.

### File đã cập nhật:
*   `pages/Finance.tsx`: Thêm logic validation và Modal cảnh báo.
*   `task.md`: Đã cập nhật trạng thái hoàn thành.
*   `walkthrough.md`: Hướng dẫn sử dụng tính năng mới.

Bạn có thể test ngay trên giao diện **Tài chính & Quỹ**.
