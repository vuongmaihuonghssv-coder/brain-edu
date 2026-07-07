# Mai Hương Website

Website cá nhân theo phong cách hoa đào Nhật Bản, có tin tức giáo dục, tuyển dụng, đăng nhập/đăng ký, khôi phục mật khẩu qua email và trang quản lý bài đăng tuyển dụng.

## Chạy dự án

1. Cài Node.js LTS.
2. Cài thư viện:

```bash
npm install
```

3. Tạo file `.env` từ `.env.example` và điền cấu hình SMTP.
4. Chạy server:

```bash
npm start
```

5. Mở:

```text
http://localhost:3000
```

## Tài khoản admin seed sẵn

- Username: `maihuong`
- Gmail: `maihuong.demo@gmail.com`
- Password: `Demo@123`

## Ghi chú

- Database SQLite sẽ tự tạo file `site.sqlite` khi server chạy lần đầu.
- Trang quản lý tuyển dụng yêu cầu đăng nhập.
- Khôi phục mật khẩu cần SMTP thật trong `.env`; nếu thiếu cấu hình, API sẽ báo lỗi rõ ràng.
- Trang giáo viên nằm tại `/teacher.html` và yêu cầu đăng nhập admin.
- Giáo viên có thể tạo nhiều bài tập tiếng Anh, mỗi câu có nhiều đáp án đúng, copy link dạng `/assignment.html?id=...` gửi học sinh.
- Học sinh nhập họ tên hoặc số báo danh cùng Gmail trước khi làm bài; sau khi nộp sẽ thấy điểm và giải thích từng câu.
