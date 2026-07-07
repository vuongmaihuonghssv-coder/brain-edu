async function apiRequest(url, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("Vui lòng chạy website bằng server Node.js để dùng chức năng này.");
  }
  let response;
  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "same-origin",
      ...options
    });
  } catch {
    throw new Error("Không kết nối được backend. Hãy chạy npm start rồi mở http://localhost:3000.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Có lỗi xảy ra. Vui lòng thử lại.");
  }
  return data;
}

const LOCAL_USERS_KEY = "mhLocalUsers";

function isStaticMode() {
  return window.location.protocol === "file:";
}

function readLocalUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function normalizeIdentity(value) {
  return `${value || ""}`.trim().toLowerCase();
}

function isTeacherIdentity(value) {
  const identity = normalizeIdentity(value);
  const domain = identity.includes("@") ? identity.split("@").pop() : identity;
  return domain === "brain.edu" || domain.endsWith(".brain.edu") || domain.endsWith(".brain");
}

function getAuthDestination(user) {
  return isTeacherIdentity(user?.email || user?.username) ? "teacher.html" : "student.html";
}

function seedDemoUser() {
  const users = readLocalUsers();
  const demoUsers = [
    {
      id: "demo-maihuong-student",
      name: "Mai Huong",
      username: "maihuong",
      email: "maihuong.demo@gmail.com",
      password: "Demo@123",
      createdAt: new Date().toISOString()
    },
    {
      id: "demo-maihuong-teacher",
      name: "Mai Huong Giao vien",
      username: "maihuonggv",
      email: "maihuong@brain.edu",
      password: "Demo@123",
      createdAt: new Date().toISOString()
    }
  ];
  const nextUsers = [...users];
  demoUsers.forEach((demoUser) => {
    const exists = nextUsers.some((user) => (
      normalizeIdentity(user.username) === normalizeIdentity(demoUser.username)
      || normalizeIdentity(user.email) === normalizeIdentity(demoUser.email)
    ));
    if (!exists) nextUsers.unshift(demoUser);
  });
  writeLocalUsers(nextUsers);
  return nextUsers;
}

function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email
  };
}

function localRegister({ name, email, username, password }) {
  const users = seedDemoUser();
  const emailKey = normalizeIdentity(email);
  const usernameKey = normalizeIdentity(username);
  const exists = users.some((user) => (
    normalizeIdentity(user.email) === emailKey || normalizeIdentity(user.username) === usernameKey
  ));

  if (exists) {
    throw new Error("Gmail hoặc tên đăng nhập này đã tồn tại.");
  }

  const user = {
    id: `local-${Date.now()}`,
    name,
    email,
    username,
    password,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeLocalUsers(users);
  return { user: toPublicUser(user) };
}

function localLogin({ identity, password }) {
  const users = seedDemoUser();
  const identityKey = normalizeIdentity(identity);
  const user = users.find((item) => (
    normalizeIdentity(item.email) === identityKey || normalizeIdentity(item.username) === identityKey
  ));

  if (!user || user.password !== password) {
    throw new Error("Tên đăng nhập/Gmail hoặc password chưa đúng.");
  }

  return { user: toPublicUser(user) };
}

if (isStaticMode()) {
  seedDemoUser();
}

function setMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = `form-message ${type}`;
}

document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.togglePassword);
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    button.textContent = isHidden ? "Ẩn" : "Hiện";
  });
});

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const identity = document.getElementById("loginIdentity").value.trim();
    const password = document.getElementById("loginPassword").value;
    const message = document.getElementById("loginMessage");

    try {
      const data = isStaticMode()
        ? localLogin({ identity, password })
        : await apiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ identity, password })
        });
      localStorage.setItem("mhCurrentUser", JSON.stringify(data.user));
      setMessage(message, "Đăng nhập thành công. Đang chuyển đến trang phù hợp...", "success");
      window.setTimeout(() => {
        window.location.href = getAuthDestination(data.user);
      }, 550);
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const message = document.getElementById("registerMessage");

    if (password.length < 6) {
      setMessage(message, "Password cần tối thiểu 6 ký tự.", "error");
      return;
    }
    if (password !== confirmPassword) {
      setMessage(message, "Password nhập lại chưa khớp.", "error");
      return;
    }

    try {
      const data = isStaticMode()
        ? localRegister({ name, email, username, password })
        : await apiRequest("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({ name, email, username, password })
        });
      localStorage.setItem("mhCurrentUser", JSON.stringify(data.user));
      setMessage(message, "Đăng ký thành công. Đang chuyển đến trang phù hợp...", "success");
      window.setTimeout(() => {
        window.location.href = getAuthDestination(data.user);
      }, 700);
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

const forgotForm = document.getElementById("forgotForm");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("recoveryEmail").value.trim();
    const password = document.getElementById("newPassword")?.value;
    const token = new URLSearchParams(window.location.search).get("token");
    const message = document.getElementById("forgotMessage");

    try {
      if (isStaticMode()) {
        setMessage(message, "Chế độ demo đã ghi nhận yêu cầu khôi phục. Vui lòng dùng lại email đã đăng ký để thử đăng nhập.", "success");
        return;
      }

      if (token && password) {
        await apiRequest("/api/auth/reset-password", {
          method: "POST",
          body: JSON.stringify({ token, password })
        });
        setMessage(message, "Đặt lại mật khẩu thành công. Bạn có thể quay lại đăng nhập.", "success");
        return;
      }

      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setMessage(message, "Đã gửi email khôi phục. Vui lòng kiểm tra hộp thư.", "success");
    } catch (error) {
      setMessage(message, error.message, "error");
    }
  });
}

const logoutButton = document.querySelector("[data-logout]");
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("mhCurrentUser");
      window.location.href = "login.html";
    }
  });
}
