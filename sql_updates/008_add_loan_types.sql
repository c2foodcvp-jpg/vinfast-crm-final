-- Vì lỗi báo "proposals table..." và "type transaction_type does not exist", có thể cột 'type' chỉ là dạng Text thường có ràng buộc Check.
-- Anh chạy đoạn code sau để cập nhật ràng buộc cho phép 'loan' nhé:

DO $$
BEGIN
    -- 1. Xóa ràng buộc cũ (nếu có)
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

    -- 2. Thêm ràng buộc mới bao gồm 'loan' và 'loan_repayment'
    ALTER TABLE transactions ADD CONSTRAINT transactions_type_check 
    CHECK (type IN ('revenue', 'deposit', 'advance', 'expense', 'adjustment', 'dealer_debt', 'repayment', 'incurred_expense', 'personal_bonus', 'loan', 'loan_repayment'));
END $$;
