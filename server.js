require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");

const app = express();
const rootDir = __dirname;
const db = new Database(path.join(rootDir, "site.sqlite"));
const port = Number(process.env.PORT || 3000);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS job_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS news_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      questions_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      student_code TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      answers_json TEXT NOT NULL DEFAULT '{}',
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      submitted_at TEXT,
      feedback TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
    );
  `);

  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (userCount === 0) {
    db.prepare(`
      INSERT INTO users (name, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "Mai Hương",
      "maihuong",
      "maihuong.demo@gmail.com",
      bcrypt.hashSync("Demo@123", 10),
      "admin"
    );
  }

  const jobCount = db.prepare("SELECT COUNT(*) AS count FROM job_posts").get().count;
  if (jobCount === 0) {
    const insertJob = db.prepare(`
      INSERT INTO job_posts (title, type, description, tags, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertJob.run("Education Program Coordinator", "Full-time", "Điều phối lớp học, lịch đào tạo, tài liệu và trải nghiệm học viên cho trung tâm giáo dục.", "Planning,Communication,Office", "published");
    insertJob.run("Student Care Assistant", "Part-time", "Hỗ trợ học viên, tiếp nhận phản hồi, nhắc lịch học và cập nhật hồ sơ khách hàng.", "Support,CRM,Teamwork", "published");
    insertJob.run("HR & Admin Intern", "Internship", "Chuẩn bị hồ sơ, hỗ trợ phỏng vấn, nhập dữ liệu và theo dõi hoạt động nội bộ.", "Admin,Excel,People", "draft");
    insertJob.run("Training Operations Assistant", "Full-time", "Theo dõi lịch phòng, tài liệu học tập và báo cáo vận hành chương trình đào tạo.", "Reports,Schedule,Detail", "hidden");
  }

  const newsCount = db.prepare("SELECT COUNT(*) AS count FROM news_posts").get().count;
  if (newsCount === 0) {
    const insertNews = db.prepare(`
      INSERT INTO news_posts (title, category, excerpt, status, featured)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertNews.run("Giáo dục kỹ năng mềm trở thành lợi thế cho sinh viên mới ra trường", "Xu hướng", "Nhiều doanh nghiệp đánh giá cao khả năng giao tiếp, tư duy tổ chức và tinh thần học hỏi bên cạnh kiến thức chuyên môn.", "published", 1);
    insertNews.run("Lớp học kết hợp giúp tăng tính chủ động của người học", "Học tập", "Hình thức học trực tiếp kết hợp tài nguyên số giúp học viên linh hoạt hơn trong ôn tập.", "published", 0);
    insertNews.run("Các trung tâm giáo dục chú trọng trải nghiệm học viên", "Tuyển sinh", "Dịch vụ tư vấn, chăm sóc và phản hồi nhanh đang trở thành điểm khác biệt quan trọng.", "published", 0);
    insertNews.run("Công cụ quản lý học tập giúp tối ưu vận hành đào tạo", "Công nghệ", "Bảng dữ liệu, lịch học và báo cáo tiến độ giúp đội ngũ quản lý lớp học hiệu quả hơn.", "published", 0);
  }

  const assignmentCount = db.prepare("SELECT COUNT(*) AS count FROM assignments").get().count;
  if (assignmentCount === 0) {
    const demoQuestions = [
      {
        id: crypto.randomUUID(),
        prompt: "Choose the correct meanings of the word 'bright'.",
        explanation: "'Bright' can describe strong light and also an intelligent person.",
        options: [
          { id: crypto.randomUUID(), text: "Full of light", correct: true },
          { id: crypto.randomUUID(), text: "Intelligent", correct: true },
          { id: crypto.randomUUID(), text: "Very quiet", correct: false },
          { id: crypto.randomUUID(), text: "Extremely cold", correct: false }
        ]
      },
      {
        id: crypto.randomUUID(),
        prompt: "Which sentences use the present simple correctly?",
        explanation: "Present simple uses the base verb, and adds -s/-es for he, she, it.",
        options: [
          { id: crypto.randomUUID(), text: "She studies English every day.", correct: true },
          { id: crypto.randomUUID(), text: "They play football on Sundays.", correct: true },
          { id: crypto.randomUUID(), text: "He go to school by bus.", correct: false },
          { id: crypto.randomUUID(), text: "I am like apples.", correct: false }
        ]
      }
    ];
    db.prepare(`
      INSERT INTO assignments (title, description, questions_json, status)
      VALUES (?, ?, ?, ?)
    `).run("English Multiple-Answer Practice", "Bài tập tiếng Anh trắc nghiệm nhiều đáp án đúng.", JSON.stringify(demoQuestions), "published");
  }
}

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `mh_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "mh_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function getCurrentUser(req) {
  const token = parseCookies(req.headers.cookie).mh_session;
  if (!token) return null;
  const session = db.prepare(`
    SELECT users.id, users.name, users.username, users.email, users.role
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND datetime(sessions.expires_at) > datetime('now')
  `).get(token);
  return session || null;
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: "Bạn cần đăng nhập để tiếp tục." });
    return;
  }
  req.user = user;
  next();
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expiresAt);
  return token;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role
  };
}

function normalizeJob(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : []
  };
}

function parseQuestions(row) {
  return JSON.parse(row.questions_json || "[]");
}

function shuffleItems(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function sanitizeAssignment(row, includeAnswers = false, randomizeOptions = false) {
  const questions = parseQuestions(row).map((question) => {
    const options = (randomizeOptions ? shuffleItems(question.options || []) : question.options || []).map((option) => {
      if (includeAnswers) return option;
      return { id: option.id, text: option.text };
    });
    return {
      id: question.id,
      prompt: question.prompt,
      explanation: includeAnswers ? question.explanation : undefined,
      options
    };
  });
  return { ...row, questions, questions_json: undefined };
}

function evaluateAssignment(assignment, answers) {
  const questions = parseQuestions(assignment);
  let score = 0;
  const details = questions.map((question) => {
    const correctIds = (question.options || []).filter((option) => option.correct).map((option) => option.id).sort();
    const selectedIds = [...(answers[question.id] || [])].sort();
    const correct = correctIds.length === selectedIds.length && correctIds.every((id, index) => id === selectedIds[index]);
    if (correct) score += 1;
    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedIds,
      correctIds,
      correct,
      explanation: question.explanation,
      options: question.options || []
    };
  });
  return { score, total: questions.length, details };
}

function sendPage(res, file) {
  res.sendFile(path.join(rootDir, file));
}

app.get("/", (req, res) => sendPage(res, "about.html"));
["index.html", "home.html", "about.html", "news.html", "recruitment.html", "login.html", "register.html", "forgot-password.html", "job-management.html", "teacher.html", "assignments.html", "assignment-create.html", "assignment.html", "styles.css", "auth.js", "content.js", "admin.js", "teacher.js", "assignments-page.js", "assignment-create.js", "assignment.js", "student-dashboard.js", "home.js"].forEach((file) => {
  app.get(`/${file}`, (req, res) => sendPage(res, file));
});

app.get("/api/auth/me", (req, res) => {
  const user = getCurrentUser(req);
  res.json({ user: user ? publicUser(user) : null });
});

app.post("/api/auth/register", (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password cần tối thiểu 6 ký tự." });
    return;
  }

  try {
    const result = db.prepare(`
      INSERT INTO users (name, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), "admin");
    const token = createSession(result.lastInsertRowid);
    setSessionCookie(res, token);
    const user = db.prepare("SELECT id, name, username, email, role FROM users WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    res.status(409).json({ error: "Username hoặc email đã tồn tại." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { identity, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)").get(identity || "", identity || "");
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    res.status(401).json({ error: "Tên đăng nhập/Gmail hoặc password chưa đúng." });
    return;
  }
  const token = createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = parseCookies(req.headers.cookie).mh_session;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy tài khoản với Gmail này." });
    return;
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, user.id, expiresAt);

  const smtpReady = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM;
  if (!smtpReady) {
    res.status(500).json({ error: "SMTP chưa được cấu hình. Vui lòng cập nhật file .env để gửi email thật." });
    return;
  }

  const resetLink = `${appUrl}/forgot-password.html?token=${token}`;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: "Khôi phục mật khẩu Mai Hương Website",
    text: `Bạn có thể đặt lại mật khẩu tại: ${resetLink}. Link hết hạn sau 15 phút.`,
    html: `<p>Bạn có thể đặt lại mật khẩu tại:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Link hết hạn sau 15 phút.</p>`
  }).then(() => {
    res.json({ ok: true });
  }).catch(() => {
    res.status(500).json({ error: "Không gửi được email. Vui lòng kiểm tra cấu hình SMTP." });
  });
});

app.post("/api/auth/reset-password", (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) {
    res.status(400).json({ error: "Token không hợp lệ hoặc password quá ngắn." });
    return;
  }
  const reset = db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')
  `).get(token);
  if (!reset) {
    res.status(400).json({ error: "Link khôi phục không hợp lệ hoặc đã hết hạn." });
    return;
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), reset.user_id);
  db.prepare("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = ?").run(token);
  res.json({ ok: true });
});

app.get("/api/jobs", (req, res) => {
  const rows = db.prepare("SELECT * FROM job_posts WHERE status = 'published' ORDER BY datetime(created_at) DESC").all();
  res.json({ jobs: rows.map(normalizeJob) });
});

app.get("/api/admin/jobs", requireAuth, (req, res) => {
  const { q = "", status = "" } = req.query;
  const params = [];
  let sql = "SELECT * FROM job_posts WHERE 1 = 1";
  if (q) {
    sql += " AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  sql += " ORDER BY datetime(updated_at) DESC";
  const jobs = db.prepare(sql).all(...params).map(normalizeJob);
  const stats = db.prepare("SELECT status, COUNT(*) AS count FROM job_posts GROUP BY status").all();
  res.json({ jobs, stats });
});

app.post("/api/admin/jobs", requireAuth, (req, res) => {
  const { title, type, description, tags = "", status = "draft" } = req.body;
  if (!title || !type || !description) {
    res.status(400).json({ error: "Vui lòng nhập tiêu đề, hình thức và mô tả." });
    return;
  }
  const result = db.prepare(`
    INSERT INTO job_posts (title, type, description, tags, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, type, description, tags, status);
  const job = db.prepare("SELECT * FROM job_posts WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ job: normalizeJob(job) });
});

app.put("/api/admin/jobs/:id", requireAuth, (req, res) => {
  const { title, type, description, tags = "", status = "draft" } = req.body;
  db.prepare(`
    UPDATE job_posts
    SET title = ?, type = ?, description = ?, tags = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, type, description, tags, status, req.params.id);
  const job = db.prepare("SELECT * FROM job_posts WHERE id = ?").get(req.params.id);
  res.json({ job: normalizeJob(job) });
});

app.patch("/api/admin/jobs/:id/status", requireAuth, (req, res) => {
  const allowed = new Set(["published", "draft", "hidden"]);
  const status = allowed.has(req.body.status) ? req.body.status : "draft";
  db.prepare("UPDATE job_posts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/admin/jobs/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM job_posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/news", (req, res) => {
  const news = db.prepare("SELECT * FROM news_posts WHERE status = 'published' ORDER BY featured DESC, datetime(created_at) DESC").all();
  res.json({ news });
});

app.post("/api/admin/news", requireAuth, (req, res) => {
  const { title, category, excerpt, status = "published", featured = 0 } = req.body;
  if (!title || !category || !excerpt) {
    res.status(400).json({ error: "Vui lòng nhập đủ thông tin tin tức." });
    return;
  }
  const result = db.prepare(`
    INSERT INTO news_posts (title, category, excerpt, status, featured)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, category, excerpt, status, featured ? 1 : 0);
  res.status(201).json({ news: db.prepare("SELECT * FROM news_posts WHERE id = ?").get(result.lastInsertRowid) });
});

app.put("/api/admin/news/:id", requireAuth, (req, res) => {
  const { title, category, excerpt, status = "published", featured = 0 } = req.body;
  db.prepare(`
    UPDATE news_posts
    SET title = ?, category = ?, excerpt = ?, status = ?, featured = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, category, excerpt, status, featured ? 1 : 0, req.params.id);
  res.json({ news: db.prepare("SELECT * FROM news_posts WHERE id = ?").get(req.params.id) });
});

app.delete("/api/admin/news/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM news_posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/assignments", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM assignments ORDER BY datetime(updated_at) DESC").all();
  res.json({ assignments: rows.map((row) => sanitizeAssignment(row, true, false)) });
});

app.post("/api/admin/assignments", requireAuth, (req, res) => {
  const { title, description = "", questions = [], status = "published" } = req.body;
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "Vui lòng nhập tiêu đề và ít nhất một câu hỏi." });
    return;
  }
  const normalizedQuestions = questions.map((question) => ({
    id: question.id || crypto.randomUUID(),
    prompt: question.prompt || "",
    explanation: question.explanation || "",
    options: (question.options || []).map((option) => ({
      id: option.id || crypto.randomUUID(),
      text: option.text || "",
      correct: Boolean(option.correct)
    }))
  }));
  const invalid = normalizedQuestions.some((question) => {
    const filledOptions = question.options.filter((option) => option.text.trim());
    return !question.prompt.trim() || filledOptions.length < 2 || !filledOptions.some((option) => option.correct);
  });
  if (invalid) {
    res.status(400).json({ error: "Mỗi câu cần nội dung, ít nhất 2 đáp án và ít nhất 1 đáp án đúng." });
    return;
  }
  const result = db.prepare(`
    INSERT INTO assignments (title, description, questions_json, status)
    VALUES (?, ?, ?, ?)
  `).run(title, description, JSON.stringify(normalizedQuestions), status);
  const assignment = db.prepare("SELECT * FROM assignments WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ assignment: sanitizeAssignment(assignment, true, false) });
});

app.put("/api/admin/assignments/:id", requireAuth, (req, res) => {
  const { title, description = "", questions = [], status = "published" } = req.body;
  const existing = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy bài tập." });
    return;
  }
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "Vui lòng nhập tiêu đề và ít nhất một câu hỏi." });
    return;
  }
  const normalizedQuestions = questions.map((question) => ({
    id: question.id || crypto.randomUUID(),
    prompt: question.prompt || "",
    explanation: question.explanation || "",
    options: (question.options || []).map((option) => ({
      id: option.id || crypto.randomUUID(),
      text: option.text || "",
      correct: Boolean(option.correct)
    }))
  }));
  db.prepare(`
    UPDATE assignments
    SET title = ?, description = ?, questions_json = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, JSON.stringify(normalizedQuestions), status, req.params.id);
  const assignment = db.prepare("SELECT * FROM assignments WHERE id = ?").get(req.params.id);
  res.json({ assignment: sanitizeAssignment(assignment, true, false) });
});

app.delete("/api/admin/assignments/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM assignments WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/assignments/:id/submissions", requireAuth, (req, res) => {
  const submissions = db.prepare(`
    SELECT * FROM assignment_submissions
    WHERE assignment_id = ?
    ORDER BY datetime(started_at) DESC
  `).all(req.params.id).map((submission) => ({
    ...submission,
    answers: JSON.parse(submission.answers_json || "{}")
  }));
  res.json({ submissions });
});

app.put("/api/admin/submissions/:id/feedback", requireAuth, (req, res) => {
  db.prepare("UPDATE assignment_submissions SET feedback = ? WHERE id = ?").run(req.body.feedback || "", req.params.id);
  res.json({ ok: true });
});

app.delete("/api/admin/submissions/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM assignment_submissions WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/assignments/:id", (req, res) => {
  const assignment = db.prepare("SELECT * FROM assignments WHERE id = ? AND status = 'published'").get(req.params.id);
  if (!assignment) {
    res.status(404).json({ error: "Không tìm thấy bài tập hoặc bài tập chưa được mở." });
    return;
  }
  res.json({ assignment: sanitizeAssignment(assignment, false, true) });
});

app.post("/api/assignments/:id/start", (req, res) => {
  const assignment = db.prepare("SELECT * FROM assignments WHERE id = ? AND status = 'published'").get(req.params.id);
  if (!assignment) {
    res.status(404).json({ error: "Không tìm thấy bài tập hoặc bài tập chưa được mở." });
    return;
  }
  const { studentName = "", studentCode = "", email = "" } = req.body;
  if ((!studentName.trim() && !studentCode.trim()) || !email.trim()) {
    res.status(400).json({ error: "Học sinh cần nhập tên hoặc số báo danh và Gmail." });
    return;
  }
  const result = db.prepare(`
    INSERT INTO assignment_submissions (assignment_id, student_name, student_code, email)
    VALUES (?, ?, ?, ?)
  `).run(req.params.id, studentName.trim() || studentCode.trim(), studentCode.trim(), email.trim().toLowerCase());
  res.status(201).json({ submissionId: result.lastInsertRowid, startedAt: new Date().toISOString() });
});

app.post("/api/assignments/:id/submit", (req, res) => {
  const assignment = db.prepare("SELECT * FROM assignments WHERE id = ? AND status = 'published'").get(req.params.id);
  if (!assignment) {
    res.status(404).json({ error: "Không tìm thấy bài tập hoặc bài tập chưa được mở." });
    return;
  }
  const submission = db.prepare("SELECT * FROM assignment_submissions WHERE id = ? AND assignment_id = ?").get(req.body.submissionId, req.params.id);
  if (!submission) {
    res.status(404).json({ error: "Phiên làm bài không hợp lệ." });
    return;
  }
  if (submission.submitted_at) {
    res.status(400).json({ error: "Bài làm này đã được nộp." });
    return;
  }
  const answers = req.body.answers || {};
  const result = evaluateAssignment(assignment, answers);
  db.prepare(`
    UPDATE assignment_submissions
    SET answers_json = ?, score = ?, total = ?, submitted_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(answers), result.score, result.total, submission.id);
  const completed = db.prepare("SELECT * FROM assignment_submissions WHERE id = ?").get(submission.id);
  res.json({
    score: result.score,
    total: result.total,
    startedAt: completed.started_at,
    submittedAt: completed.submitted_at,
    details: result.details
  });
});

initDb();
app.listen(port, () => {
  console.log(`Mai Huong website is running at ${appUrl}`);
});
