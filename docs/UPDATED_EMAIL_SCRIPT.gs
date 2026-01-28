// ============================================
// VINFAST CRM - EMAIL NOTIFICATION SCRIPT (UPDATED)
// Phiên bản: 2.0 (Fix lỗi Font & Ẩn SĐT)
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
    message: 'VinFast CRM Email Notifier v2 is running!',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// --- HÀM GỬI EMAIL ---
function sendAssignmentEmail(data) {
  const { recipientEmail, recipientName, customers, adminNote } = data;
  
  // Tạo danh sách khách hàng
  let customerList = '';
  customers.forEach((c, index) => {
    // LOGIC ẨN SỐ ĐIỆN THOẠI (Masking)
    // Chỉ hiện 4 số đầu, còn lại ẩn thành ******
    let phoneDisplay = 'N/A';
    if (c.phone) {
        if (c.phone.length > 4) {
            phoneDisplay = c.phone.substring(0, 4) + '******';
        } else {
            phoneDisplay = '***';
        }
    }

    customerList += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; font-weight: 500;">${c.name || 'Khách hàng'}</td>
        <td style="padding: 12px; color: #2563eb; font-weight: bold;">${phoneDisplay}</td>
        <td style="padding: 12px;">${c.interest || 'Chưa rõ'}</td>
        <td style="padding: 12px; color: #6b7280; font-size: 12px;">${c.location || ''}</td>
      </tr>
    `;
  });
  
  // FIX LỖI FONT: Xóa các Emoji ở Subject để tránh lỗi mã hóa
  const subject = `[VinFast CRM] Bạn được phân bổ ${customers.length} khách hàng mới!`;
  
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
          <!-- FIX LỖI FONT: Xóa Emoji xe hơi -->
          <h1>VinFast CRM</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Thông báo phân bổ khách hàng</p>
        </div>
        
        <div class="content">
          <p>Chào <strong>${recipientName}</strong>,</p>
          <p>Bạn vừa được phân bổ <strong style="color: #059669;">${customers.length} khách hàng mới</strong> trên hệ thống VinFast CRM.</p>
          
          <div class="info-box">
            <!-- FIX LỖI FONT: Xóa Emoji clipboard -->
            <h3>THÔNG TIN KHÁCH HÀNG</h3>
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
            <strong>Ghi chú từ Admin:</strong><br>
            ${adminNote}
          </div>
          ` : ''}
          
          <p style="color: #dc2626; font-weight: 500;">Vui lòng đăng nhập vào ứng dụng để chăm sóc ngay!</p>
          
          <div style="text-align: center;">
            <a href="${CONFIG.CRM_URL}" class="cta-button">Mở VinFast CRM</a>
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
