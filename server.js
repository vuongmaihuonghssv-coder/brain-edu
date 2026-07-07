require("dotenv").config();

const crypto = require("crypto");
const path = require("path");
const express = require("express");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const nodemailer = require("nodemailer");

const app = express();
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;

let pool = null;
let initPromise = null;

class DatabaseUnavailableError extends Error {
  constructor(message = "Database is not configured. Set DATABASE_URL to enable this API.") {
    super(message);
    this.name = "DatabaseUnavailableError";
    this.statusCode = 503;
  }
}

function isDatabaseUnavailableError(error) {
  const transientNetworkCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT"]);
  return (
    error instanceof DatabaseUnavailableError ||
    error.statusCode === 503 ||
    transientNetworkCodes.has(error.code) ||
    /^08/.test(String(error.code || "")) ||
    error.code === "3D000" ||
    error.code === "28P01"
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseUnavailableError();
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}

async function ensureDatabaseReady() {
  if (!initPromise) {
    initPromise = initDb().catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

async function query(text, params = []) {
  await ensureDatabaseReady();
  return getPool().query(text, params);
}

async function one(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function many(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

async function scalarCount(tableName) {
  const row = await one(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
  return row?.count || 0;
}

async function initDb() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS news_posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      questions_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id SERIAL PRIMARY KEY,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_name TEXT NOT NULL,
      student_code TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      answers_json TEXT NOT NULL DEFAULT '{}',
      score INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      submitted_at TIMESTAMPTZ,
      feedback TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
    CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);
    CREATE INDEX IF NOT EXISTS idx_job_posts_status_updated ON job_posts (status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_news_posts_status_featured_created ON news_posts (status, featured DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assignments_status_updated ON assignments (status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_started ON assignment_submissions (assignment_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_assignment_submissions_email ON assignment_submissions (LOWER(email));
  `);

  async function countRows(tableName) {
    const result = await db.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
    return result.rows[0]?.count || 0;
  }

  if ((await countRows("users")) === 0) {
    const insertUser = `
      INSERT INTO users (name, username, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await db.query(insertUser, ["Mai Hương Admin", "admin", "admin@brain.edu", bcrypt.hashSync("Demo@123", 10), "admin"]);
    await db.query(insertUser, ["Mai Hương Giáo viên", "maihuonggv", "maihuong@brain.edu", bcrypt.hashSync("Demo@123", 10), "teacher"]);
    await db.query(insertUser, ["Mai Hương", "maihuong", "maihuong.demo@gmail.com", bcrypt.hashSync("Demo@123", 10), "student"]);
  }

  if ((await countRows("job_posts")) === 0) {
    const insertJob = `
      INSERT INTO job_posts (title, type, description, tags, status)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await db.query(insertJob, ["Education Program Coordinator", "Full-time", "Điều phối lớp học, lịch đào tạo, tài liệu và trải nghiệm học viên cho trung tâm giáo dục.", "Planning,Communication,Office", "published"]);
    await db.query(insertJob, ["Student Care Assistant", "Part-time", "Hỗ trợ học viên, tiếp nhận phản hồi, nhắc lịch học và cập nhật hồ sơ khách hàng.", "Support,CRM,Teamwork", "published"]);
    await db.query(insertJob, ["HR & Admin Intern", "Internship", "Chuẩn bị hồ sơ, hỗ trợ phỏng vấn, nhập dữ liệu và theo dõi hoạt động nội bộ.", "Admin,Excel,People", "draft"]);
    await db.query(insertJob, ["Training Operations Assistant", "Full-time", "Theo dõi lịch phòng, tài liệu học tập và báo cáo vận hành chương trình đào tạo.", "Reports,Schedule,Detail", "hidden"]);
  }

  if ((await countRows("news_posts")) === 0) {
    const insertNews = `
      INSERT INTO news_posts (title, category, excerpt, status, featured)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await db.query(insertNews, ["Giáo dục kỹ năng mềm trở thành lợi thế cho sinh viên mới ra trường", "Xu hướng", "Nhiều doanh nghiệp đánh giá cao khả năng giao tiếp, tư duy tổ chức và tinh thần học hỏi bên cạnh kiến thức chuyên môn.", "published", 1]);
    await db.query(insertNews, ["Lớp học kết hợp giúp tăng tính chủ động của người học", "Học tập", "Hình thức học trực tiếp kết hợp tài nguyên số giúp học viên linh hoạt hơn trong ôn tập.", "published", 0]);
    await db.query(insertNews, ["Các trung tâm giáo dục chú trọng trải nghiệm học viên", "Tuyển sinh", "Dịch vụ tư vấn, chăm sóc và phản hồi nhanh đang trở thành điểm khác biệt quan trọng.", "published", 0]);
    await db.query(insertNews, ["Công cụ quản lý học tập giúp tối ưu vận hành đào tạo", "Công nghệ", "Bảng dữ liệu, lịch học và báo cáo tiến độ giúp đội ngũ quản lý lớp học hiệu quả hơn.", "published", 0]);
  }

  if ((await countRows("assignments")) === 0) {
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
    await db.query(`
      INSERT INTO assignments (title, description, questions_json, status)
      VALUES ($1, $2, $3, $4)
    `, ["English Multiple-Answer Practice", "Bài tập tiếng Anh trắc nghiệm nhiều đáp án đúng.", JSON.stringify(demoQuestions), "published"]);
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

async function getCurrentUser(req) {
  const token = parseCookies(req.headers.cookie).mh_session;
  if (!token) return null;
  return one(`
    SELECT users.id, users.name, users.username, users.email, users.role
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = $1 AND sessions.expires_at > CURRENT_TIMESTAMP
  `, [token]);
}

async function requireAuth(req, res, next) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Bạn cần đăng nhập để tiếp tục." });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)", [token, userId, expiresAt]);
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

function deriveRole(email, fallback = "student") {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized.endsWith("@brain.edu") || normalized.endsWith(".brain.edu") ? "teacher" : fallback;
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

[
  "index.html", "home.html", "about.html", "news.html", "recruitment.html",
  "login.html", "register.html", "forgot-password.html", "job-management.html",
  "teacher.html", "assignments.html", "assignment-create.html", "assignment.html",
  "assignment-code.html", "assign-work.html", "assigned-work.html", "classes.html",
  "classroom-detail.html", "student.html", "student-classes.html", "student-progress.html",
  "student-review.html", "styles.css", "auth.js", "content.js", "admin.js",
  "teacher.js", "assignments-page.js", "assignment-create.js", "assignment.js",
  "assign-work.js", "assigned-work.js", "classes.js", "classroom-detail.js",
  "student-dashboard.js", "student-tools.js", "topbar.js", "home.js"
].forEach((file) => {
  app.get(`/${file}`, (req, res) => sendPage(res, file));
});

app.use("/assets", express.static(path.join(rootDir, "assets"), { index: false }));

app.get("/api/auth/me", asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req);
  res.json({ user: user ? publicUser(user) : null });
}));

app.post("/api/auth/register", asyncHandler(async (req, res) => {
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
    const inserted = await one(`
      INSERT INTO users (name, username, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, username, email, role
    `, [name.trim(), username.trim().toLowerCase(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), deriveRole(email)]);
    const token = await createSession(inserted.id);
    setSessionCookie(res, token);
    res.status(201).json({ user: publicUser(inserted) });
  } catch (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Username hoặc email đã tồn tại." });
      return;
    }
    throw error;
  }
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { identity, password } = req.body;
  const user = await one("SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1)", [identity || ""]);
  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    res.status(401).json({ error: "Tên đăng nhập/Gmail hoặc password chưa đúng." });
    return;
  }
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
}));

app.post("/api/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = parseCookies(req.headers.cookie).mh_session;
  await query("DELETE FROM sessions WHERE token = $1", [token]);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.post("/api/auth/forgot-password", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = await one("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  if (!user) {
    res.status(404).json({ error: "Không tìm thấy tài khoản với Gmail này." });
    return;
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await query("INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)", [token, user.id, expiresAt]);

  const smtpReady = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM;
  if (!smtpReady) {
    res.status(500).json({ error: "SMTP chưa được cấu hình. Vui lòng cập nhật biến môi trường để gửi email thật." });
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

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: "Khôi phục mật khẩu Ctrl+Brain",
    text: `Bạn có thể đặt lại mật khẩu tại: ${resetLink}. Link hết hạn sau 15 phút.`,
    html: `<p>Bạn có thể đặt lại mật khẩu tại:</p><p><a href="${resetLink}">${resetLink}</a></p><p>Link hết hạn sau 15 phút.</p>`
  });

  res.json({ ok: true });
}));

app.post("/api/auth/reset-password", asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password || password.length < 6) {
    res.status(400).json({ error: "Token không hợp lệ hoặc password quá ngắn." });
    return;
  }
  const reset = await one(`
    SELECT * FROM password_reset_tokens
    WHERE token = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
  `, [token]);
  if (!reset) {
    res.status(400).json({ error: "Link khôi phục không hợp lệ hoặc đã hết hạn." });
    return;
  }
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [bcrypt.hashSync(password, 10), reset.user_id]);
  await query("UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1", [token]);
  res.json({ ok: true });
}));

app.get("/api/jobs", asyncHandler(async (req, res) => {
  const rows = await many("SELECT * FROM job_posts WHERE status = 'published' ORDER BY created_at DESC");
  res.json({ jobs: rows.map(normalizeJob) });
}));

app.get("/api/admin/jobs", requireAuth, asyncHandler(async (req, res) => {
  const { q = "", status = "" } = req.query;
  const params = [];
  let sql = "SELECT * FROM job_posts WHERE 1 = 1";
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length} OR tags ILIKE $${params.length})`;
  }
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += " ORDER BY updated_at DESC";
  const jobs = (await many(sql, params)).map(normalizeJob);
  const stats = await many("SELECT status, COUNT(*)::int AS count FROM job_posts GROUP BY status");
  res.json({ jobs, stats });
}));

app.post("/api/admin/jobs", requireAuth, asyncHandler(async (req, res) => {
  const { title, type, description, tags = "", status = "draft" } = req.body;
  if (!title || !type || !description) {
    res.status(400).json({ error: "Vui lòng nhập tiêu đề, hình thức và mô tả." });
    return;
  }
  const job = await one(`
    INSERT INTO job_posts (title, type, description, tags, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [title, type, description, tags, status]);
  res.status(201).json({ job: normalizeJob(job) });
}));

app.put("/api/admin/jobs/:id", requireAuth, asyncHandler(async (req, res) => {
  const { title, type, description, tags = "", status = "draft" } = req.body;
  const job = await one(`
    UPDATE job_posts
    SET title = $1, type = $2, description = $3, tags = $4, status = $5, updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `, [title, type, description, tags, status, req.params.id]);
  res.json({ job: normalizeJob(job) });
}));

app.patch("/api/admin/jobs/:id/status", requireAuth, asyncHandler(async (req, res) => {
  const allowed = new Set(["published", "draft", "hidden"]);
  const status = allowed.has(req.body.status) ? req.body.status : "draft";
  await query("UPDATE job_posts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [status, req.params.id]);
  res.json({ ok: true });
}));

app.delete("/api/admin/jobs/:id", requireAuth, asyncHandler(async (req, res) => {
  await query("DELETE FROM job_posts WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

app.get("/api/news", asyncHandler(async (req, res) => {
  const news = await many("SELECT * FROM news_posts WHERE status = 'published' ORDER BY featured DESC, created_at DESC");
  res.json({ news });
}));

app.post("/api/admin/news", requireAuth, asyncHandler(async (req, res) => {
  const { title, category, excerpt, status = "published", featured = 0 } = req.body;
  if (!title || !category || !excerpt) {
    res.status(400).json({ error: "Vui lòng nhập đủ thông tin tin tức." });
    return;
  }
  const news = await one(`
    INSERT INTO news_posts (title, category, excerpt, status, featured)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [title, category, excerpt, status, featured ? 1 : 0]);
  res.status(201).json({ news });
}));

app.put("/api/admin/news/:id", requireAuth, asyncHandler(async (req, res) => {
  const { title, category, excerpt, status = "published", featured = 0 } = req.body;
  const news = await one(`
    UPDATE news_posts
    SET title = $1, category = $2, excerpt = $3, status = $4, featured = $5, updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
  `, [title, category, excerpt, status, featured ? 1 : 0, req.params.id]);
  res.json({ news });
}));

app.delete("/api/admin/news/:id", requireAuth, asyncHandler(async (req, res) => {
  await query("DELETE FROM news_posts WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

app.get("/api/admin/assignments", requireAuth, asyncHandler(async (req, res) => {
  const rows = await many("SELECT * FROM assignments ORDER BY updated_at DESC");
  res.json({ assignments: rows.map((row) => sanitizeAssignment(row, true, false)) });
}));

function normalizeQuestions(questions) {
  return questions.map((question) => ({
    id: question.id || crypto.randomUUID(),
    prompt: question.prompt || "",
    explanation: question.explanation || "",
    options: (question.options || []).map((option) => ({
      id: option.id || crypto.randomUUID(),
      text: option.text || "",
      correct: Boolean(option.correct)
    }))
  }));
}

function hasInvalidQuestions(questions) {
  return questions.some((question) => {
    const filledOptions = question.options.filter((option) => option.text.trim());
    return !question.prompt.trim() || filledOptions.length < 2 || !filledOptions.some((option) => option.correct);
  });
}

app.post("/api/admin/assignments", requireAuth, asyncHandler(async (req, res) => {
  const { title, description = "", questions = [], status = "published" } = req.body;
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "Vui lòng nhập tiêu đề và ít nhất một câu hỏi." });
    return;
  }
  const normalizedQuestions = normalizeQuestions(questions);
  if (hasInvalidQuestions(normalizedQuestions)) {
    res.status(400).json({ error: "Mỗi câu cần nội dung, ít nhất 2 đáp án và ít nhất 1 đáp án đúng." });
    return;
  }
  const assignment = await one(`
    INSERT INTO assignments (title, description, questions_json, status)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [title, description, JSON.stringify(normalizedQuestions), status]);
  res.status(201).json({ assignment: sanitizeAssignment(assignment, true, false) });
}));

app.put("/api/admin/assignments/:id", requireAuth, asyncHandler(async (req, res) => {
  const { title, description = "", questions = [], status = "published" } = req.body;
  const existing = await one("SELECT * FROM assignments WHERE id = $1", [req.params.id]);
  if (!existing) {
    res.status(404).json({ error: "Không tìm thấy bài tập." });
    return;
  }
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "Vui lòng nhập tiêu đề và ít nhất một câu hỏi." });
    return;
  }
  const normalizedQuestions = normalizeQuestions(questions);
  if (hasInvalidQuestions(normalizedQuestions)) {
    res.status(400).json({ error: "Mỗi câu cần nội dung, ít nhất 2 đáp án và ít nhất 1 đáp án đúng." });
    return;
  }
  const assignment = await one(`
    UPDATE assignments
    SET title = $1, description = $2, questions_json = $3, status = $4, updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `, [title, description, JSON.stringify(normalizedQuestions), status, req.params.id]);
  res.json({ assignment: sanitizeAssignment(assignment, true, false) });
}));

app.delete("/api/admin/assignments/:id", requireAuth, asyncHandler(async (req, res) => {
  await query("DELETE FROM assignments WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

app.get("/api/admin/assignments/:id/submissions", requireAuth, asyncHandler(async (req, res) => {
  const submissions = (await many(`
    SELECT * FROM assignment_submissions
    WHERE assignment_id = $1
    ORDER BY started_at DESC
  `, [req.params.id])).map((submission) => ({
    ...submission,
    answers: JSON.parse(submission.answers_json || "{}")
  }));
  res.json({ submissions });
}));

app.put("/api/admin/submissions/:id/feedback", requireAuth, asyncHandler(async (req, res) => {
  await query("UPDATE assignment_submissions SET feedback = $1 WHERE id = $2", [req.body.feedback || "", req.params.id]);
  res.json({ ok: true });
}));

app.delete("/api/admin/submissions/:id", requireAuth, asyncHandler(async (req, res) => {
  await query("DELETE FROM assignment_submissions WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
}));

app.get("/api/assignments/:id", asyncHandler(async (req, res) => {
  const assignment = await one("SELECT * FROM assignments WHERE id = $1 AND status = 'published'", [req.params.id]);
  if (!assignment) {
    res.status(404).json({ error: "Không tìm thấy bài tập hoặc bài tập chưa được mở." });
    return;
  }
  res.json({ assignment: sanitizeAssignment(assignment, false, true) });
}));

app.post("/api/assignments/:id/start", asyncHandler(async (req, res) => {
  const assignment = await one("SELECT * FROM assignments WHERE id = $1 AND status = 'published'", [req.params.id]);
  if (!assignment) {
    res.status(404).json({ error: "Không tìm thấy bài tập hoặc bài tập chưa được mở." });
    return;
  }
  const { studentName = "", studentCode = "", email = "" } = req.body;
  if ((!studentName.trim() && !studentCode.trim()) || !email.trim()) {
    res.status(400).json({ error: "Học sinh cần nhập tên hoặc số báo danh và Gmail." });
    return;
  }
  const submission = await one(`
    INSERT INTO assignment_submissions (assignment_id, student_name, student_code, email)
    VALUES ($1, $2, $3, $4)
    RETURNING id, started_at
  `, [req.params.id, studentName.trim() || studentCode.trim(), studentCode.trim(), email.trim().toLowerCase()]);
  res.status(201).json({ submissionId: submission.id, startedAt: submission.started_at });
}));

app.post("/api/assignments/:id/submit", asyncHandler(async (req, res) => {
  await ensureDatabaseReady();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const assignmentResult = await client.query("SELECT * FROM assignments WHERE id = $1 AND status = 'published'", [req.params.id]);
    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Không tìm thấy bài tập hoặc bài tập chưa được mở." });
      return;
    }

    const submissionResult = await client.query(`
      SELECT * FROM assignment_submissions
      WHERE id = $1 AND assignment_id = $2
      FOR UPDATE
    `, [req.body.submissionId, req.params.id]);
    const submission = submissionResult.rows[0];
    if (!submission) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Phiên làm bài không hợp lệ." });
      return;
    }
    if (submission.submitted_at) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Bài làm này đã được nộp." });
      return;
    }

    const answers = req.body.answers || {};
    const result = evaluateAssignment(assignment, answers);
    const completedResult = await client.query(`
      UPDATE assignment_submissions
      SET answers_json = $1, score = $2, total = $3, submitted_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [JSON.stringify(answers), result.score, result.total, submission.id]);

    await client.query("COMMIT");
    const completed = completedResult.rows[0];
    res.json({
      score: result.score,
      total: result.total,
      startedAt: completed.started_at,
      submittedAt: completed.submitted_at,
      details: result.details
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    next(error);
    return;
  }
  if (isDatabaseUnavailableError(error)) {
    res.status(503).json({
      error: "Database is unavailable.",
      message: "Set a valid DATABASE_URL to enable this API. Static pages still work without a database."
    });
    return;
  }
  res.status(500).json({ error: "Server gặp lỗi. Vui lòng thử lại sau." });
});

async function startServer() {
  app.listen(port, () => {
    const databaseStatus = process.env.DATABASE_URL ? "database will initialize on first API use" : "database disabled";
    console.log(`Mai Huong website is running at ${appUrl} (${databaseStatus})`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
