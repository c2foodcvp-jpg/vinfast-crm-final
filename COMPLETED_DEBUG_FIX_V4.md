# ✅ Đã cập nhật Logic Cảnh báo (Phiên bản Toàn diện nhất)

Để đảm bảo không bao giờ sót khách hàng, tôi đã mở rộng phạm vi kiểm tra thêm 2 tiêu chí nữa (Tổng cộng 4 tiêu chí). Hệ thống giờ sẽ kiểm tra khách hàng nếu họ thỏa mãn **BẤT KỲ ĐIỀU NÀO** sau đây:

1.  **Ngày Tạo**: Khách hàng tạo mới trong kỳ quỹ.
2.  **Ngày Chốt Sale (Won At)**: Khách hàng chốt đơn trong kỳ quỹ. (Fix trường hợp tạo từ tháng trước nhưng tháng này mới chốt).
3.  **Hoạt động Tài chính**: Có phát sinh giao dịch (Nợ/Thu/Chi/Mượn) trong kỳ quỹ. (Fix trường hợp khách cũ vay mượn thêm).
4.  **Được gán trực tiếp**: Khách hàng được gán thủ công vào kỳ quỹ này (qua trường `fund_period_id`).

### Về vấn đề "Không hiện Nợ quỹ" (Test 1, Test 2...):
-   Hệ thống tính toán nợ dựa trên **Giao dịch thực tế** (Phiếu Nợ, Phiếu Ứng, Phiếu Cho vay).
-   Nếu khách hàng đang ở bước "Đợi thu hồi tiền về" nhưng chưa có Phiếu Nợ nào được tạo trên hệ thống -> Số dư nợ sẽ là 0 -> Không hiện dòng "Nợ quỹ".
-   Điều này là đúng theo logic kế toán (Chưa ghi nợ thì chưa có nợ).
-   Tuy nhiên, hệ thống **VẪN CẢNH BÁO** khách hàng này vì họ chưa hoàn thành bước "Đã thu hồi tiền".

Bạn hãy kiểm tra lại nhé! Chắc chắn Yến My và các khách hàng khác sẽ xuất hiện đầy đủ.
