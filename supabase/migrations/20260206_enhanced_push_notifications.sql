-- 1. Cập nhật bảng system_notifications để hỗ trợ Type và Link
-- Giúp phân loại thông báo (Chat, Lead, Reminder) và điều hướng khi click
ALTER TABLE public.system_notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'system';
ALTER TABLE public.system_notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.system_notifications ADD COLUMN IF NOT EXISTS related_id UUID;

-- 2. Trigger: Khách hàng Mới & Phân công
CREATE OR REPLACE FUNCTION public.handle_new_customer_notification()
RETURNS TRIGGER AS $$
DECLARE
    admin_ids UUID[];
BEGIN
    -- Case A: Có người vừa được phân công (Insert mới có sales_rep HOẶC Update sales_rep)
    IF (TG_OP = 'INSERT' AND NEW.sales_rep IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.sales_rep IS DISTINCT FROM OLD.sales_rep AND NEW.sales_rep IS NOT NULL) THEN
       
       INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
       VALUES (
           'Phân công khách hàng mới',
           'Bạn được phân công phụ trách khách hàng: ' || COALESCE(NEW.name, 'Chưa đặt tên'),
           'customer_assignment',
           'specific',
           ARRAY[NEW.creator_id],
           '/customers/' || NEW.id,
           NEW.id
       );
    END IF;

    -- Case B: Lead mới chưa ai nhận (Status = 'Mới' + sales_rep NULL)
    -- Chỉ báo cho Admin/Mod để họ vào chia số
    IF (TG_OP = 'INSERT' AND NEW.sales_rep IS NULL AND NEW.status = 'Mới') THEN
       -- Lấy danh sách ID của Admin/Mod
       SELECT array_agg(id) INTO admin_ids FROM profiles WHERE role IN ('admin', 'mod');
       
       IF admin_ids IS NOT NULL THEN
           INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
           VALUES (
               'Có Lead mới chờ xử lý',
               'Khách hàng mới: ' || COALESCE(NEW.name, 'Unknown') || ' chưa có nhân viên phụ trách.',
               'lead_new',
               'specific',
               admin_ids,
               '/customers/' || NEW.id,
               NEW.id
           );
       END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn Trigger vào bảng customers
DROP TRIGGER IF EXISTS on_customer_created_updated ON public.customers;
CREATE TRIGGER on_customer_created_updated
AFTER INSERT OR UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_customer_notification();


-- 3. Trigger: Tin nhắn Chat Mới
CREATE OR REPLACE FUNCTION public.handle_chat_notification()
RETURNS TRIGGER AS $$
DECLARE
    recipient_ids UUID[];
    channel_type TEXT;
    sender_name TEXT;
BEGIN
    -- Bỏ qua tin nhắn hệ thống
    IF NEW.is_system THEN RETURN NEW; END IF;

    -- Lấy loại kênh (channel type)
    SELECT type INTO channel_type FROM chat_channels WHERE id = NEW.channel_id;

    -- Bỏ qua kênh chat chung (Global) để tránh Spam thông báo
    IF channel_type = 'global' THEN RETURN NEW; END IF;

    -- Lấy tên người gửi
    SELECT full_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;

    -- Lấy danh sách người nhận (Thành viên kênh TRỪ người gửi)
    SELECT array_agg(user_id) INTO recipient_ids 
    FROM chat_members 
    WHERE channel_id = NEW.channel_id AND user_id != NEW.sender_id;

    IF recipient_ids IS NOT NULL AND array_length(recipient_ids, 1) > 0 THEN
       INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
       VALUES (
           'Tin nhắn mới từ ' || COALESCE(sender_name, 'Người ẩn danh'),
           CASE WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 50) || '...' ELSE NEW.content END,
           'chat_message',
           'specific',
           recipient_ids,
           '/community', -- Link đến trang chat
           NEW.channel_id
       );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn Trigger vào bảng chat_messages
DROP TRIGGER IF EXISTS on_chat_message_created ON public.chat_messages;
CREATE TRIGGER on_chat_message_created
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_chat_notification();


-- 4. Function: Kiểm tra Lịch hẹn (Dành cho Cron Job / Scheduled Function)
-- Hướng dẫn: Cần chạy function này mỗi 30 phút hoặc 1 tiếng bằng pg_cron hoặc Edge Function
CREATE OR REPLACE FUNCTION public.check_upcoming_notifications_cron()
RETURNS VOID AS $$
DECLARE
    client RECORD;
BEGIN
    -- Tìm các khách hàng có lịch hẹn (recare_date) LÀ HÔM NAY và chưa xong
    -- Chỉ lấy những record chưa có thông báo nhắc nhở nào được tạo trong 24h qua (để tránh spam) (Logic đơn giản hóa)
    
    FOR client IN 
        SELECT c.* 
        FROM customers c
        WHERE c.recare_date::date = CURRENT_DATE 
          AND c.sales_rep IS NOT NULL
          AND c.status NOT IN ('Đã hủy', 'Chốt đơn') -- Chỉ nhắc khách chưa chốt/hủy
    LOOP
        -- Kiểm tra xem đã nhắc chưa (Optional collision check via specific tag/type logic)
        -- Tạm thời insert luôn (User tự quản lý tần suất gọi function)
        
        INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
        VALUES (
            'Nhắc lịch hẹn hôm nay',
            'Bạn có lịch chăm sóc khách hàng: ' || client.name,
            'appointment_reminder',
            'specific',
            ARRAY[client.creator_id],
            '/customers/' || client.id,
            client.id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Kích hoạt Lịch chạy Tự động (Run Once)
-- Bạn chỉ cần chạy dòng dưới đây 1 lần duy nhất.
-- Hệ thống sẽ tự động ghi nhớ và chạy vào 9:00 sáng hàng ngày.

-- Bật tiện ích hẹn giờ (nếu chưa bật)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Xóa lịch cũ nếu đã từng cài (tránh trùng lặp)
-- Lưu ý: Lệnh unschedule sẽ báo lỗi nếu job chưa tồn tại, nhưng điều đó không sao.
-- Để an toàn, chúng ta chỉ cần Re-schedule (nó sẽ update nếu trùng tên hoặc tạo mới).
-- Tuy nhiên pg_cron dùng ID hoặc JobName.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-appointment-reminder';

-- Cài đặt lịch mới
SELECT cron.schedule('daily-appointment-reminder', '0 9 * * *', $$SELECT public.check_upcoming_notifications_cron()$$);
