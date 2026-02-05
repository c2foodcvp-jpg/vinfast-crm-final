# 🛠️ SỬA LỖI THÔNG BÁO PUSH (LOCK SCREEN)

Bạn đang gặp lỗi **"Có Popup trong app nhưng không có thông báo ở màn hình khoá"**.
Nguyên nhân là do phần code gửi tin nhắn (Edge Function) trên Server chưa được cập nhật phiên bản mới nhất (có hỗ trợ iOS PWA).

Hãy làm theo đúng 3 bước sau để khắc phục triệt để.

---

## ✅ Bước 1: Cập nhật Webhook Database (Đã làm, nhưng hãy kiểm tra lại)

Bạn cần chạy đoạn SQL sau trong **Supabase Dashboard > SQL Editor** để đảm bảo database có quyền gọi Function gửi tin.

*(Nếu bạn đã chạy file `update_push_webhook_fix.sql` trước đó thì có thể bỏ qua bước này, nhưng chạy lại cũng không sao).*

```sql
-- Copy nội dung từ file: sql_updates/update_push_webhook_fix.sql
```

---

## ✅ Bước 2: Deploy Edge Function (QUAN TRỌNG NHẤT)

Code xử lý tin nhắn đã được sửa trên máy của bạn (`supabase/functions/send-push/index.ts`), nhưng nó **chưa được đẩy lên máy chủ**. Bạn cần đẩy nó lên.

Mở Terminal (VS Code) và chạy lệnh sau:

### Nếu bạn đã đăng nhập Supabase CLI:
```bash
npx supabase functions deploy send-push --no-verify-jwt
```

### Nếu bạn chưa đăng nhập hoặc gặp lỗi "Access token not provided":

1.  **Lấy Access Token**:
    -   Truy cập: https://supabase.com/dashboard/account/tokens
    -   Tạo một token mới (đặt tên: `CLI`).
    -   Copy chuỗi token đó.

2.  **Đăng nhập và Deploy**:
    Chạy các lệnh sau trong Terminal (thay thế `[YOUR_TOKEN]` bằng token vừa copy):

    ```bash
    npx supabase login
    # Dán token vào khi được hỏi, hoặc chạy: npx supabase login --token [YOUR_TOKEN]
    
    # Sau đó deploy lại
    npx supabase functions deploy send-push --no-verify-jwt
    ```

---

## ✅ Bước 3: Cấu hình Secret (Nếu chưa làm)

Edge Function cần file "Chìa khoá" của Firebase để gửi tin. Hãy đảm bảo bạn đã set secret trên Supabase Dashboard.

1.  Vào **Supabase Dashboard** > **Edge Functions** > chọn hàm `send-push` (hoặc vào phần Settings > Environment Variables).
2.  Thêm biến môi trường mới:
    -   Key: `FIREBASE_SERVICE_ACCOUNT`
    -   Value: *(Toàn bộ nội dung file JSON service-account của Firebase)*

> **Nếu không có file JSON này?** Bạn cần vào Firebase Console > Project Settings > Service Accounts > Generate New Private Key.

---

## 📱 Kiểm tra trên iPhone

Sau khi Deploy thành công (Bước 2):
1.  Mở lại App VinFast CRM trên iPhone.
2.  Thử dùng một tài khoản khác (hoặc nhờ Admin) gửi một thông báo mới.
3.  **Khoá màn hình** và chờ đợi. Thông báo sẽ xuất hiện sau 1-5 giây.

**Lưu ý**: Đảm bảo chế độ "Không làm phiền" (Focus Mode) đã tắt hoặc cho phép VinFast CRM.
