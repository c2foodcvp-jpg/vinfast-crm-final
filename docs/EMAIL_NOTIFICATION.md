# Hướng Dẫn Gửi Email Thông Báo Khi Phân Bổ Khách

Tài liệu này hướng dẫn cách thiết lập Google Apps Script để gửi email cho nhân viên khi được phân bổ khách từ trang "Lead Email (Chờ)".

## Bước 1: Tạo Google Apps Script (Web App)

1. Đăng nhập Gmail **cskh.vinfasthcm@gmail.com**
2. Truy cập [script.google.com](https://script.google.com)
3. Tạo dự án mới: "VinFast CRM Email Notifier"
4. Copy toàn bộ mã bên dưới vào file `Code.gs`

### Mã Script (Code.gs)

```javascript
// ============================================
// VINFAST CRM - EMAIL NOTIFICATION SCRIPT
// Gửi email cho nhân viên khi được phân bổ khách
// ============================================

const CONFIG = {
  CRM_URL: 'https://crm-vf.vercel.app', // URL hệ thống CRM
  SENDER_NAME: 'VinFast CRM System'
};

// --- HÀM XỬ LÝ WEB APP ---
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (!data.recipientEmail || !data.recipientName || !data.customers) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required fields'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Gửi email
    const result = sendAssignmentEmail(data);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      emailId: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Hỗ trợ GET request để test
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'VinFast CRM Email Notifier is running!',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// --- HÀM GỬI EMAIL ---
function sendAssignmentEmail(data) {
  const { recipientEmail, recipientName, customers, adminNote } = data;
  
  // Tạo danh sách khách hàng
  let customerList = '';
  customers.forEach((c, index) => {
    customerList += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; font-weight: 500;">${c.name || 'Khách hàng'}</td>
        <td style="padding: 12px; color: #2563eb; font-weight: bold;">${c.phone || 'N/A'}</td>
        <td style="padding: 12px;">${c.interest || 'Chưa rõ'}</td>
        <td style="padding: 12px; color: #6b7280; font-size: 12px;">${c.location || ''}</td>
      </tr>
    `;
  });
  
  const subject = `🎯 [VinFast CRM] Bạn được phân bổ ${customers.length} khách hàng mới!`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 24px; border-radius: 16px 16px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; }
        .content { background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; }
        .info-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; padding: 16px; margin: 16px 0; }
        .info-box h3 { margin: 0 0 12px 0; color: #166534; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
        .cta-button { display: inline-block; background: #2563eb; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; margin: 16px 0; }
        .cta-button:hover { background: #1d4ed8; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; padding: 16px; border-top: 1px solid #e5e7eb; }
        .admin-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚗 VinFast CRM</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Thông báo phân bổ khách hàng</p>
        </div>
        
        <div class="content">
          <p>Chào <strong>${recipientName}</strong>,</p>
          <p>Bạn vừa được phân bổ <strong style="color: #059669;">${customers.length} khách hàng mới</strong> trên hệ thống VinFast CRM.</p>
          
          <div class="info-box">
            <h3>📋 THÔNG TIN KHÁCH HÀNG</h3>
            <table>
              <thead>
                <tr>
                  <th>Tên khách</th>
                  <th>Số điện thoại</th>
                  <th>Dòng xe quan tâm</th>
                  <th>Khu vực</th>
                </tr>
              </thead>
              <tbody>
                ${customerList}
              </tbody>
            </table>
          </div>
          
          ${adminNote ? `
          <div class="admin-note">
            <strong>📝 Ghi chú từ Admin:</strong><br>
            ${adminNote}
          </div>
          ` : ''}
          
          <p style="color: #dc2626; font-weight: 500;">⚡ Vui lòng đăng nhập vào ứng dụng để chăm sóc ngay!</p>
          
          <div style="text-align: center;">
            <a href="${CONFIG.CRM_URL}" class="cta-button">🔗 Mở VinFast CRM</a>
          </div>
        </div>
        
        <div class="footer">
          <p>Trân trọng,<br><strong>VinFast CRM System</strong></p>
          <p style="font-size: 11px; color: #9ca3af;">Email này được gửi tự động từ hệ thống CRM.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Gửi email
  GmailApp.sendEmail(recipientEmail, subject, '', {
    htmlBody: htmlBody,
    name: CONFIG.SENDER_NAME
  });
  
  Logger.log('✅ Đã gửi email tới: ' + recipientEmail);
  return 'sent';
}

// --- HÀM TEST THỦ CÔNG ---
function testSendEmail() {
  const testData = {
    recipientEmail: 'test@example.com', // Thay bằng email thật để test
    recipientName: 'Phạm Kiệt',
    customers: [
      { name: 'Nguyễn Văn A', phone: '0901234567', interest: 'VF8', location: 'Quận 1' },
      { name: 'Trần Thị B', phone: '0987654321', interest: 'VF9', location: 'Quận 7' }
    ],
    adminNote: 'Khách hàng VIP, ưu tiên liên hệ sáng mai.'
  };
  
  sendAssignmentEmail(testData);
  Logger.log('Test email sent!');
}
```

## Bước 2: Deploy Web App

1. Trong Google Apps Script, click **Deploy** → **New deployment**
2. Chọn type: **Web app**
3. Cấu hình:
   - **Description**: VinFast CRM Email Notifier
   - **Execute as**: **Me** (cskh.vinfasthcm@gmail.com)
   - **Who has access**: **Anyone** (để CRM có thể gọi)
4. Click **Deploy**
5. **Copy URL** của Web App (ví dụ: `https://script.google.com/macros/s/AKfycbx.../exec`)

## Bước 3: Cấu hình trong CRM

Sau khi có URL Web App, bạn cần thêm vào CRM:

1. Vào trang **Cấu hình** (Admin)
2. Tìm mục **Email Script URL**
3. Dán URL Web App vào đó

Hoặc Admin có thể cập nhật trực tiếp trong `app_settings`:
```sql
INSERT INTO app_settings (key, value) 
VALUES ('email_script_url', 'https://script.google.com/macros/s/AKfycbx.../exec')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## Bước 4: Test

1. Vào trang **Lead Email (Chờ)**
2. Chọn 1-2 khách hàng
3. Chọn nhân viên và click **Phân bổ**
4. Kiểm tra email nhân viên (spam folder nếu cần)

## Lưu ý

- Email được gửi bởi **cskh.vinfasthcm@gmail.com**
- Giới hạn gửi: 100 emails/ngày (Google free tier)
- Nếu cần gửi nhiều hơn, liên hệ Admin để upgrade

---

## SQL Migration (Chạy một lần)

Nếu gặp lỗi, chạy SQL sau trong Supabase SQL Editor:

```sql
-- 1. Thêm cột is_acknowledged để track xác nhận từ nhân viên
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_acknowledged BOOLEAN DEFAULT TRUE;

-- 2. Thêm email_script_url vào app_settings (thay URL thật của bạn)
INSERT INTO app_settings (key, value) 
VALUES ('email_script_url', 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## Troubleshooting

### Email không gửi được?
1. Kiểm tra `email_script_url` trong `app_settings` đã đúng chưa
2. Kiểm tra nhân viên có email trong profile không
3. Xem Console log của trình duyệt (F12)
4. Vào Google Apps Script → Executions để xem logs

### CORS Error?
- Đảm bảo đã deploy với "Who has access: Anyone"
- CRM sử dụng `mode: 'no-cors'` nên không thể đọc response, nhưng email vẫn được gửi

### Email vào Spam?
- Gmail của Google Apps Script thường không bị spam
- Nếu có, yêu cầu nhân viên whitelist email `cskh.vinfasthcm@gmail.com`

