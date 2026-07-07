const welcomeHero = document.querySelector(".welcome-hero");
const continueButton = document.querySelector(".welcome-cta");
const openHomeLogin = document.getElementById("openHomeLogin");
const closeHomeLogin = document.getElementById("closeHomeLogin");
const homeLoginPopover = document.getElementById("homeLoginPopover");
const homeLoginForm = document.getElementById("homeLoginForm");
const homeLoginIdentity = document.getElementById("homeLoginIdentity");
const homeLoginPassword = document.getElementById("homeLoginPassword");
const homeLoginMessage = document.getElementById("homeLoginMessage");
const homeTogglePassword = document.getElementById("homeTogglePassword");
const homeRecoveryPanel = document.getElementById("homeRecoveryPanel");
const homeRecoveryContact = document.getElementById("homeRecoveryContact");
const homeRecoveryMessage = document.getElementById("homeRecoveryMessage");
const ctrlBrainAccess = document.getElementById("ctrlBrainAccess");

function createSparkle() {
  if (!welcomeHero) return;
  const sparkle = document.createElement("span");
  sparkle.className = "home-sparkle";
  sparkle.style.left = `${12 + Math.random() * 76}%`;
  sparkle.style.top = `${10 + Math.random() * 72}%`;
  welcomeHero.append(sparkle);
  window.setTimeout(() => sparkle.remove(), 1700);
}

function pulseContinueButton() {
  if (!continueButton) return;
  continueButton.animate(
    [
      { transform: "translateY(-2px) scale(1.03)" },
      { transform: "translateY(-2px) scale(1.08)" },
      { transform: "translateY(-2px) scale(1.03)" }
    ],
    { duration: 420, easing: "ease-out" }
  );
}

function getCurrentHomeUser() {
  try {
    return JSON.parse(localStorage.getItem("mhCurrentUser") || "null");
  } catch {
    return null;
  }
}

function showHomeAuthNotice(message) {
  let notice = document.querySelector(".home-auth-notice");
  if (!notice) {
    notice = document.createElement("p");
    notice.className = "home-auth-notice";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add("show");
  window.clearTimeout(showHomeAuthNotice.timer);
  showHomeAuthNotice.timer = window.setTimeout(() => {
    notice.classList.remove("show");
  }, 2800);
}

function getLearningDestination(user) {
  const identity = `${user?.email || user?.username || ""}`.trim().toLowerCase();
  const domain = identity.includes("@") ? identity.split("@").pop() : identity;
  return domain === "brain.edu" || domain.endsWith(".brain.edu") || domain.endsWith(".brain")
    ? "teacher.html"
    : "student.html";
}

continueButton?.addEventListener("click", () => {
  pulseContinueButton();
  const currentUser = getCurrentHomeUser();
  if (!currentUser) {
    if (homeLoginPopover) homeLoginPopover.hidden = false;
    homeLoginIdentity?.focus();
    return;
  }
  window.location.href = getLearningDestination(currentUser);
});

ctrlBrainAccess?.addEventListener("click", (event) => {
  event.preventDefault();
  const currentUser = getCurrentHomeUser();
  if (currentUser) {
    window.location.href = getLearningDestination(currentUser);
    return;
  }
  const authMessage = "Bạn cần đăng nhập để tiếp tục.";
  showHomeAuthNotice(authMessage);
  if (homeLoginPopover) homeLoginPopover.hidden = false;
  if (homeLoginMessage) {
    homeLoginMessage.textContent = authMessage;
    homeLoginMessage.className = "welcome-login-message error";
  }
  homeLoginIdentity?.focus();
});

function closeLoginPopover() {
  if (homeLoginPopover) homeLoginPopover.hidden = true;
}

openHomeLogin?.addEventListener("click", () => {
  const shouldOpen = homeLoginPopover.hidden;
  homeLoginPopover.hidden = !shouldOpen;
  if (!homeLoginPopover.hidden) homeLoginIdentity.focus();
});

closeHomeLogin?.addEventListener("click", closeLoginPopover);

document.addEventListener("click", (event) => {
  if (!homeLoginPopover || homeLoginPopover.hidden) return;
  if (homeLoginPopover.contains(event.target) || openHomeLogin?.contains(event.target)) return;
  closeLoginPopover();
});

homeTogglePassword?.addEventListener("click", () => {
  const isHidden = homeLoginPassword.type === "password";
  homeLoginPassword.type = isHidden ? "text" : "password";
  homeTogglePassword.textContent = isHidden ? "Ẩn" : "Hiện";
});

homeLoginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const identity = homeLoginIdentity.value.trim();
  const password = homeLoginPassword.value.trim();
  if (!identity || !password) {
    homeLoginMessage.textContent = "Vui lòng nhập Gmail/tên đăng nhập và password.";
    homeLoginMessage.className = "welcome-login-message error";
    return;
  }

  const name = identity.includes("@") ? identity.split("@")[0] : identity;
  localStorage.setItem("mhCurrentUser", JSON.stringify({
    name,
    username: identity,
    email: identity.includes("@") ? identity : ""
  }));
  homeLoginMessage.textContent = `Đăng nhập thành công. Chào ${name}!`;
  homeLoginMessage.className = "welcome-login-message";
  if (openHomeLogin) openHomeLogin.textContent = name;
  window.setTimeout(() => {
    window.location.href = getLearningDestination({
      username: identity,
      email: identity.includes("@") ? identity : ""
    });
  }, 350);
});

document.getElementById("openHomeRecovery")?.addEventListener("click", () => {
  homeRecoveryPanel.hidden = !homeRecoveryPanel.hidden;
  if (!homeRecoveryPanel.hidden) homeRecoveryContact.focus();
});

document.getElementById("sendHomeRecovery")?.addEventListener("click", () => {
  const contact = homeRecoveryContact.value.trim();
  if (!contact) {
    homeRecoveryMessage.textContent = "Vui lòng nhập email hoặc số điện thoại.";
    homeRecoveryMessage.className = "welcome-login-message error";
    return;
  }
  homeRecoveryMessage.textContent = `Đã gửi hướng dẫn khôi phục tới ${contact}.`;
  homeRecoveryMessage.className = "welcome-login-message";
});

window.setInterval(createSparkle, 1800);
window.setTimeout(createSparkle, 600);
