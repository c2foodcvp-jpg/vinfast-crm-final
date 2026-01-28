# Hướng Dẫn Gửi Email Nhắc Nhở Công Việc

Tài liệu này hướng dẫn cách thiết lập Google Apps Script để gửi email nhắc nhở trước 1 tiếng cho các công việc có bật toggle "Nhắc nhở".

---

## Tổng Quan

| Thành phần | Mô tả |
|------------|-------|
| **Trigger** | Chạy mỗi 10 phút |
| **Nguồn dữ liệu** | Supabase RPC `get_pending_reminders()` |
| **Gửi email** | Gmail (qua Apps Script) |
| **Timezone** | Asia/Ho_Chi_Minh (GMT+7) |

---

## Bước 1: Chạy SQL Migration

Trước tiên, chạy SQL migration trong **Supabase SQL Editor**:

```sql
-- File: sql_updates/003_task_reminder.sql
-- Copy toàn bộ nội dung và chạy
```

---

## Bước 2: Tạo Google Apps Script

1. Đăng nhập Gmail **cskh.vinfasthcm@gmail.com**
2. Truy cập [script.google.com](https://script.google.com)
3. Tạo dự án mới: **"VinFast CRM Task Reminder"**
4. Copy toàn bộ mã bên dưới vào file `Code.gs`

### Mã Script (Code.gs)

```javascript
// ============================================
// VINFAST CRM - TASK REMINDER SCRIPT
// Gửi email nhắc nhở trước 1 tiếng cho công việc
// ============================================

const CONFIG = {
  SUPABASE_URL: 'YOUR_SUPABASE_URL', // Thay bằng URL Supabase
  SUPABASE_KEY: 'YOUR_SUPABASE_ANON_KEY', // Thay bằng anon key
  CRM_URL: 'https://crm-vf.vercel.app',
  SENDER_NAME: 'VinFast CRM Reminder'
};

// --- MAIN FUNCTION (Trigger runs this) ---
function processReminders() {
  try {
    Logger.log('🔔 Starting reminder check at: ' + new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    // 1. Get pending reminders from Supabase
    const tasks = getPendingReminders();
    
    if (!tasks || tasks.length === 0) {
      Logger.log('✅ No pending reminders');
      return;
    }
    
    Logger.log('📋 Found ' + tasks.length + ' task(s) to remind');
    
    // 2. Send email for each task
    tasks.forEach(task => {
      try {
        sendReminderEmail(task);
        markTaskReminded(task.task_id);
        Logger.log('✅ Sent reminder for: ' + task.task_title);
      } catch (e) {
        Logger.log('❌ Error sending reminder for task ' + task.task_id + ': ' + e);
      }
    });
    
    Logger.log('🏁 Reminder check complete');
    
  } catch (error) {
    Logger.log('❌ Error in processReminders: ' + error);
  }
}

// --- FETCH PENDING REMINDERS FROM SUPABASE ---
function getPendingReminders() {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/rpc/get_pending_reminders';
  
  const options = {
    method: 'POST',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  
  if (statusCode !== 200) {
    Logger.log('❌ Supabase error: ' + response.getContentText());
    return [];
  }
  
  return JSON.parse(response.getContentText());
}

// --- MARK TASK AS REMINDED ---
function markTaskReminded(taskId) {
  const url = CONFIG.SUPABASE_URL + '/rest/v1/rpc/mark_task_reminded';
  
  const options = {
    method: 'POST',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({ p_task_id: taskId }),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

// --- SEND REMINDER EMAIL ---
function sendReminderEmail(task) {
  const recipientEmail = task.user_email;
  const recipientName = task.user_name || 'Bạn';
  
  if (!recipientEmail) {
    Logger.log('⚠️ No email for user, skipping task: ' + task.task_id);
    return;
  }
  
  // Format deadline time
  const deadline = new Date(task.task_deadline);
  const timeStr = deadline.toLocaleTimeString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh'
  });
  const dateStr = deadline.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh'
  });
  
  const subject = `⏰ Nhắc việc: ${task.task_title} lúc ${timeStr}`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6; }
        .container { max-width: 500px; margin: 20px auto; }
        .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .content { padding: 24px; }
        .time-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 12px 12px 0; margin-bottom: 16px; }
        .time-box .time { font-size: 28px; font-weight: bold; color: #92400e; }
        .time-box .date { color: #b45309; font-size: 14px; }
        .task-title { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 8px; }
        .task-content { color: #6b7280; font-size: 14px; margin-bottom: 16px; }
        .info-row { display: flex; gap: 8px; margin-bottom: 8px; font-size: 14px; }
        .info-label { color: #9ca3af; min-width: 80px; }
        .info-value { color: #374151; font-weight: 500; }
        .cta-button { display: block; background: #2563eb; color: white !important; padding: 14px 24px; text-decoration: none; border-radius: 10px; font-weight: bold; text-align: center; margin-top: 20px; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; padding: 16px; }
        .priority-badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; }
        .priority-low { background: #f3f4f6; color: #6b7280; }
        .priority-medium { background: #dbeafe; color: #1d4ed8; }
        .priority-high { background: #ffedd5; color: #c2410c; }
        .priority-urgent { background: #fee2e2; color: #dc2626; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <h1>⏰ Nhắc Nhở Công Việc</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9;">Còn 1 tiếng nữa!</p>
          </div>
          
          <div class="content">
            <div class="time-box">
              <div class="time">${timeStr}</div>
              <div class="date">${dateStr}</div>
            </div>
            
            <div class="task-title">${escapeHtml(task.task_title)}</div>
            ${task.task_content ? `<div class="task-content">${escapeHtml(task.task_content)}</div>` : ''}
            
            <div class="info-row">
              <span class="info-label">Độ ưu tiên:</span>
              <span class="priority-badge priority-${task.task_priority}">${getPriorityLabel(task.task_priority)}</span>
            </div>
            
            ${task.customer_name ? `
            <div class="info-row">
              <span class="info-label">Khách hàng:</span>
              <span class="info-value">${escapeHtml(task.customer_name)}</span>
            </div>
            ` : ''}
            
            <a href="${CONFIG.CRM_URL}" class="cta-button">Mở VinFast CRM</a>
          </div>
          
          <div class="footer">
            <p>Chào ${escapeHtml(recipientName)},<br>Đây là email nhắc nhở tự động từ VinFast CRM.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  GmailApp.sendEmail(recipientEmail, subject, '', {
    htmlBody: htmlBody,
    name: CONFIG.SENDER_NAME
  });
}

// --- HELPER FUNCTIONS ---
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPriorityLabel(priority) {
  const labels = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    urgent: 'Gấp'
  };
  return labels[priority] || priority;
}

// --- TEST FUNCTION (Run Manually) ---
function testGetReminders() {
  const tasks = getPendingReminders();
  Logger.log('Found tasks: ' + JSON.stringify(tasks, null, 2));
}

function testSendEmail() {
  const testTask = {
    task_id: 'test-id',
    task_title: 'Hẹn lái thử VF8',
    task_content: 'Khách ABC hẹn lái thử tại showroom Quận 7',
    task_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    task_priority: 'high',
    user_email: 'your-test-email@gmail.com', // Thay bằng email thật
    user_name: 'Phạm Kiệt',
    customer_name: 'Nguyễn Văn A'
  };
  
  sendReminderEmail(testTask);
  Logger.log('Test email sent!');
}
```

---

## Bước 3: Cấu Hình Script

1. **Thay thế các giá trị CONFIG:**
   - `SUPABASE_URL`: URL của Supabase project (ví dụ: `https://xxxx.supabase.co`)
   - `SUPABASE_KEY`: Anon key từ Supabase Dashboard

2. **Test thủ công:**
   - Chọn function `testGetReminders` → Run → Xem Logs
   - Chọn function `testSendEmail` → Thay email → Run

---

## Bước 4: Tạo Time-based Trigger

1. Trong Apps Script, click **⏰ Triggers** (bên trái)
2. Click **+ Add Trigger**
3. Cấu hình:
   - **Choose which function**: `processReminders`
   - **Choose event source**: Time-driven
   - **Select type of time**: Minutes timer
   - **Select minute interval**: Every 10 minutes
4. Click **Save**

---

## Bước 5: Test End-to-End

1. Trong CRM, tạo công việc mới:
   - Đặt giờ deadline (ví dụ: 16:00)
   - Bật toggle "Nhắc nhở qua email"
2. Chờ đến 15:00 (1 tiếng trước)
3. Kiểm tra email

---

## Troubleshooting

### Email không gửi được?
1. Kiểm tra **Executions** trong Apps Script để xem logs
2. Đảm bảo `SUPABASE_URL` và `SUPABASE_KEY` đúng
3. Kiểm tra user có email trong `profiles` không

### Trigger không chạy?
1. Kiểm tra quota: View → Executions
2. Có thể bị giới hạn bởi Google (100 emails/ngày)

### Task không được tìm thấy?
- Chạy SQL sau để debug:
```sql
SELECT * FROM user_tasks 
WHERE reminder_enabled = true 
  AND reminder_sent = false 
  AND is_completed = false
  AND deadline BETWEEN NOW() AND NOW() + INTERVAL '2 hours';
```

---

## Mẫu Email

Email nhắc nhở sẽ có giao diện như sau:

```
┌────────────────────────────────────┐
│     ⏰ Nhắc Nhở Công Việc         │
│        Còn 1 tiếng nữa!           │
├────────────────────────────────────┤
│  🕐 08:00                         │
│  28/01/2026                       │
│                                    │
│  Hẹn lái thử VF8                  │
│  Khách ABC hẹn lái thử...         │
│                                    │
│  Độ ưu tiên: [Cao]                │
│  Khách hàng: 👤 Nguyễn Văn A      │
│                                    │
│     [📱 Mở VinFast CRM]           │
└────────────────────────────────────┘
```

---

## Thống Kê & Giám Sát

Để xem emails đã gửi:
```sql
SELECT 
  title, 
  deadline, 
  reminder_sent, 
  reminder_enabled 
FROM user_tasks 
WHERE reminder_enabled = true
ORDER BY deadline DESC;
```
