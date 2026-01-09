
import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  try {
    // 1. Create a new workbook
    const wb = XLSX.utils.book_new();

    // 2. Convert JSON data to worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // 3. Auto-adjust column width (basic heuristic)
    const colWidths = data.length > 0 
        ? Object.keys(data[0]).map(key => ({ wch: Math.max(key.length, 20) })) 
        : [];
    ws['!cols'] = colWidths;

    // 4. Append worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // 5. Write file and trigger download
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Error exporting excel:", error);
    alert("Có lỗi khi xuất file Excel. Vui lòng thử lại.");
  }
};
