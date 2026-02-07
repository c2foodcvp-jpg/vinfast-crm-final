-- 1. Add status columns to customer_transactions
ALTER TABLE customer_transactions 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Create Trigger Function for Finance Notifications
CREATE OR REPLACE FUNCTION public.handle_finance_notification()
RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
    customer_name TEXT;
    admin_ids UUID[];
    amount_str TEXT;
    trans_type_vi TEXT;
BEGIN
    -- Format Amount (Clean and simple formatting)
    amount_str := to_char(NEW.amount, 'FM999,999,999,999') || ' VNĐ';
    
    -- Translate Type
    IF NEW.type = 'revenue' THEN trans_type_vi := 'Thu';
    ELSE trans_type_vi := 'Chi';
    END IF;

    -- Get Customer Name
    SELECT name INTO customer_name FROM customers WHERE id = NEW.customer_id;

    -- CASE 1: NEW PENDING REQUEST (Notify Admins/Mods)
    -- Only if status is pending (TVBH creating request)
    IF (TG_OP = 'INSERT' AND NEW.status = 'pending') THEN
        -- Get Creator Name
        SELECT full_name INTO creator_name FROM profiles WHERE id = NEW.created_by;
        
        -- Get Admin/Mod IDs
        SELECT array_agg(id) INTO admin_ids FROM profiles WHERE role IN ('admin', 'mod');
        
        IF admin_ids IS NOT NULL THEN
            INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
            VALUES (
                'Yêu cầu duyệt ' || trans_type_vi,
                'NV ' || COALESCE(creator_name, 'Unknown') || ' yêu cầu duyệt ' || trans_type_vi || ' số tiền ' || amount_str || ' cho khách ' || COALESCE(customer_name, 'Unknown'),
                'finance_request',
                'specific',
                admin_ids,
                '/finance?customerId=' || NEW.customer_id,
                NEW.id
            );
        END IF;
    END IF;

    -- CASE 2: REQUEST APPROVED (Notify Creator)
    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'approved') THEN
         INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
            VALUES (
                'Yêu cầu được Duyệt',
                'Quản lý đã duyệt ' || amount_str || ' (' || trans_type_vi || ') yêu cầu của khách ' || COALESCE(customer_name, 'Unknown') || ' !',
                'finance_approved',
                'specific',
                ARRAY[NEW.created_by],
                '/finance?customerId=' || NEW.customer_id,
                NEW.id
            );
    END IF;

    -- CASE 3: REQUEST REJECTED (Notify Creator)
    IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'rejected') THEN
         INSERT INTO public.system_notifications (title, content, type, target_scope, target_user_ids, link, related_id)
            VALUES (
                'Yêu cầu bị Từ chối',
                'Yêu cầu ' || trans_type_vi || ' ' || amount_str || ' của khách ' || COALESCE(customer_name, 'Unknown') || ' đã bị từ chối. Lý do: ' || COALESCE(NEW.rejection_reason, 'Không có'),
                'finance_rejected',
                'specific',
                ARRAY[NEW.created_by],
                '/finance?customerId=' || NEW.customer_id,
                NEW.id
            );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS on_finance_transaction_change ON public.customer_transactions;
CREATE TRIGGER on_finance_transaction_change
AFTER INSERT OR UPDATE ON public.customer_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_finance_notification();
