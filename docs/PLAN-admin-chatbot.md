# PLAN-admin-chatbot: Xây dựng Chatbot Phân tích Dữ liệu

## 1. Tổng quan
- **Mục tiêu**: Tích hợp một Chatbot AI vào ứng dụng CRM, cho phép Admin/Mod phân tích dữ liệu (Customer, Deals, Finance) bằng ngôn ngữ tự nhiên.
- **Đối tượng sử dụng**: Chỉ Admin và Moderator.
- **Công nghệ đề xuất**: 
  - Frontend: React (Vite)
  - Backend: Supabase Edge Functions (để bảo mật API Key và xử lý logic)
  - AI Model: OpenAI GPT-4o hoặc Claude 3.5 Sonnet (khả năng xử lý SQL/Data tốt nhất)

## Phase 0: Xác nhận & Chuẩn bị (Socratic Gate)
Trước khi bắt đầu code, cần làm rõ:
1. **API Key**: Bạn đã có API Key của OpenAI hoặc Anthropic chưa?
2. **Chi phí**: Việc phân tích dữ liệu (gửi schema + data) có thể tốn token. Bạn có chấp nhận chi phí này không?
3. **Phạm vi dữ liệu**: "Phân tích mọi thứ" là rất rộng. AI có nên được quyền truy cập vào bảng nhạy cảm nào không (ví dụ: lương nhân viên, thông tin cá nhân chi tiết)?
   - *Đề xuất*: Chỉ cho phép đọc các bảng: `customers`, `deals`, `transactions`.
4. **Quyền riêng tư**: Dữ liệu sẽ được gửi qua API của bên thứ 3 (OpenAI/Anthropic). Cần đảm bảo tuân thủ chính sách bảo mật của công ty.

## Phase 1: Thiết lập Backend & Quyền truy cập
Do ứng dụng sử dụng Supabase, việc xử lý nên thực hiện ở **Edge Function** để đảm bảo an toàn.

### 1.1 Tạo Database Role mới
Không nên dùng role `service_role` (full quyền) cho AI. Cần tạo role `analytics_bot` chỉ có quyền `SELECT` trên các bảng cho phép.
- **Task**: Tạo role PostgreSQL và gán quyền `SELECT`.

### 1.2 Supabase Edge Function (`/functions/ask-ai`)
Xây dựng một API endpoint an toàn:
- **Input**: Câu hỏi của user (User Query), User ID (để kiểm tra quyền).
- **Process**:
  1. Kiểm tra User có phải Admin/Mod không.
  2. Lấy Schema hiện tại của các bảng liên quan.
  3. Gửi Prompt tới LLM: "Bạn là Data Analyst. Dựa trên schema này, hãy trả lời câu hỏi... Nếu cần query, hãy trả về câu SQL".
  4. Nếu LLM trả về SQL -> Edge Function thực thi SQL này (với role hạn chế).
  5. Gửi kết quả data lại cho LLM để tóm tắt hoặc trả về Frontend trực tiếp.

## Phase 2: Xây dựng Logic AI
Đây là phần quan trọng nhất để Chatbot thông minh.
- **System Prompt**: Định nghĩa rõ cấu trúc Database, các trường enum (Status: WON, LOST...), và cách tính toán logic (ví dụ: Doanh thu = Tổng amount các deal WON).
- **Tool Calling**: Sử dụng tính năng Function Calling của OpenAI để AI có thể "gọi" hàm `execute_sql` thay vì chỉ chém gió.

## Phase 3: Frontend (Giao diện Chat)
Tạo một giao diện Chat chuyên nghiệp trong Admin Dashboard.
- **Vị trí**: Nút nổi (Floating Action Button) hoặc một trang riêng `/analytics/chat`.
- **Tính năng**:
  - Chat input (hỗ trợ tiếng Việt).
  - Hiển thị kết quả dạng Text (Markdown) và Bảng (Table).
  - *Nâng cao*: Vẽ biểu đồ (Chart) nếu dữ liệu trả về dạng Time-series (Doanh thu theo tháng).

## Phase 4: Kiểm thử & Tối ưu
- **Security Check**: Thử yêu cầu AI "Xóa database" xem nó có chặn không.
- **Accuracy Check**: So sánh số liệu AI đưa ra với trang Dashboard hiện tại.
- **Rate Limit**: Giới hạn số câu hỏi mỗi ngày để tránh spam bill.

## Kế hoạch hành động tiếp theo
1. Review Plan này và trả lời các câu hỏi ở Phase 0.
2. Chạy `/create` (hoặc yêu cầu Agent) để bắt đầu Phase 1: Thiết lập Edge Function.
3. Cung cấp API Key vào `.env` (ví dụ `OPENAI_API_KEY`).
