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
