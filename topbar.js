function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("mhCurrentUser") || "null");
  } catch {
    return null;
  }
}

function isTeacherAccount(user) {
  const identity = `${user?.email || user?.username || ""}`.trim().toLowerCase();
  const domain = identity.includes("@") ? identity.split("@").pop() : identity;
  return domain === "brain.edu" || domain.endsWith(".brain.edu") || domain.endsWith(".brain");
}

function showRoleAccessMessage(message) {
  let notice = document.querySelector(".role-access-message");
  if (!notice) {
    notice = document.createElement("p");
    notice.className = "role-access-message";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add("show");
  window.clearTimeout(showRoleAccessMessage.timer);
  showRoleAccessMessage.timer = window.setTimeout(() => {
    notice.classList.remove("show");
  }, 2600);
}

function setupRoleSwitchGuard() {
  document.querySelectorAll("[data-role-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const user = readStoredUser();
      const target = link.dataset.roleTarget;
      const teacher = isTeacherAccount(user);
      const allowed = target === "teacher" ? teacher : !teacher;
      if (allowed) return;

      event.preventDefault();
      showRoleAccessMessage(
        target === "teacher"
          ? "Chỉ tài khoản Gmail giáo viên có đuôi @brain.edu mới vào được giao diện giáo viên."
          : "Chỉ tài khoản học viên mới vào được giao diện học viên."
      );
    });
  });
}

function displayUser(user) {
  const chip = document.querySelector(".user-chip");
  const name = user?.name || user?.username || user?.email || "Đăng nhập";
  const initial = name.trim().charAt(0).toUpperCase() || "N";
  if (chip) {
    chip.innerHTML = `<strong>${initial}</strong><span>${name}</span><small>▼</small>`;
  }
  document.querySelectorAll(".welcome-avatar").forEach((avatar) => {
    avatar.textContent = initial;
    avatar.setAttribute("aria-label", `Avatar ${name}`);
  });
  document.querySelectorAll("[data-user-name-target='welcome']").forEach((target) => {
    target.textContent = `Chào mừng trở lại, ${user ? name : "Giáo viên"}!`;
  });
}

function applyTheme(theme) {
  document.body.classList.toggle("teacher-dark-mode", theme === "dark");
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.textContent = theme === "dark" ? "☀" : "🌙";
    button.setAttribute("aria-label", theme === "dark" ? "Chế độ sáng" : "Chế độ tối");
  });
}

async function syncServerUser() {
  if (window.location.protocol === "file:") return;
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    const data = await response.json();
    if (data.user) {
      localStorage.setItem("mhCurrentUser", JSON.stringify(data.user));
      displayUser(data.user);
    }
  } catch {
    // Static file mode keeps the local demo user.
  }
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function buildNotifications() {
  const assignments = readJson("mhStaticAssignments", []);
  const submissions = readJson("mhStaticSubmissions", []);
  const items = [];

  submissions.slice(-3).reverse().forEach((submission) => {
    const assignment = assignments.find((item) => String(item.id) === String(submission.assignmentId));
    items.push({
      title: `${submission.studentName || "Học sinh"} đã hoàn thành bài tập`,
      text: `${assignment?.title || "Bài tập"} - ${submission.score || 0}/${submission.total || 0}`,
      time: "Vừa xong"
    });
  });

  assignments.slice(0, 2).forEach((assignment) => {
    items.push({
      title: "Bài tập đang mở",
      text: assignment.title || "Bài tập tiếng Anh",
      time: "Hôm nay"
    });
  });

  if (!items.length) {
    items.push(
      {
        title: "Minh Anh đã hoàn thành bài tập",
        text: "English Multiple-Answer Practice - 8/10 điểm",
        time: "5 phút trước"
      },
      {
        title: "Có 2 học sinh chưa nộp bài",
        text: "Nhắc lớp 6A hoàn thành trước 20:00",
        time: "30 phút trước"
      },
      {
        title: "Gợi ý ôn tập",
        text: "3 học sinh cần xem lại phần thì hiện tại đơn",
        time: "Hôm nay"
      }
    );
  }

  return items.slice(0, 5);
}

function createNotificationPanel(button) {
  const panel = document.createElement("section");
  panel.className = "notification-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="notification-panel-head">
      <h2>Thông báo</h2>
      <span>${buildNotifications().length} mới</span>
    </div>
    <div class="notification-list"></div>
  `;
  button.closest(".topbar-actions-right")?.append(panel);
  return panel;
}

function renderNotifications(panel) {
  const list = panel.querySelector(".notification-list");
  list.innerHTML = buildNotifications().map((item) => `
    <article class="notification-item">
      <strong>${item.title}</strong>
      <p>${item.text}</p>
      <small>${item.time}</small>
    </article>
  `).join("");
}

function setupSidebarToggle() {
  const sidebar = document.querySelector(".teacher-sidebar");
  const menuButton = document.querySelector(".topbar-actions-left button[aria-label*='menu']");
  if (!sidebar || !menuButton) return;

  let overlay = document.querySelector(".sidebar-overlay");
  if (!overlay) {
    overlay = document.createElement("button");
    overlay.className = "sidebar-overlay";
    overlay.type = "button";
    overlay.setAttribute("aria-label", "Đóng menu");
    document.body.append(overlay);
  }

  const closeSidebar = () => document.body.classList.remove("sidebar-open");
  menuButton.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });
  overlay.addEventListener("click", closeSidebar);
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });
}

function createLoginPanel(button) {
  const panel = document.createElement("section");
  panel.className = "quick-login-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="quick-login-head">
      <h2>Đăng nhập</h2>
      <button type="button" data-close-login aria-label="Đóng">×</button>
    </div>
    <form class="quick-login-form">
      <label>
        Tên đăng nhập hoặc Gmail
        <input type="text" name="identity" autocomplete="username" placeholder="username hoặc gmail" required>
      </label>
      <label>
        Password
        <input type="password" name="password" autocomplete="current-password" placeholder="Nhập password" required>
      </label>
      <div class="quick-login-links">
        <a href="forgot-password.html">Quên password?</a>
        <a href="register.html">Đăng ký</a>
      </div>
      <button class="quick-login-submit" type="submit">Đăng nhập</button>
      <p class="quick-login-message" role="status"></p>
    </form>
  `;
  button.closest(".topbar-actions-right")?.append(panel);
  return panel;
}

async function submitQuickLogin(form) {
  const message = form.querySelector(".quick-login-message");
  const identity = form.elements.identity.value.trim();
  const password = form.elements.password.value;
  if (!identity || !password) return null;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identity, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không đăng nhập được.");
      return data.user;
    } catch (error) {
      message.textContent = error.message;
      message.className = "quick-login-message error";
      return null;
    }
  }

  return {
    name: identity.includes("@") ? identity.split("@")[0] : identity,
    username: identity,
    email: identity.includes("@") ? identity : ""
  };
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[aria-label='Chế độ tối'], [aria-label='Chế độ sáng']").forEach((button) => {
    button.dataset.themeToggle = "true";
  });
  document.querySelectorAll("[aria-label='Thông báo']").forEach((button) => {
    button.dataset.notificationToggle = "true";
    button.classList.add("notification-button");
  });

  const storedTheme = localStorage.getItem("mhTeacherTheme") || "light";
  applyTheme(storedTheme);
  displayUser(readStoredUser());
  syncServerUser();
  setupSidebarToggle();
  setupRoleSwitchGuard();

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("teacher-dark-mode") ? "light" : "dark";
      localStorage.setItem("mhTeacherTheme", nextTheme);
      applyTheme(nextTheme);
    });
  });

  document.querySelectorAll("[data-notification-toggle]").forEach((button) => {
    const panel = createNotificationPanel(button);
    renderNotifications(panel);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderNotifications(panel);
    });
    document.addEventListener("click", (event) => {
      if (!panel.hidden && !panel.contains(event.target) && event.target !== button) {
        panel.hidden = true;
      }
    });
  });

  document.querySelectorAll(".user-chip").forEach((button) => {
    button.dataset.loginToggle = "true";
    const panel = createLoginPanel(button);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.querySelector("input")?.focus();
    });
    panel.querySelector("[data-close-login]").addEventListener("click", () => {
      panel.hidden = true;
    });
    panel.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const user = await submitQuickLogin(event.currentTarget);
      if (!user) return;
      localStorage.setItem("mhCurrentUser", JSON.stringify(user));
      displayUser(user);
      panel.querySelector(".quick-login-message").textContent = "Đăng nhập thành công.";
      panel.querySelector(".quick-login-message").className = "quick-login-message success";
      window.setTimeout(() => {
        panel.hidden = true;
      }, 450);
    });
    document.addEventListener("click", (event) => {
      if (!panel.hidden && !panel.contains(event.target) && event.target !== button) {
        panel.hidden = true;
      }
    });
  });
});
