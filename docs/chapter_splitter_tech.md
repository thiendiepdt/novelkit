# Chia chương — Tài liệu kỹ thuật

## Mục đích
Công cụ xử lý văn bản truyện chữ, đặc biệt là các chương được gộp (mega chapter) hoặc truyện có văn bản siêu dài. Công cụ tiến hành cắt văn bản thành nhiều phần nhỏ (parts) dựa trên cấu hình số lượng chữ tối đa từ người dùng. Thiết kế đảm bảo ngắt mạch một cách tự nhiên (không bao giờ cắt ngang một đoạn văn) và tự động đính kèm số thứ tự (phần 1/5, 2/5...) lên tiêu đề mỗi phần tương ứng.

## Kiến trúc tính năng
Logic chia chương nằm tại `src/features/chapter-splitter/utils/splitter.ts`, độc lập hoàn toàn với tầng giao diện.

### 1. Chuẩn hóa & Dọn dẹp văn bản
- Trước khi bắt đầu xử lý, văn bản sẽ tự động được làm sạch thông qua hàm `formatText` từ module `text-formatter`.
- Đảm bảo các dòng trống, khoảng trắng đầu dòng, lề thô ở đầu vào đều được gỡ bỏ gọn gàng, định dạng lại thành cấu trúc đoạn chuẩn xác phân tách bằng dòng trống `\n\n`.

### 2. Định danh Tiêu đề & Tính toán kích cỡ
Được đảm nhiệm bởi hàm cốt lõi `splitChapter(text: string, maxWords: number): SplitResult`.
- **Nhận diện & Xác thực tiêu đề**: Thuật toán mặc định bóc tách **dòng mồ côi đầu tiên** của văn bản làm tên chương/tiêu đề (Ví dụ: `Chương 120: Đại kết cục`). Ngay tại UI, nếu dòng đầu tiên (hoặc văn bản) không bắt đầu bằng chữ "Chương" (không phân biệt hoa thường), logic validation `/^chương/i` sẽ chặn thực thi và khóa nút chia cắt để cảnh báo người dùng.
- **Tính toán số chữ (Adaptive Word Count)**: Hệ thống sử dụng helper `getWordCount(text)` tự động thích nghi ngôn ngữ:
  - Nếu câu chứa các Regex khối CJK (Trung Quốc), số chữ là số ký tự (loại trừ khoảng trắng).
  - Nếu đối tượng là Tiếng Việt/English, số chữ quy về số lượng tokens (từ) tách với nhau bởi khoảng trắng - phù hợp với chuẩn "2000 chữ" trên các trang đăng truyện Việt Nam.

### 3. Cơ chế Tham Lam (Greedy Splitting)
- Lặp qua mảng chứa các đoạn văn nội dung, cộng dồn dần số chữ: `currentWordCount += wordsInP`. 
- Khi ngưỡng từ vượt hoặc bằng cấu hình `maxWords` quy ước, thuật toán sẽ chốt lại tại ranh giới của đoạn văn hiện tại (không cắt chẻ ở giữa). Do vậy kích thước từng phần "vừa vặn" xung quanh mốc maxWords (thường sẽ nhích hơn một chút bằng chính độ dài của đoạn văn cuối trong lượt đếm đó).
- **Labeling (Gắn thẻ)**: Prefix `${chapterName} (${index + 1}/${parts.length})` sẽ tự động nối lên trên cùng mỗi block chia.

## Thành phần giao diện (UI Components)
- `ChapterSplitterPage.tsx`: Layout chính sử dụng Flex/Grid UI đồng nhất với TextFormatter.
- **Cấu hình Max Words (Lưu trữ vĩnh viễn)**: `maxWords` được liên kết vòng đời qua `localStorage` (key: `cv_chapter_splitter_max_words`). Trạng thái tự động khôi phục mỗi lần tải lại web. Cung cấp nhóm Quick Select Buttons `[2000, 2500, 3000, 3400, 4000]` để chuyển đổi tham số nhanh chóng chỉ với 1 thao tác click.
- **Cảnh báo tính hợp lệ (Validation UI)**: Báo lỗi Text màu đỏ nếu text đầu vào sai cấu trúc tiêu đề.
- **Tab Navigation & Realtime Stats**: Khối Stats panel hiển thị lượng phần chia và tổng số chữ. Thay vì trút toàn bộ kết quả lên một list dọc dài, UI gom nhóm các text phân tách dưới dạng Navigation Tabs. Mỗi nút thẻ Tab đều render preview độ lớn chữ của phần đó `(Ví dụ: Phần 1 - 2045 chữ)`.
- **Fullscreen Preview Modal**: Kế thừa `FullscreenPreview` từ module text-formatter để tạo không gian đọc và review thoải mái. Tính năng "Toàn màn" được gắn vào:
  - Textarea Nội dung gốc (kiểm tra trước khi chia).
  - Từng phần Output (Tab hiện hành đang mở). Nếu bật qua chế độ này, người dùng có thể lướt đọc mượt mà, kết hợp 2 nút điều hướng trái phải `◀ | ▶` sang các parts khác trong bộ kết quả một cách mạch lạc.

## Định hướng mở rộng (Developer Note)
Nếu nâng cấp việc chia chương dựa trên dung lượng tệp lưu trữ (VD: ngắt mỗi file 2MB text), ta cần chuyển đổi logic tính `words` sang mảng bytes encoding `Blob`/`TextEncoder`. Dù vậy, với scope công cụ cho Web Convert/Web Copy-paste, việc đếm theo Word như hiện tại là đủ đáp ứng và thân thiện với người dùng cuối thao tác trên Mobile.
