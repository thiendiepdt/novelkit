# Định dạng văn bản — Tài liệu kỹ thuật

## Mục đích
Công cụ xử lý văn bản thô (thường là raw text Tiếng Trung được copy từ các trang truyện chữ) trước khi đưa vào dịch thuật. Công cụ đảm bảo văn bản sạch sẽ, đúng chuẩn cấu trúc đoạn văn, giảm thiểu sai sót cho engine phân tích từ ngữ.

## Kiến trúc tính năng
Logic xử lý được cô lập hoàn toàn thành thư viện độc lập tại `src/features/text-formatter/utils/formatter.ts`.

### 1. Chuẩn hóa khoảng trắng & Cấu trúc đoạn (Normalization)
Hàm `formatText(text: string)` thực hiện các bước tuần tự qua Regex:
- Tách dòng (`split('\n')`).
- Loại bỏ các khoảng trắng vô ích ở đầu/cuối mỗi dòng (`trim()`). Xử lý triệt để tab ảo, space thừa.
- Lọc bỏ các dòng rỗng (`filter(line => line.length > 0)`).
- Nối lại bằng ký tự `\n\n` (tạo ra khoảng cách 1 dòng rỗng giữa 2 đoạn văn — chuẩn vàng của hiển thị truyện chữ).

### 2. Phát hiện chữ Hán (Chinese Detection)
Hàm `detectChineseCharacters(text: string)` phân tích văn bản để tìm kiếm sự xuất hiện của các chữ cái nằm trong bảng mã CJK (Chinese-Japanese-Korean).
- **Regex Cốt lõi**: `const chineseRegex = /[\u4e00-\u9fa5\u3400-\u4dbf\uf900-\ufaff]/g;`
- **Bao gồm**:
  - `\u4e00-\u9fa5`: CJK Unified Ideographs (Chữ Hán phổ thông).
  - `\u3400-\u4dbf`: CJK Unified Ideographs Extension A.
  - `\uf900-\ufaff`: CJK Compatibility Ideographs.
- **Tối ưu**: Sử dụng `Set<string>` để bóc tách các ký tự Trung Quốc duy nhất (Unique Characters). Rất hữu ích để báo cáo cho người dùng nếu bộ lọc raw dính lẫn chữ Hán chưa được dịch.

### 3. Trích xuất thống kê (Stats Extraction)
Hàm `getTextStats(text: string)` trả về:
- `charCount`: Đếm ký tự (loại bỏ toàn bộ khoảng trắng, xuống dòng) `replace(/\s/g, '').length`.
- `totalCount`: Tổng chiều dài chuỗi gốc.
- `paragraphCount`: Số đoạn văn. Tính bằng cách đếm số khối text tách biệt bởi chuỗi newline.

## Thành phần giao diện (UI Components)
- `TextFormatterPage.tsx`: Chứa Layout split 2 nửa trên PC (Nhập -> Thống kê -> Xuất). Trên Mobile tự động sập xuống single column (`flex-col`).
- `StatsPanel.tsx`: Thẻ hiển thị số liệu realtime. Component ngu (Dumb Component) chỉ nhận props render.
- `ChineseWarning.tsx`: Component hiển thị cảnh báo (Warning) UI màu Crimson nếu Array chứa chữ Hán trả về > 0 phần tử. Mở rộng view array dưới dạng badge nhỏ.

## Quy trình kiểm thử (Developer Note)
Nếu nâng cấp chức năng (như tự động sửa dấu câu Tàu `“ ”` thành dấu Việt `" "`), cần lưu ý viết Unit test trực tiếp vào `formatText` nhằm đảm bảo Regex không phá hỏng cấu trúc câu thoại. Chi phí Regex thay thế trên file text 100MB có thể cao, nên ưu tiên các Regex xử lý dòng `Line by Line` thay vì Global Replace nếu file text quá lớn.
