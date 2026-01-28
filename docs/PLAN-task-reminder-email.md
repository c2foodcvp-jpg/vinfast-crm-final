# IMPLEMENTATION PLAN: Task Reminder Email

> **Status**: ✅ COMPLETED
> **Created**: 2026-01-28
> **Goal**: Gửi email nhắc nhở trước 1 tiếng cho các ghi chú (user_tasks) có bật toggle "Nhắc nhở"

---

## 📋 Tóm Tắt Yêu Cầu

| Yếu tố | Quyết định |
|--------|------------|
| **Trường thời gian** | Đổi `deadline DATE` → `deadline TIMESTAMPTZ` |
| **Cơ chế gửi email** | Google Apps Script Time-based Trigger |
| **Điều kiện gửi** | Chỉ khi user bật toggle "Nhắc nhở" (`reminder_enabled = true`) |
| **Thời điểm gửi** | 1 tiếng trước deadline |
| **Email gửi đến** | Email của user tạo ghi chú |

---

## 📝 Implementation Steps

### Phase 1: Database Migration ✅
**Files**: `sql_updates/003_task_reminder.sql`

- [x] Alter `user_tasks` table: deadline → TIMESTAMPTZ
- [x] Add `reminder_enabled`, `reminder_sent` columns
- [x] Create RPC function `get_pending_reminders()`
- [x] Create RPC function `mark_task_reminded()`

---

### Phase 2: Frontend Updates ✅
**Files**: `pages/Calendar.tsx`

- [x] Update `UserTask` interface with reminder fields
- [x] Add `deadlineTime` and `reminderEnabled` to form state
- [x] Add Time picker to modal
- [x] Add Reminder toggle with hint text
- [x] Update `handleCreateTask()` to combine date+time
- [x] Update TaskCard to show time and bell icon

---

### Phase 3: Google Apps Script ✅
**Files**: `docs/TASK_REMINDER_SCRIPT.md`

- [x] Complete script with all functions
- [x] Email template design
- [x] Setup instructions
- [x] Troubleshooting guide

---

## 📁 Files Created/Modified

| Action | File | Description |
|--------|------|-------------|
| ✅ CREATE | `sql_updates/003_task_reminder.sql` | DB migration script |
| ✅ MODIFY | `pages/Calendar.tsx` | Time picker + reminder toggle |
| ✅ CREATE | `docs/TASK_REMINDER_SCRIPT.md` | GAS script + setup guide |

---

## 🚀 Next Steps (Manual)

### 1. Chạy SQL Migration
Mở Supabase SQL Editor và chạy file:
```
sql_updates/003_task_reminder.sql
```

### 2. Setup Google Apps Script
Theo hướng dẫn trong:
```
docs/TASK_REMINDER_SCRIPT.md
```

### 3. Test
- Tạo công việc với giờ cụ thể + bật toggle nhắc nhở
- Kiểm tra email trước 1 tiếng

---

## ✅ Implementation Complete!
