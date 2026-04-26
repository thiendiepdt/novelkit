# Đóng góp cho NovelKit

Cảm ơn bạn đã quan tâm đến việc đóng góp! NovelKit là bộ công cụ web & desktop dành cho converter/dịch giả truyện chữ Trung Quốc, và chúng tôi luôn chào đón mọi đóng góp từ cộng đồng.

## Bắt đầu

### Yêu cầu

**Phiên bản web:**
- **Node.js** ≥ 20.x (khuyến nghị dùng [nvm](https://github.com/nvm-sh/nvm))
- **npm** ≥ 10.x

**Phiên bản desktop (thêm):**
- **Rust** ≥ 1.77 ([cài đặt](https://www.rust-lang.org/tools/install))
- **Tauri CLI**: đã có trong devDependencies, không cần cài riêng

### Phát triển local

```bash
# Clone repository
git clone https://github.com/thiendiepdt/novelkit.git
cd novelkit

# Cài đặt dependencies
npm install

# Khởi chạy phiên bản web
npm run dev

# Khởi chạy phiên bản desktop (Tauri + HMR)
npm run dev:desktop
```

Phiên bản web chạy tại `http://localhost:1420`.

### Cấu trúc dự án

```
src/                        # React frontend (dùng chung web & desktop)
├── features/               # Các module tính năng (mỗi module độc lập)
│   ├── home/               # Trang chủ
│   ├── text-formatter/     # Công cụ định dạng văn bản
│   ├── chapter-splitter/   # Công cụ chia chương
│   └── translator/         # Dịch nhanh (QT Web)
├── shared/                 # Code dùng chung: utilities, hooks, components
│   ├── components/         # UI component tái sử dụng
│   ├── hooks/              # Custom React hooks
│   └── utils/              # Hàm tiện ích thuần
└── index.css               # Global styles & design tokens

src-tauri/                  # Tauri Rust backend (chỉ cho desktop)
├── src/
│   ├── main.rs             # Entry point
│   └── lib.rs              # App builder, plugin, custom commands
├── capabilities/           # Cấu hình quyền bảo mật Tauri v2
├── tauri.conf.json         # Cấu hình Tauri
└── Cargo.toml              # Dependencies Rust
```

## Cách đóng góp

### Báo lỗi (Bug Report)

1. Kiểm tra [danh sách issues hiện có](https://github.com/thiendiepdt/novelkit/issues) để tránh trùng lặp
2. Sử dụng template **Báo lỗi**
3. Mô tả rõ các bước tái hiện lỗi, hành vi mong đợi và hành vi thực tế

### Đề xuất tính năng

1. Mở issue dạng **Đề xuất tính năng**
2. Mô tả use case và giải pháp đề xuất
3. Thảo luận trong issue trước khi bắt tay code

### Gửi code

1. **Fork** repository
2. **Tạo branch** từ `main`: `git checkout -b feat/ten-tinh-nang`
3. **Code** theo chuẩn bên dưới
4. **Test** thay đổi: `npm run test && npm run lint && npm run build`
5. **Commit** với message rõ ràng: `feat: thêm word count vào stats panel`
6. **Push** và mở **Pull Request**

### Quy ước commit

Dự án tuân theo [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Mục đích |
|--------|----------|
| `feat:` | Tính năng mới |
| `fix:` | Sửa lỗi |
| `refactor:` | Tái cấu trúc code (không thay đổi hành vi) |
| `docs:` | Chỉ thay đổi tài liệu |
| `test:` | Thêm hoặc cập nhật test |
| `chore:` | Thay đổi build, CI, tooling |

### Chuẩn code

- **TypeScript strict mode** — không dùng kiểu `any`
- **Kiến trúc feature-based** — code của tính năng nằm trong folder riêng
- **Code dùng chung** đặt trong `src/shared/` — không bao giờ import từ feature này sang feature khác
- **Dùng path alias** — `@/shared/utils/clipboard` thay vì `../../shared/utils/clipboard`
- **Hàm tiện ích thuần** phải test được độc lập không cần React — đặt trong thư mục `utils/`
- **Component** nên tập trung — mục tiêu < 200 dòng mỗi file
- **Platform-gated code** — không import `@tauri-apps/*` ở top-level, luôn dùng dynamic `import()` sau `isTauri()`
- Chạy `npm run lint` trước khi commit

### Chạy test

```bash
# Chạy toàn bộ test
npm run test

# Chế độ watch
npm run test:watch

# Kèm báo cáo coverage
npm run test:coverage
```

Những gì cần test:
- **Hàm tiện ích cốt lõi** (`formatter.ts`, `splitter.ts`, `Engine.ts`) — unit test
- **Shared utils** (`clipboard.ts`, `download.ts`) — unit test
- **Component** — chỉ test logic phức tạp, không test layout

### Phát triển desktop (Tauri)

Khi thêm tính năng desktop-only:

1. Luôn kiểm tra platform bằng `isTauri()` trước khi gọi Tauri API
2. Dùng dynamic import cho `@tauri-apps/plugin-*`
3. Thêm quyền cần thiết vào `src-tauri/capabilities/default.json`
4. Custom Rust command đăng ký trong `src-tauri/src/lib.rs`

```typescript
// ✅ Đúng — lazy import sau khi kiểm tra platform
if (isTauri()) {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const content = await readTextFile(path);
}

// ❌ Sai — import top-level sẽ crash trên web
import { readTextFile } from '@tauri-apps/plugin-fs';
```

## Quy tắc ứng xử

Hãy lịch sự và tôn trọng lẫn nhau. Chúng ta đều ở đây để xây dựng công cụ hữu ích cho cộng đồng dịch truyện chữ. Mọi hành vi quấy rối, phân biệt đối xử hoặc toxic đều không được chấp nhận.

## Có thắc mắc?

Mở [Discussion](https://github.com/thiendiepdt/novelkit/discussions) hoặc tạo Issue. Chúng tôi sẵn lòng hỗ trợ!
