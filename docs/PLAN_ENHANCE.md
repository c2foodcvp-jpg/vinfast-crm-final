# Enhancement Plan: Customer Quick Interaction Popup

## Objectives
Enhance the existing `QuickInteractionModal` and its integration in `Calendar` to provide a smoother, more feature-rich experience for sales reps.

## User Requirements
1.  **Performance Optimization**: Reduce "lag" when opening/using the popup.
    *   *Cause Analysis*: Re-rendering heavy components or unoptimized state updates.
    *   *Solution*: Memoize components, optimize fetching (lazy load history), and ensure `Calendar` doesn't re-render entirely on modal open.
2.  **New Features**:
    *   **Toggle "Special Care" (CS Đặc biệt)**: Quick switch.
    *   **Toggle "Long Term Care" (CS Dài hạn)**: Quick switch.
    *   **"View Detail" Button**: Navigate to full Profile.
    *   **Interaction History**: Show recent notes/interactions in a sub-section or side panel.

## Implementation Steps

### 1. Optimize `QuickInteractionModal.tsx`
- **Memoization**: Wrap component in `React.memo`.
- **Fetch History**: Add `useEffect` to fetch last 5 interactions only when modal opens (or when "History" tab is active).
- **UI Structure**:
    - **Header**: Status, Phone.
    - **Body**: Tabs (Interaction Types) + Toggles + History List.
    - **Footer**: Actions.

### 2. Add Features to `QuickInteractionModal`
- **Toggles**: Add `Switch` for `is_special_care` and `is_long_term`.
    - Logic needed: If "Long Term" on -> show Date Picker (default +10 days?).
    - If "Special Care" on -> auto classification "Hot".
- **Navigation**: Add a transparent/outline button "Chi tiết" -> `navigate('/customers/' + id)`.
- **History Section**:
    - Display expandable list "Lịch sử gần đây".
    - ` supabase.from('interactions').select('*').eq('customer_id', id).order('created_at', {ascending: false}).limit(5)`.

### 3. Verify `Calendar.tsx` Integration
- Ensure `Calendar` doesn't fetch all data again just by opening the modal.
- Only refresh data (`fetchData`) *after* a successful save in the modal.

## Detailed Changes

### `components/QuickInteractionModal.tsx`
- Add state: `history` (array), `loadingHistory` (bool).
- Add toggles in the "Update Info" section.
- Add "Lịch sử" tab or section at the bottom.
- Add "Chi tiết" button in Footer or Header.

### `pages/Calendar.tsx`
- No major changes needed if Modal handles its own fetching.
- Just ensure `onSuccess` callback triggers a light refresh.

## Actionable Next Steps
1.  Modify `QuickInteractionModal.tsx` with optimized code and new UI elements.
2.  Test performance manually.
