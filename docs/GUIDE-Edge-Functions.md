# Hướng Dẫn Triển Khai Supabase Edge Function (Bảo Mật Email)

Việc triển khai không quá khó, nhưng yêu cầu bạn phải dùng **Terminal** (dòng lệnh) và cài đặt công cụ **Supabase CLI**.

## Quy trình tóm tắt (4 Bước)

1.  **Cài đặt**: Cài Supabase CLI.
2.  **Đăng nhập**: Login vào tài khoản Supabase từ dòng lệnh.
3.  **Hàm**: Tạo và viết code cho hàm `send-email`.
4.  **Triển khai**: Đẩy hàm lên Cloud.

---

## Chi tiết từng bước

### Bước 1: Cài đặt Supabase CLI

Mở Terminal (PowerShell hoặc CMD) và chạy lệnh sau (yêu cầu máy có cài `npm` hoặc `winget`):

**Cách dễ nhất (dùng Admin PowerShell):**
```powershell
winget install Supabase.CLI
```

Hoặc dùng NPM:
```bash
npm install -g supabase
```

### Bước 2: Đăng nhập & Khởi tạo

Tại thư mục dự án (`d:\CRM-VIN\vinfast-crm-final`), chạy:

```bash
supabase login
```
*(Nó sẽ mở trình duyệt, bạn bấm nút Confirm là xong)*

Sau đó liên kết với dự án trên Cloud (ID dự án lấy trên URL dashboard, ví dụ `ksrzwrizbqkjyzqhkfkn`):
```bash
supabase link --project-ref ksrzwrizbqkjyzqhkfkn
```
*(Nếu nó hỏi Password DB thì nhập, hoặc chọn n để skip nếu chỉ deploy function)*

### Bước 3: Tạo File Function

Chạy lệnh tạo khung:
```bash
supabase functions new send-email
```

Lệnh này tạo file: `supabase/functions/send-email/index.ts`.
Bạn chỉ cần **Copy & Paste** đoạn code sau vào file đó:

```typescript
// supabase/functions/send-email/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Xử lý CORS (cho phép trình duyệt gọi)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Lấy URL bí mật từ Vault (Server-side)
    // Bạn phải set secret này trên Dashboard hoặc CLI
    const GOOGLE_SCRIPT_URL = Deno.env.get('GOOGLE_SCRIPT_URL')
    if (!GOOGLE_SCRIPT_URL) {
      throw new Error('Chưa cấu hình GOOGLE_SCRIPT_URL trong Secrets!')
    }

    // 3. Đọc dữ liệu từ Client gửi lên
    const { recipientEmail, recipientName, customers, adminNote } = await req.json()

    // 4. Gọi sang Google Script (Proxy)
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail, recipientName, customers, adminNote }),
    })

    const data = await response.json()

    // 5. Trả kết quả về cho React App
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
```

### Bước 4: Triển khai (Deploy)

Đẩy code lên mây:
```bash
supabase functions deploy send-email
```

Đặt biến môi trường (URL bí mật của Google Form):
```bash
supabase secrets set GOOGLE_SCRIPT_URL="https://script.google.com/macros/s/XXXXX/exec"
```

## Kết quả

Sau khi làm xong, thay vì gọi Google URL trực tiếp trong code React, bạn sẽ gọi:
```javascript
supabase.functions.invoke('send-email', { body: { ... } })
```

Khách hàng (Client) sẽ chỉ thấy gọi đến `.../functions/v1/send-email`, không bao giờ biết địa chỉ thực của Google Script.
