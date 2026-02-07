-- Update Notification Logic to respect Lead Source Filters
-- This prevents MODs from receiving notifications for leads that belong to another MOD's script (source)

CREATE OR REPLACE FUNCTION public.handle_new_customer_notification()
RETURNS TRIGGER AS $$
DECLARE
    admin_ids UUID[];
    specific_mod_id UUID;
    target_ids UUID[];
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
       
       -- 1. Check if this lead belongs to a specific MOD via source_filter
       -- We assume 'source' in customers matches 'source_filter' in lead_email_pages
       SELECT mod_id INTO specific_mod_id 
       FROM lead_email_pages 
       WHERE source_filter = NEW.source 
         AND is_active = true 
       LIMIT 1;

       -- 2. Define who gets notified
       IF specific_mod_id IS NOT NULL THEN
           -- Found a specific MOD owner for this source
           -- Notify: All Admins + The Specific MOD
           SELECT array_agg(id) INTO target_ids 
           FROM profiles 
           WHERE role = 'admin' OR id = specific_mod_id;
       ELSE
           -- Generic Lead (No specific source match)
           -- Notify: All Admins + All MODs (Default behavior)
           SELECT array_agg(id) INTO target_ids 
           FROM profiles 
           WHERE role IN ('admin', 'mod');
       END IF;
       
       IF target_ids IS NOT NULL AND array_length(target_ids, 1) > 0 THEN
           INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
           VALUES (
               'Có Lead mới chờ xử lý',
               'Khách hàng mới: ' || COALESCE(NEW.name, 'Unknown') || ' chưa có nhân viên phụ trách' || CASE WHEN NEW.source IS NOT NULL THEN ' (Nguồn: ' || NEW.source || ')' ELSE '' END || '.',
               'lead_new',
               'specific',
               target_ids, -- Use the filtered list
               '/customers/' || NEW.id,
               NEW.id
           );
       END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
