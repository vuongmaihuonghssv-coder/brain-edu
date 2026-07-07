# Ctrl+Brain / Mai Hương Website

Website cá nhân và nền tảng học tiếng Anh gồm trang giới thiệu, tin tức, tuyển dụng, đăng nhập/đăng ký, khôi phục mật khẩu, trang giáo viên, học viên, bài tập, nộp bài và quản lý lớp.

Backend hiện dùng PostgreSQL để deploy ổn định trên Render. Giao diện HTML/CSS/JS hiện có được giữ nguyên.

## Chạy Local

1. Cài Node.js LTS.
2. Cài thư viện:

```bash
npm install
```

3. Tạo file `.env` từ `.env.example`.
4. Điền PostgreSQL connection string:

```text
DATABASE_URL=postgresql://user:password@host:5432/database
```

5. Chạy server:

```bash
npm start
```

6. Mở:

```text
http://localhost:3000
```

## Tài Khoản Demo Được Seed

Nếu database trống, server tự tạo bảng và seed:

- Admin: `admin` / `admin@brain.edu` / `Demo@123`
- Giáo viên: `maihuonggv` / `maihuong@brain.edu` / `Demo@123`
- Học viên: `maihuong` / `maihuong.demo@gmail.com` / `Demo@123`

Mật khẩu được mã hóa bằng `bcryptjs`, không lưu dạng văn bản trong database.

## Deploy Render

### Cách 1: Dùng `render.yaml`

1. Đẩy project lên GitHub.
2. Vào Render, chọn **New > Blueprint**.
3. Chọn repository.
4. Render sẽ đọc `render.yaml` và tạo:
   - Web service Node.js.
   - PostgreSQL database.
5. Sau khi deploy, vào Web Service > Environment và điền các biến còn thiếu:
   - `APP_URL`: URL Render của web, ví dụ `https://ctrl-brain-web.onrender.com`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `SMTP_FROM`

### Cách 2: Tạo Thủ Công

1. Render > **New > PostgreSQL**.
2. Tạo database, copy `Internal Database URL` hoặc `External Database URL`.
3. Render > **New > Web Service**.
4. Build Command:

```bash
npm install
```

5. Start Command:

```bash
npm start
```

6. Environment Variables:

```text
NODE_ENV=production
DATABASE_URL=<PostgreSQL connection string của Render>
APP_URL=<URL web service Render>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<email gửi khôi phục mật khẩu>
SMTP_PASS=<app password>
SMTP_FROM="Ctrl+Brain <email gửi khôi phục mật khẩu>"
```

Render tự cấp `PORT`; server dùng `process.env.PORT || 3000`.

## Migration Từ SQLite Cũ

Nếu còn file `site.sqlite` và muốn chuyển dữ liệu cũ sang PostgreSQL:

1. Cấu hình `.env` với `DATABASE_URL`.
2. Chạy server một lần để tạo bảng PostgreSQL:

```bash
npm start
```

3. Dừng server.
4. Cài tạm thư viện đọc SQLite:

```bash
npm install --no-save better-sqlite3
```

5. Chạy migration:

```bash
npm run migrate:sqlite-to-postgres
```

Nếu file SQLite ở vị trí khác:

```bash
SQLITE_PATH=/path/to/site.sqlite npm run migrate:sqlite-to-postgres
```

Sau khi migrate xong, runtime chính vẫn chỉ dùng PostgreSQL.

## Ghi Chú Kỹ Thuật

- PostgreSQL dùng `pg.Pool` để xử lý nhiều request cùng lúc.
- Các bảng được tự tạo nếu chưa tồn tại.
- Có index cho `users`, `sessions`, `password_reset_tokens`, `job_posts`, `news_posts`, `assignments`, `assignment_submissions`.
- API nộp bài dùng transaction và khóa submission bằng `FOR UPDATE` để tránh nộp trùng khi nhiều request đồng thời.
- Khôi phục mật khẩu cần SMTP thật; nếu thiếu cấu hình, API trả lỗi rõ ràng.
