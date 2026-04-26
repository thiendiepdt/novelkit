# CV Tools — Lộ trình phát triển & Tính năng chưa port

Dựa trên code base và UI của **Quick Translator C# (QT)** nguyên bản, app Web hiện tại đã kế thừa thành công ~80% các tính năng quan trọng nhất cho Translator & Converter. Dưới đây là Roadmap về các chức năng *chưa được Port* và Phương hướng phát triển tiếp theo cho AI Developer tương lai.

## Các chức năng chưa Port từ Quick Translator C#

### 1. Trình soạn thảo song song (Vietnamese WYSIWYG Panel)
- **Tool C# gốc**: `DocumentPanel.cs` chứa một cột "Việt". Tại đây, converter trực tiếp gõ máy bản dịch mịn, đối soát chéo với các Panel "VietPhrase", "Hán Việt", và "Nghĩa" xung quanh.
- **Tại sao chưa port**: Giao diện Web (nhất là Mobile) ưu tiên tối giản không gian. Đại đa số người dùng mới hiện nay copy text VietPhrase thẳng ra Microsoft Word hoặc Notion để edit. Tuy nhiên, nếu user là Hardcore-Translator quen môi trường khép kín, cần tính năng này.
- **Ý tưởng triển khai tương lai**:
  - Tích hợp Text Editor (ví dụ `tiptap` hoặc `quill`) làm Tab thứ 3 trên Output Panel (`activeTab === 'vieter'`).
  - Synced Scrolling (cuộn đồng bộ): Nếu cuộn chuột bên cột tiếng Trung, cột soạn thảo gõ tiếng Việt cũng cuộn theo đúng đoạn. Tính năng này cần thuật toán ánh xạ Component Line Number.

### 2. Export sang định dạng Word (`ExportToWordForm.cs`)
- **Tool C# gốc**: Nút Export đẩy kết quả ra định dạng file `.doc` của Microsoft Office thông qua thư viện. Tự động bôi màu các chữ tương ứng (Tên tím, Tàu đỏ).
- **Tại sao chưa port**: Xuất `.txt` đã được triển khai nhưng xuất `.docx` cần thư viện khá nặng (như `docx.js`), và việc tô màu style Word phức tạp hơn xuất text trơn.
- **Ý tưởng triển khai tương lai**: Sử dụng `docx.js`. Parse mảng `TranslatedToken[]` thành mảng TextRun có color scheme, rồi tạo DOCX Document cho phép user Tải file `.docx`.

### 3. Translation History / Mặc định lưu Profile File
- **Tool C# gốc**: Hỗ trợ Open/Save Translation Workspace (.qt file) lưu toàn bộ phiên làm việc.
- **Tính năng Web tương lai**: Cache phiên gõ dở bằng localStorage hoặc IndexedDB. Tự động backup bản dịch sau mỗi 2 phút gõ đề phòng Browser tab crash.

### 4. Post sang Tàng Thư Viện (`PostTTVForm.cs`)
- *Obsolete (Lỗi thời)*: Auto post lên diễn đàn Tàng Thư Viện không còn giá trị nhiều trong hiện tại do TTV đã đóng cửa nhiều tính năng api. Loại bỏ tính năng này.

## Phương Hướng Phát Triển Mở Rộng Hệ Sinh Thái
Ngoài việc Port tính năng cũ, Hệ sinh thái **CV Tools Web** có thể mở mang theo các luồng sau:

### Phase A: Scale Engine Lên Cấp Độ Tiểu Thuyết
- **Virtual Scrolling cho Tokens**: Xử lý tình trạng 1.000.000 ký tự (Khoảng 200 trang A4 chữ) đẩy vỡ RAM ReactJS vì lượng DOM tag quá khổng lồ. 
- Xây dựng component `VirtualizedTokenRenderer` giống kiến trúc `react-window` cho phép chỉ Render các Token nằm trong Viewport hiện tại của người dùng.

### Phase B: Cloud Synchronization
- **Tách từ điển tĩnh thành Tương Tác Đám Mây**: 
  - Thay vì tự import `VietPhrase.txt` vào ổ ứng dụng `idb` cục bộ, app sẽ connect với một Server Core (Node.js API).
  - Quản trị viên (Admin) đẩy Name mới vào Server, các user khác mở Web tự động sync bản Update 5 giây trước (Real-Time Dictionary).
  - Chức năng vote nghĩa, báo trùng.

### Phase C: Tích Hợp AI Contextual Translation
- Vì ta đã có sẵn Frontend rất nuột, thay vì so khớp Max-Match từ điển truyền thống, thêm 1 Tab "AI Dịch". Bắn cụm câu đó (Kèm context các đoạn trước) lên API của Gemini/ChatGPT cùng Prompt Dictionary Context để AI nặn ra bản dịch siêu mượt. Đem lại hiệu suất Translator 10x.

> Tài liệu này được biên soạn gửi gắm tới các Agent AI tiếp quản Project. Các bạn cứ theo Roadmap này mà gõ, code có comment đầy đủ ở `src/features/translator`. Happy coding!
