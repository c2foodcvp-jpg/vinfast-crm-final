
// ============================================
// VINFAST CRM - DAILY MORNING REPORT SCRIPT
// Tự động gửi báo cáo lúc 6:00 sáng
// ============================================

const CONFIG = {
  CRM_URL: 'https://vinfast-crm-final.vercel.app', // Cập nhật URL chính xác của bạn
  SUPABASE_URL: PropertiesService.getScriptProperties().getProperty('SUPABASE_URL'),
  SUPABASE_KEY: PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY')
};

// --- MAIN FUNCTION: CHẠY LÚC 6:00 SÁNG ---
function sendDailyReport() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    Logger.log('❌ Lỗi: Chưa cấu hình SUPABASE_URL hoặc SUPABASE_KEY trong Script Properties');
    return;
  }

  Logger.log('🔄 Bắt đầu chạy báo cáo ngày...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset về đầu ngày 00:00:00
  
  // 1. Lấy danh sách nhân viên active
  const profiles = fetchSupabase('profiles', 'select=id,full_name,email&status=eq.active');
  if (!profiles || profiles.length === 0) {
    Logger.log('⚠️ Không tìm thấy nhân viên nào.');
    return;
  }

  // 2. Lấy danh sách khách hàng đang chăm sóc (Chưa chốt/hủy)
  // Lọc: status không phải 'Chốt đơn' và không phải 'Đã hủy'
  // Lưu ý: URL Encoding cho query params
  const customers = fetchSupabase('customers', 'select=id,name,phone,recare_date,is_long_term,long_term_return_date,is_special_care,creator_id,sales_rep,status,interest&status=neq.Won&status=neq.Lost&status=neq.Chốt đơn&status=neq.Đã hủy');
  
  if (!customers) {
    Logger.log('⚠️ Không lấy được dữ liệu khách hàng.');
    return;
  }

  Logger.log(`📊 Đã tải ${profiles.length} nhân viên và ${customers.length} khách hàng.`);

  // 3. Xử lý dữ liệu cho từng nhân viên
  profiles.forEach(staff => {
    if (!staff.email) return;

    // Lọc khách hàng của nhân viên này (dựa vào creator_id hoặc match tên sales_rep)
    const staffCustomers = customers.filter(c => {
        // Ưu tiên check ID
        if (c.creator_id === staff.id) return true;
        // Fallback check tên (nếu hệ thống cũ lỡ lưu tên)
        if (c.sales_rep && staff.full_name && 
            normalizeString(c.sales_rep) === normalizeString(staff.full_name)) {
            return true;
        }
        return false;
    });

    if (staffCustomers.length === 0) return;

    // Phân loại
    const report = {
      dueToday: [],
      overdue: [],
      longTermExpired: []
    };

    staffCustomers.forEach(c => {
      // 0. EXCLUSION RULES
      // Loại trừ Khách Chốt, Hủy, và CS Đặc biệt
      if (['Won', 'Chốt đơn', 'Lost', 'Đã hủy'].includes(c.status) || c.is_special_care) {
          return;
      }

      // 3.1 Check Long Term (CS Dài hạn)
      if (c.is_long_term && c.long_term_return_date) {
        const returnDate = parseDate(c.long_term_return_date); // Parse YYYY-MM-DD
        
        // YÊU CẦU: Chỉ tính là "Hết hạn CS dài hạn" nếu ngày return CHÍNH LÀ HÔM NAY
        // (Không tính quá hạn cho CS Dài hạn)
        if (isSameDate(returnDate, today)) {
           report.longTermExpired.push(c);
        }
      } 
      // 3.2 Check Normal Recare (CS Thường)
      else if (c.recare_date && !c.is_long_term) {
        const recareDate = parseDate(c.recare_date);
        
        if (isSameDate(recareDate, today)) {
          report.dueToday.push(c);
        } else if (recareDate < today) {
          // YÊU CẦU: Khách dài hạn (đã check ở trên) và khách đặc biệt (đã check ở bước 0) không vào đây
          report.overdue.push(c);
        }
      }
    });

    // Chỉ gửi email nếu có việc cần làm
    if (report.dueToday.length > 0 || report.overdue.length > 0 || report.longTermExpired.length > 0) {
      Logger.log(`📧 Gửi email cho ${staff.full_name} (${staff.email})...`);
      sendEmailToStaff(staff, report);
    }
  });
  
  Logger.log('✅ Hoàn tất gửi báo cáo.');
}

// --- HÀM GỬI EMAIL ---
function sendEmailToStaff(staff, report) {
  const subject = `📅 [VinFast CRM] Nhắc việc ngày ${formatDateVN(new Date())}`;
  
  const totalTasks = report.dueToday.length + report.overdue.length + report.longTermExpired.length;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', sans-serif; color: #1f2937; line-height: 1.5; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #ffffff; }
        .stat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .stat-box { padding: 10px; border-radius: 8px; text-align: center; }
        .stat-box.red { background: #fee2e2; color: #991b1b; }
        .stat-box.yellow { background: #fef3c7; color: #92400e; }
        .stat-box.blue { background: #dbeafe; color: #1e40af; }
        .stat-number { font-size: 24px; font-weight: bold; display: block; }
        .stat-label { font-size: 12px; text-transform: uppercase; font-weight: 600; }
        .cta-btn { display: inline-block; background: #2563eb; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 20px; }
        .footer { background: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
        th { text-align: left; color: #6b7280; font-size: 11px; padding: 8px; border-bottom: 2px solid #f3f4f6; }
        td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
        .tag { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        .tag-red { background: #fee2e2; color: #991b1b; }
        .tag-yellow { background: #fef3c7; color: #92400e; }
        .tag-blue { background: #dbeafe; color: #1e40af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin:0;">VinFast CRM - Báo Cáo Sáng</h2>
          <p style="margin:5px 0 0; opacity:0.9;">Xin chào, ${staff.full_name}</p>
        </div>
        
        <div class="content">
          <p>Dưới đây là tổng hợp khách hàng cần chăm sóc hôm nay:</p>
          
          <div class="stat-grid">
            <div class="stat-box yellow">
              <span class="stat-number">${report.dueToday.length}</span>
              <span class="stat-label">Đến hạn CS</span>
            </div>
            <div class="stat-box red">
              <span class="stat-number">${report.overdue.length}</span>
              <span class="stat-label">Quá hạn</span>
            </div>
            <div class="stat-box blue">
              <span class="stat-number">${report.longTermExpired.length}</span>
              <span class="stat-label">Hết hạn dài hạn</span>
            </div>
          </div>

          ${renderTableSection('🔥 KHÁCH ĐẾN HẠN HÔM NAY', report.dueToday)}
          ${renderTableSection('⚠️ KHÁCH ĐÃ QUÁ HẠN', report.overdue)}
          ${renderTableSection('🔄 KHÁCH HẾT HẠN CS DÀI HẠN', report.longTermExpired)}

          <div style="text-align: center;">
            <a href="${CONFIG.CRM_URL}" class="cta-btn">Truy cập CRM ngay</a>
          </div>
        </div>
        
        <div class="footer">
          Email tự động được gửi lúc 06:00 sáng mỗi ngày.<br>
          VinFast CRM System v2.0
        </div>
      </div>
    </body>
    </html>
  `;

  GmailApp.sendEmail(staff.email, subject, '', {
    htmlBody: htmlBody,
    name: 'VinFast CRM Bot'
  });
}

function renderTableSection(title, list) {
  if (!list || list.length === 0) return '';
  
  // Chỉ hiện tối đa 5 khách để email không quá dài
  const displayList = list.slice(0, 5);
  const remaining = list.length - 5;
  
  let rows = displayList.map(c => `
    <tr>
      <td><strong>${c.name}</strong><br><span style="color:#6b7280">${c.phone.substring(0,4)}******</span></td>
      <td>${c.interest || '---'}</td>
      <td>${c.status}</td>
    </tr>
  `).join('');

  if (remaining > 0) {
    rows += `<tr><td colspan="3" style="text-align:center; color:#6b7280; font-style:italic;">...và ${remaining} khách hàng khác</td></tr>`;
  }

  return `
    <h3 style="margin: 20px 0 10px; font-size: 14px; color: #374151; border-bottom: 2px solid #eee; padding-bottom: 5px;">${title}</h3>
    <table>
      <thead>
        <tr>
          <th>KHÁCH HÀNG</th>
          <th>DÒNG XE</th>
          <th>TRẠNG THÁI</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// --- HELPER FUNCTIONS ---

function fetchSupabase(table, queryParams) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${table}?${queryParams}`;
  const options = {
    method: 'get',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return JSON.parse(response.getContentText());
    } else {
      Logger.log(`❌ Request failed (${code}): ${response.getContentText()}`);
      return null;
    }
  } catch (e) {
    Logger.log(`❌ Exception: ${e.toString()}`);
    return null;
  }
}

function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function parseDate(dateStr) {
  // Input: YYYY-MM-DD
  if (!dateStr) return new Date(0); // Epoch
  const parts = dateStr.split('-');
  // Note: Month is 0-indexed in JS Date
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function isSameDate(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function formatDateVN(date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

// --- SETUP INSTRUCTIONS DUMMY FUNCTION ---
function _SETUP_GUIDE() {
  Logger.log(`
    === HƯỚNG DẪN CÀI ĐẶT ===
    1. Vào Project Settings (Biểu tượng bánh răng)
    2. Kéo xuống mục "Script Properties"
    3. Thêm 2 property:
       - SUPABASE_URL: URL Supabase của bạn (ví dụ https://xyz.supabase.co)
       - SUPABASE_KEY: Service Role Key (để bypass RLS nếu cần) hoặc Anon Key
    4. Vào Triggers (Biểu tượng đồng hồ)
    5. Thêm Trigger mới:
       - Function: sendDailyReport
       - Event Source: Time-driven
       - Type: Day timer
       - Time: 6am to 7am
  `);
}
