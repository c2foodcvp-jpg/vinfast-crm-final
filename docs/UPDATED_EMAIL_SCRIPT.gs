// ============================================
// VINFAST CRM - EMAIL NOTIFICATION SCRIPT
// Phiên bản: 4.1 (Fix Font Encoding & Mask Phone)
// ============================================

const CONFIG = {
  CRM_URL: 'https://crm-vf.vercel.app',
  SENDER_NAME: 'VinFast CRM System'
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // CASE 1: Generic Email (Báo giá, Tính lãi)
    if (data.type === 'send_email') {
       if (!data.recipientEmail || !data.subject || !data.htmlBody) {
         return createJSONOutput(false, 'Missing required fields');
       }
       
       const options = {
         htmlBody: data.htmlBody,
         name: CONFIG.SENDER_NAME,
         attachments: []
       };

       if (data.attachments && Array.isArray(data.attachments)) {
         options.attachments = data.attachments.map(att => {
           const decoded = Utilities.base64Decode(att.content);
           return Utilities.newBlob(decoded, att.mimeType, att.fileName);
         });
       }
       
       GmailApp.sendEmail(data.recipientEmail, data.subject, '', options);
       return createJSONOutput(true, 'Email sent successfully with attachments');
    }

    // CASE 2: Assignment Email (Legacy & Portal)
    if (data.recipientEmail && data.recipientName && data.customers) {
      const result = sendAssignmentEmail(data);
      return createJSONOutput(true, 'Assignment email sent', { emailId: result });
    }
    
    return createJSONOutput(false, 'Invalid request format');
    
  } catch (error) {
    return createJSONOutput(false, error.toString());
  }
}

function createJSONOutput(success, message, extra = {}) {
  return ContentService.createTextOutput(JSON.stringify({
    success,
    message,
    ...extra
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'VinFast CRM Email Notifier v4.1 (Fix Font) is running!',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// --- HÀM GỬI EMAIL PHÂN BỔ (Đã Fix Lỗi Font & SĐT) ---
function sendAssignmentEmail(data) {
  const { recipientEmail, recipientName, customers, adminNote } = data;
  
  // Tạo danh sách khách hàng
  let customerList = '';
  customers.forEach((c) => {
    // LOGIC ẨN SỐ ĐIỆN THOẠI (Masking)
    // Giữ 4 số đầu, 3 số cuối -> 0912 *** 789
    // Hoặc Giữ 4 số đầu -> 0912 ******
    
    let phoneDisplay = 'N/A';
    if (c.phone) {
        if (c.phone.length > 4) {
            // Cách 1: 0912******
            phoneDisplay = c.phone.substring(0, 4) + '******';
        } else {
            phoneDisplay = '***';
        }
    }

    customerList += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px; font-weight: 500; font-family: Arial, sans-serif;">${c.name || 'Khách hàng'}</td>
        <td style="padding: 12px; color: #2563eb; font-weight: bold; font-family: Arial, sans-serif;">${phoneDisplay}</td>
        <td style="padding: 12px; color: #6b7280; font-size: 12px; font-family: Arial, sans-serif;">${c.interest || 'Chưa rõ'}</td>
        <td style="padding: 12px; color: #6b7280; font-size: 12px; font-family: Arial, sans-serif;">${c.location || ''}</td>
      </tr>
    `;
  });
  
  // FIX LỖI FONT: Xóa Emoji khỏi Subject
  const subject = `[VinFast CRM] Ban duoc phan bo ${customers.length} khach hang moi`; // Tiếng Việt không dấu ở tiêu đề cho an toàn tuyệt đối
  
  // HTML Body an toàn font
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        
        <!-- Header Xanh VinFast -->
        <div style="background-color: #059669; padding: 20px; text-align: center; color: white;">
           <h1 style="margin: 0; font-size: 24px; font-family: Arial, sans-serif;">VINFAST CRM</h1>
           <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Thong bao phan bo khach hang</p>
        </div>
        
        <div style="padding: 24px; background-color: #ffffff;">
          <p>Chao <strong>${recipientName}</strong>,</p>
          <p>Ban vua duoc phan bo <strong style="color: #059669;">${customers.length} khach hang moi</strong> tren he thong.</p>
          
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0; overflow: hidden;">
            <div style="padding: 10px 15px; background-color: #f3f4f6; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #374151; font-size: 14px;">
               THONG TIN KHACH HANG
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #ffffff;">
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Ten Khach</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">So Dien Thoai</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Dong Xe</th>
                  <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280;">Khu Vuc</th>
                </tr>
              </thead>
              <tbody>
                ${customerList}
              </tbody>
            </table>
          </div>
          
          ${adminNote ? `
          <div style="background-color: #fffbeb; border: 1px solid #fcd34d; padding: 12px; border-radius: 6px; margin-bottom: 20px; color: #92400e; font-size: 14px;">
            <strong>Ghi chu tu Admin:</strong><br>${adminNote}
          </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${CONFIG.CRM_URL}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Truy cap CRM ngay</a>
          </div>
        </div>
        
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0;">Email duoc gui tu dong tu he thong VinFast CRM</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  GmailApp.sendEmail(recipientEmail, subject, '', {
    htmlBody: htmlBody,
    name: CONFIG.SENDER_NAME
  });
  
  return 'sent';
}
