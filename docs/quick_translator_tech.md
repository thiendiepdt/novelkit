# Dịch nhanh (QT Web) — Tài liệu kỹ thuật

## Tổng Quan Kiến Trúc (Architecture)
Quick Translator Web là phiên bản tái sinh (Ported) của phần mềm QuickTranslator C# huyền thoại. Để mang toàn bộ sức mạnh xử lý text hàng Megabytes của C# lên Browser mà không làm sập (Crash) giao diện, kiến trúc hệ thống áp dụng 3 luồng lõi:
1. **Dịch Thuật Chặt Chẽ (Max-Match)**: Thuật toán so khớp chuỗi dài nhất từ trái sang phải.
2. **Web Worker Offloading**: Đẩy thuật toán chặn luồng chính (Main-thread blocking) xuống Worker Thread.
3. **Persisted Caching (IndexedDB)**: Tránh việc tải và phân tích Regex từ điển mỗi lần tải trang.

## 1. Engine Dịch Thuật (Engine.ts)
### Thuật toán cốt lõi: Ngram Max-Match
Engine đọc input Tiếng Trung từ trái sang phải. Với mỗi ký tự, hệ thống lấy một khung nhìn (Window Frame) dài nhất có thể (thường là 20 ký tự theo mặc định của QuickTranslator gốc) rồi đối chiếu vào `Map` cấu trúc dữ liệu lưu trong RAM.
- Nếu chuỗi `20` ký tự không khớp trong `Map`, thuật toán hạ khung nhìn xuống `19`, `18`, ... xuống `1` ký tự.
- Khi tìm thấy khớp (Match) ở độ dài `N`, engine kết xuất token và nhảy qua `N` ký tự tiếp theo.
Khác với C# gốc kết xuất ra `string` thuần túy, ở bản Web tao đã sửa trả về mảng `TranslatedToken[]`:
```typescript
interface TranslatedToken {
  original: string;        // Chữ Tàu gốc
  translated: string;      // Viết Phrase/Name
  type: 'name' | 'vietphrase' | 'hanviet' | 'latin' | 'punctuation' | 'chinese_unmapped';
  dictType?: DictType;     // Tham chiếu đến từ điển để Update nếu cần
}
```

## 2. Quản Lý Từ Điển (DictionaryManager & DictionaryLoader)
### DictionaryLoader
- Sử dụng Database Browser `idb` (IndexedDB).
- Nhờ IndexedDB, nếu người dùng có File VietPhrase kích cỡ 20MB, việc bóc chuỗi string khổng lồ thành `Map` qua Regex `(.+)=(.+)` tốn vài giây chỉ xảy ra ĐÚNG 1 LẦN. Lần sau, dữ liệu bốc từ IDB siêu nhanh.
- Hệ thống hỗ trợ nạp cấu hình `fallbackUrl` (bình thường để trong `/public/dictionaries`).

### DictionaryManager
- Tương tự như `Dictionary` của C#, sử dụng cấu trúc `Map<string, string>` nội tại trong Javascript V8 (mang thời gian Lookup là O(1)).
- Chứa logic quản lý thứ tự ưu tiên: Nếu một Tên (Name) có cùng độ lớn như cụm từ Vietphrase, Tên luôn được ưu tiên bắt trước, nhằm giải quyết lỗi danh từ riêng bị dịch tan nát thành nghĩa đen hán việt.

## 3. Worker & Comlink Integration (translator.worker.ts)
Để app không móp méo khi user kéo 1 vạn chữ vào, instance của `TranslatorWorkerAPI` chạy qua thư viện `comlink`.
- `init`: Nạp và hydrate Data từ IDB vào biến bộ nhớ của Worker.
- `translate`: Nhận Raw Text, xuất `TranslatedToken[]`.
- `updateDictionary`: Function tương tác 2 chiều cho phép UI ra lệnh update lại cụm từ vừa bấm và thêm vào RAM worker, đảm bảo click save xong dịch lại là có nghĩa mới luôn không cần F5.

## 4. UI Components Layer
1. `TranslatorPage.tsx`: Gọi Hook `useTranslatorWorker()`. Component quản lý State chính, truyền List Tokens xuống. Có Hệ thống 2 Tab (VietPhrase, Hán Việt).
2. `TokenViewer.tsx`: Lập trình duyệt mảng Token, dùng class CSS đặc tính để bôi từng loại màu chữ (Tên -> Tím). Có event `onClick` để mở Modal edit.
3. `TranslationEditorModal.tsx`: Popup tương tác, tích hợp thêm WebView Link ra `Baidu Baike` và thao tác update Meaning theo loại Từ Điển (Word Type).
4. `FindReplaceBar.tsx`: Chức năng tìm kiếm toàn cục, áp dụng Text Replace vào Raw Text.

## 5. Quy trình xử lý lỗi (Troubleshooting Guide)
- **Lỗi Unrecognized Worker / Comlink undefined**: Vite cấu hình phải import explicit `?worker`. Cẩn trọng việc import các library nặng có dính đến `window` vào trong file `.worker.ts`, nó sẽ bẻ gãy Worker vì scope `WorkerGlobalScope` không có `window` object.
- **Lỗi tràn RAM trình duyệt**: App đang hỗ trợ văn bản tốt, nhưng với tiểu thuyết 500 chương > 1M ký tự, hàm map Array Token sẽ dẫn đến quá tải `React Virtual DOM` vì hàng chục nghìn tag `<span>` nội suy. Nếu cần đẩy scale, phải build kiến trúc [Virtual Scroll / Text Virtualizer] hoặc [Chunking Engine]. Mảng Token phải được chặt khúc ngắt trang trước khi quăng toàn bộ list cục bộ cho User Renderer.
