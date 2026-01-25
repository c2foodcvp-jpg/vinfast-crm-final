
# Hướng Dẫn Tích Hợp Gmail -> VinFast CRM

Tài liệu này hướng dẫn cách sử dụng Google Apps Script để tự động đẩy thông tin khách hàng từ Email vào trang "Chờ Phân Bổ" của CRM.

## Bước 1: Chuẩn bị trong Gmail
1. Tạo một Label mới trong Gmail, ví dụ: `CRM-Leads`.
2. Tạo Filter để tự động gán Label này cho các email từ nguồn Lead (ví dụ từ `wordpress@domain.com` hoặc tiêu đề chứa `[Lead Mới]`).

## Bước 2: Thiết lập Google Apps Script
1. Truy cập [script.google.com](https://script.google.com).
2. Tạo dự án mới: "VinFast CRM Connector".
3. Copy toàn bộ mã bên dưới vào file `Code.gs`.

### Mã Script (Code.gs)

```javascript
// --- CẤU HÌNH ---
const CONFIG = {
  SUPABASE_URL: 'https://ksrzwrizbqkjyzqhkfkn.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtzcnp3cml6YnFranl6cWhrZmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzkyMDcsImV4cCI6MjA4MjkxNTIwN30.8OxhjfjI0hqfYONKO4sC650KZO8uGNFtdwSV-2rmbEA',
  GMAIL_LABEL: 'CRM-Leads',
  PROCESSED_LABEL: 'CRM-Processed'
};

// --- HÀM XỬ LÝ CHÍNH ---
function processIncomingLeads() {
  const label = GmailApp.getUserLabelByName(CONFIG.GMAIL_LABEL);
  const processedLabel = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
  
  if (!label) {
    Logger.log("❌ LỖI: Không tìm thấy Label tên là '" + CONFIG.GMAIL_LABEL + "'. Hãy kiểm tra kỹ tên Label trong Gmail.");
    return;
  }

  const threads = label.getThreads(0, 10);
  Logger.log("Admin: Tìm thấy " + threads.length + " email có nhãn '" + CONFIG.GMAIL_LABEL + "'");
  
  if (threads.length === 0) return;

  threads.forEach(thread => {
    const messages = thread.getMessages();
    const message = messages[messages.length - 1]; // Lấy email mới nhất trong luồng (quan trọng nếu email bị gộp thread)
    const body = message.getPlainBody();
    const subject = message.getSubject();

    Logger.log("---------------------------------------------------");
    Logger.log("📧 Đang xử lý email: " + subject);

    // Parse nội dung
    const parsed = parseEmailBody(body);
    
    // Fallback: Nếu không tìm thấy tên trong body, thử lấy từ Subject
    // Subject thường là: "[Tên Khách] - SĐT - ..."
    if (!parsed.name || parsed.name === '*') {
       const subjectMatch = subject.match(/^\[([^\]]+)\]/);
       if (subjectMatch) parsed.name = subjectMatch[1];
    }
    
    const leadData = {
      name: parsed.name || 'Khách Vãng Lai',
      phone: parsed.phone || '',
      location: parsed.address || '', 
      interest: parsed.carModel || 'Chưa rõ', 
      source: 'MKT Group',
      status: 'new',
      created_at: new Date().toISOString(),
      recare_date: new Date().toISOString().split('T')[0], // Ngày Chăm Sóc Tiếp Theo = Hôm nay
      sales_rep: null
    };
    
    Logger.log("🔍 Dữ liệu đọc được: " + JSON.stringify(leadData));

    // Kiểm tra và chuẩn hóa SĐT
    if (leadData.phone) {
      const cleanPhone = leadData.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 9) {
        leadData.phone = cleanPhone.length === 9 ? '0' + cleanPhone : cleanPhone;
        
        Logger.log("✅ SĐT hợp lệ: " + leadData.phone + ". Kiểm tra trùng...");
        
        // KIỂM TRA TRÙNG SĐT TRƯỚC KHI TẠO
        const existingCustomer = checkDuplicatePhone(leadData.phone);
        if (existingCustomer) {
          Logger.log("⚠️ TRÙNG SĐT! Khách hàng đã tồn tại:");
          Logger.log("   - Tên: " + existingCustomer.name);
          Logger.log("   - TVBH đang chăm sóc: " + (existingCustomer.sales_rep || "Chưa phân bổ"));
          
          // === TẠO INTERACTION VÀO KHÁCH HÀNG CŨ ĐỂ ADMIN/MOD BIẾT ===
          const duplicateNoteContent = `⚠️ [LEAD MỚI TRÙNG] Khách hàng liên hệ lại qua Email Form.
---
📧 Thông tin từ Email mới:
- Tên đăng ký: ${leadData.name}
- Dòng xe quan tâm: ${parsed.carModel || 'Chưa rõ'}
- Địa chỉ: ${parsed.address || 'Không có'}
- Nhu cầu: ${parsed.demand || 'Không có'}
- Nguồn Form: ${parsed.sourceUrl || 'N/A'}
- Tiêu đề Email: ${subject}
---
⚡ Hãy liên hệ lại khách hàng này!`;
          
          createInteraction(existingCustomer.id, duplicateNoteContent);
          Logger.log("📝 Đã tạo ghi chú vào khách hàng cũ để thông báo.");
          
          // === CẬP NHẬT NGÀY CHĂM SÓC TIẾP THEO = HÔM NAY ===
          updateCustomerRecareDate(existingCustomer.id);
          Logger.log("📅 Đã cập nhật Ngày Chăm Sóc Tiếp Theo = Hôm nay.");
          
          // Đánh dấu đã xử lý
          thread.removeLabel(label);
          thread.addLabel(processedLabel);
          return; // Bỏ qua việc tạo khách mới
        }
        
        // Gửi sang Supabase để tạo Customer
        const newCustomerId = createCustomer(leadData);
        
        if (newCustomerId) {
          // TẠO TIẾP INTERACTION (GHI CHÚ)
          const noteContent = `[Nhu Cầu]: ${parsed.demand || 'Không có'}\n[Nguồn Form]: ${parsed.sourceUrl || 'N/A'}\n[Tiêu đề Email]: ${subject}`;
          createInteraction(newCustomerId, noteContent);
          
          // Hoàn tất
          thread.removeLabel(label);
          thread.addLabel(processedLabel);
          Logger.log("🎉 THÀNH CÔNG TOÀN DIỆN CHO KHÁCH: " + leadData.name);
        }
      } else {
        Logger.log("⚠️ SĐT quá ngắn sau khi lọc số: " + cleanPhone);
      }
    } else {
      Logger.log("⚠️ KHÔNG TÌM THẤY SĐT. Regex thất bại.");
    }
  });
}

// --- PARSER ---
function parseEmailBody(body) {
  const lines = body.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const data = { name: '', phone: '', address: '', carModel: '', demand: '', sourceUrl: '' };
  
  let isCapturingDemand = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i+1] || '';

    // 1. Tên Bạn / Họ và tên / Họ tên
    if (line.match(/(?:Tên Bạn|Họ và tên|Họ tên|Name)/i)) {
       // Loại bỏ TẤT CẢ các ký tự trước và bao gồm keyword + dấu * : - 
       let cleanName = line.replace(/.*(?:Tên Bạn|Họ và tên|Họ tên|Name)[\s\*\:\-]*/i, '').trim();
       
       // Bỏ dấu * : - còn sót lại ở đầu
       cleanName = cleanName.replace(/^[\*\:\-\s]+/, '');
       
       if (cleanName.length > 1) {
          data.name = cleanName;
       } else if (nextLine && nextLine.length > 2 && !nextLine.match(/^(Số|SĐT|Phone|Địa)/i)) {
          // Lấy dòng tiếp theo nếu nó không phải là tiêu đề khác
          data.name = nextLine;
       }
    }
    
    // 2. Số Điện Thoại
    else if (line.match(/(?:Số Điện Thoại|SĐT|Phone|Tel)[:\s]?/i)) {
       const inlineMatch = line.match(/[\d\.\s]{9,}/);
       if (inlineMatch && inlineMatch[0].replace(/\D/g,'').length > 8) data.phone = inlineMatch[0].trim();
       else if (nextLine.match(/[\d\.\s]{9,}/)) data.phone = nextLine.trim();
    }
    
    // 3. Địa Chỉ / Khu Vực
    else if (line.match(/(?:Địa Chỉ|Khu vực|Address)/i)) {
        const inline = line.replace(/.*(?:Địa Chỉ|Khu vực|Address)[\s\*\:\-]*/i, '').trim();
        if (inline.length > 1) {
           data.address = inline;
        } else if (nextLine && nextLine.length > 2 && !nextLine.match(/^(Dòng|Phiên|Số|SĐT)/i)) {
           data.address = nextLine;
        }
    }
    
    // 4. Dòng Xe
    else if (line.match(/(?:Phiên Bản|Lựa chọn dòng xe|Dòng Xe Quan Tâm)/i)) {
         data.carModel = nextLine;
    }
    
    // 5. Form Gửi từ
    else if (line.match(/Form Gửi từ/i)) {
      isCapturingDemand = false;
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      if (urlMatch) data.sourceUrl = urlMatch[0];
      else if (nextLine.match(/https?:\/\//)) data.sourceUrl = nextLine;
    }
    
    // 6. Nhu cầu
    else if (line.match(/Nhu cầu/i)) {
      isCapturingDemand = true;
      continue;
    }
    
    // Capture Demand Blocks
    if (isCapturingDemand) {
      if (line.match(/(?:Form Gửi từ|Đây là Email|IP:)/i)) {
        isCapturingDemand = false;
      } else {
        data.demand += line + '\n';
      }
    }
  }

  // FALLBACK Phone Scan
  if (!data.phone) {
    const allText = lines.join('\n');
    const match = allText.match(/(?:^|\D)(0\d{8,10})(?:\D|$)/);
    if (match) data.phone = match[1];
  }

  return data;
}

// --- API FUNCTIONS ---

// 1. Tạo Customer -> Trả về ID (string) hoặc null
function createCustomer(data) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/customers`;
  const options = {
    method: 'post',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation' // Quan trọng: Đổi thành representation để nhận về DATA sau khi insert
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    if (code >= 200 && code < 300) {
      // Parse JSON trả về để lấy ID
      const result = JSON.parse(response.getContentText());
      if (result && result.length > 0) {
         return result[0].id; // Trả về UUID của customer mới
      }
      return null;
    } else {
      const errorBody = response.getContentText();
      Logger.log("❌ LỖI TẠO KHÁCH (" + code + "): " + errorBody);
      return null;
    }
  } catch (e) {
    Logger.log("❌ Lỗi mạng: " + e.toString());
    return null;
  }
}

// 2. Tạo Interaction (Ghi chú)
function createInteraction(customerId, content) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/interactions`;
  const payload = {
    customer_id: customerId,
    type: 'note', // Loại interaction là ghi chú
    content: content,
    created_at: new Date().toISOString(),
    // user_id: Không bắt buộc nếu DB cho phép null, hoặc để null nếu là System
    user_id: null 
  };
  
  const options = {
    method: 'post',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
        Logger.log("✅ Đã tạo ghi chú (Interaction) thành công.");
    } else {
        Logger.log("⚠️ Lỗi tạo ghi chú: " + response.getContentText());
    }
  } catch (e) {
     Logger.log("⚠️ Lỗi mạng khi tạo ghi chú: " + e.toString());
  }
}

function getOrCreateLabel(name) {
  let label = GmailApp.getUserLabelByName(name);
  if (!label) label = GmailApp.createLabel(name);
  return label;
}

// 3. Kiểm tra SĐT đã tồn tại -> Trả về {id, name, sales_rep} hoặc null
function checkDuplicatePhone(phone) {
  // Supabase REST API: GET với filter
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/customers?phone=eq.${phone}&select=id,name,sales_rep`;
  const options = {
    method: 'get',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data && data.length > 0) {
        return data[0]; // Trả về khách hàng đầu tiên tìm được
      }
    }
    return null; // Không trùng
  } catch (e) {
    Logger.log("Lỗi khi kiểm tra trùng SĐT: " + e.toString());
    return null; // Coi như không trùng để tiếp tục
  }
}

// 4. Cập nhật Ngày Chăm Sóc Tiếp Theo cho khách hàng
function updateCustomerRecareDate(customerId) {
  // Lấy ngày hôm nay theo định dạng YYYY-MM-DD
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`;
  const options = {
    method: 'patch',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify({
      recare_date: todayStr
    }),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      return true;
    } else {
      Logger.log("Lỗi cập nhật recare_date: " + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log("Lỗi mạng khi cập nhật recare_date: " + e.toString());
    return false;
  }
}
```

## Bước 3: Cài đặt Trigger (Kích hoạt tự động)
1. Trong Google Apps Script, click biểu tượng đồng hồ (Triggers).
2. Chọn "Add Trigger".
3. Function: `processIncomingLeads`.
4. Event Source: **Time-driven**.
5. Type: **Minutes timer** -> **Every 5 minutes**.
6. Lưu lại.

## Bước 4: Kiểm tra
1. Gửi một email mẫu đến Gmail của bạn đúng định dạng.
2. Chờ 5 phút (hoặc chạy thủ công hàm `processIncomingLeads` trong Script Editor).
3. Vào trang CRM -> **Leads Email (Chờ)** để xem kết quả.
