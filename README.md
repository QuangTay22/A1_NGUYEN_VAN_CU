# Ngôi nhà của những ước mơ

Ứng dụng web tĩnh (HTML/CSS/JS thuần) dùng Supabase để:
- Xác thực người dùng bằng email/mật khẩu.
- Đăng bài và hiển thị danh sách bài viết của lớp.

## Cấu trúc file
- `index.html`: Trang đăng nhập
- `signup.html`: Trang tạo tài khoản
- `home.html`: Trang bảng tin (đăng bài + xem bài)
- `style.css`: Giao diện chung
- `app.js`: Logic Supabase và điều hướng
- `supabase.sql`: SQL tạo bảng và policy cần thiết

## Chạy local
Mở terminal tại thư mục dự án:

```bash
python3 -m http.server 4173
```

Sau đó mở: `http://localhost:4173/index.html`

## Triển khai GitHub Pages
1. Push code lên GitHub.
2. Vào `Settings` → `Pages`.
3. Chọn branch (ví dụ: `main`) và folder `/ (root)`.
4. Save và truy cập link Pages được cung cấp.

## Cấu hình Supabase
`app.js` đã chứa sẵn hằng số theo đề bài.

> Lưu ý: URL trong đề có khoảng trắng ở giữa, nên code tự chuẩn hóa URL trước khi khởi tạo client.

## Khắc phục lỗi "Failed to fetch"
Nếu Console báo `net::ERR_NAME_NOT_RESOLVED` khi gọi Supabase:
- Nguyên nhân thường là URL Supabase sai project ref.
- `app.js` luôn ưu tiên lấy đúng project ref từ `SUPABASE_ANON_KEY` để tạo endpoint chuẩn `https://<project-ref>.supabase.co` (không phụ thuộc URL bị gõ sai).
- Sau khi cập nhật code, hãy hard refresh trình duyệt (`Ctrl + F5`) để bỏ cache JS cũ trên GitHub Pages.

- Trang HTML đã gắn `app.js?v=6` để giảm nguy cơ bị cache JS cũ.

## Lỗi `column posts.user_email does not exist`
Nếu project Supabase của bạn tạo bảng `posts` từ trước và đang dùng cột `email` thay vì `user_email`:
- Frontend hiện đã tự tương thích cả 2 tên cột (`user_email` và `email`) để không bị lỗi tải/đăng bài.
- Nên chạy lại `supabase.sql` để chuẩn hóa schema về `user_email` (script có sẵn bước migrate dữ liệu từ `email` sang `user_email`).

## Lỗi `new row violates row-level security policy for table "posts"`
Nếu đăng bài bị lỗi RLS như ảnh bạn gửi:
- Nguyên nhân là policy `insert` trong Supabase đang không khớp schema hiện tại của bảng `posts`.
- Hãy chạy lại toàn bộ file `supabase.sql` mới nhất trong SQL Editor để cập nhật policy tương thích cả schema `user_email` và schema cũ `email`.
- Frontend đã ưu tiên ghi vào `user_email` và chỉ fallback sang `email` khi thật sự thiếu cột.

## Lỗi `null value in column "title" of relation "posts" violates not-null constraint`
Nếu đăng bài báo thiếu cột `title` như ảnh bạn gửi:
- Bảng `posts` trên Supabase đang có cột `title` đặt `NOT NULL`.
- Frontend mới đã tự gửi thêm `title` (tạo từ nội dung bài viết), và vẫn tương thích nếu schema không có cột `title`.
- Hãy hard refresh (`Ctrl + F5`) để trình duyệt lấy `app.js?v=6` mới nhất.
- Chạy lại `supabase.sql` để thêm default cho `title` và chuẩn hóa dữ liệu cũ.
