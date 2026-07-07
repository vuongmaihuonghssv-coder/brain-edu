const studentAssignmentsKey = "mhStaticAssignments";
const studentSubmissionsKey = "mhStaticSubmissions";
const studentAssignedWorkKey = "mhStaticAssignedWork";
const studentClassesKey = "mhStaticClasses";

function readStudentJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function isStudentTeacherAccount(user) {
  const identity = `${user?.email || user?.username || ""}`.trim().toLowerCase();
  const domain = identity.includes("@") ? identity.split("@").pop() : identity;
  return domain === "brain.edu" || domain.endsWith(".brain.edu") || domain.endsWith(".brain");
}

function showStudentRoleMessage(message) {
  let notice = document.querySelector(".role-access-message");
  if (!notice) {
    notice = document.createElement("p");
    notice.className = "role-access-message";
    notice.setAttribute("role", "status");
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.classList.add("show");
  window.clearTimeout(showStudentRoleMessage.timer);
  showStudentRoleMessage.timer = window.setTimeout(() => {
    notice.classList.remove("show");
  }, 2600);
}

function setupStudentRoleSwitchGuard() {
  document.querySelectorAll("[data-role-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const user = readStudentJson("mhCurrentUser", null);
      const target = link.dataset.roleTarget;
      const teacher = isStudentTeacherAccount(user);
      const allowed = target === "teacher" ? teacher : !teacher;
      if (allowed) return;

      event.preventDefault();
      showStudentRoleMessage(
        target === "teacher"
          ? "Chỉ tài khoản Gmail giáo viên có đuôi @brain.edu mới vào được giao diện giáo viên."
          : "Chỉ tài khoản học viên mới vào được giao diện học viên."
      );
    });
  });
}

function setupStudentUserMenu() {
  const chip = document.getElementById("studentUserChip");
  const topbarRight = chip?.closest(".student-topbar-right");
  if (!chip || !topbarRight || document.getElementById("studentAccountMenu")) return;

  const menu = document.createElement("div");
  menu.className = "student-account-menu";
  menu.id = "studentAccountMenu";
  menu.hidden = true;
  menu.innerHTML = `
    <strong>Tài khoản</strong>
    <span id="studentAccountMenuName">maihuong</span>
    <button type="button" id="studentLogoutButton">Đăng xuất</button>
  `;
  topbarRight.append(menu);

  function closeMenu() {
    menu.hidden = true;
    chip.setAttribute("aria-expanded", "false");
  }

  chip.setAttribute("aria-haspopup", "menu");
  chip.setAttribute("aria-expanded", "false");
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    const name = currentStudentName();
    const nameElement = document.getElementById("studentAccountMenuName");
    if (nameElement) nameElement.textContent = name;
    menu.hidden = !menu.hidden;
    chip.setAttribute("aria-expanded", String(!menu.hidden));
  });

  menu.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.getElementById("studentLogoutButton")?.addEventListener("click", () => {
    localStorage.removeItem("mhCurrentUser");
    window.location.href = "home.html";
  });

  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

function writeStudentJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readStudentAssignments() {
  const stored = readStudentJson(studentAssignmentsKey, []);
  if (stored.length) return stored;
  return [
    { id: "demo-present-simple", title: "Present Simple Practice", status: "published", questions: [{}, {}, {}, {}, {}] },
    { id: "demo-vocabulary-a1", title: "A1 Vocabulary Review", status: "published", questions: [{}, {}, {}, {}] }
  ];
}

function readStudentSubmissions() {
  return readStudentJson(studentSubmissionsKey, []);
}

function readStudentAssignedWork() {
  return readStudentJson(studentAssignedWorkKey, []);
}

function readStudentClasses() {
  const classes = readStudentJson(studentClassesKey, []);
  if (classes.length) return classes;
  return [{ id: "class-3c", name: "3C", grade: "Khối 3", note: "Học chăm và ngoan", studentCount: 1, code: "NAKD7N" }];
}

function setStudentText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function studentAssignmentUrl(id, assignedId = "") {
  const base = window.location.href.replace(/student\.html.*$/, "assignment.html");
  return `${base}?id=${encodeURIComponent(id)}${assignedId ? `&assigned=${encodeURIComponent(assignedId)}` : ""}`;
}

function formatStudentDashboardDate(value) {
  if (!value) return "Chưa có hạn";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function currentStudentName() {
  const user = readStudentJson("mhCurrentUser", null);
  if (user) return user.name || user.username || user.email || "maihuong";
  const latest = readStudentSubmissions()[0];
  return latest?.student_name || latest?.studentName || "maihuong";
}

function findStudentAssignment(id) {
  return readStudentAssignments().find((item) => String(item.id) === String(id));
}

function studentDashboardAssignments() {
  const assigned = readStudentAssignedWork();
  if (assigned.length) {
    return assigned.map((item) => {
      const source = findStudentAssignment(item.assignmentId);
      return {
        id: item.assignmentId,
        assignedId: item.id,
        title: item.title || item.assignmentTitle || source?.title || "Bài tập tiếng Anh",
        className: item.className || "Link tự do",
        dueAt: item.dueAt,
        questionCount: source?.questions?.length || 0
      };
    }).filter((item) => item.id);
  }

  return readStudentAssignments()
    .filter((item) => item.status !== "hidden")
    .map((item) => ({
      id: item.id,
      title: item.title || "Bài tập tiếng Anh",
      className: "Bài mở",
      dueAt: "",
      questionCount: item.questions?.length || 0
    }));
}

function renderStudentDashboardAssignments(items, submissions) {
  const list = document.getElementById("studentAssignmentList");
  if (!list) return;

  if (!items.length) {
    list.innerHTML = `
      <article class="student-empty-card samio-empty">
        <span>▣</span>
        <strong>Chưa có bài nào được giao.</strong>
      </article>
    `;
    return;
  }

  list.innerHTML = items.map((item) => {
    const done = submissions.some((submission) => (
      String(submission.assignment_id || submission.assignmentId) === String(item.id) && submission.submitted_at
    ));
    return `
      <article class="student-assignment-card">
        <div>
          <span class="student-pill">${done ? "Đã làm" : "Đang mở"}</span>
          <h3>${item.title}</h3>
          <p>${item.className} · ${item.questionCount || "Nhiều"} câu · Hạn: ${formatStudentDashboardDate(item.dueAt)}</p>
        </div>
        <a class="student-action-button" href="${studentAssignmentUrl(item.id, item.assignedId)}">${done ? "Làm lại" : "Vào làm"}</a>
      </article>
    `;
  }).join("");
}

function renderStudentDashboardClasses() {
  const list = document.getElementById("studentClassList");
  if (!list) return;
  const classes = readStudentClasses();

  if (!classes.length) {
    list.innerHTML = `
      <article class="student-empty-card samio-empty">
        <strong>Chưa tham gia lớp nào.</strong>
        <p>Tham gia bằng mã lớp</p>
      </article>
    `;
    return;
  }

  list.innerHTML = classes.map((item) => `
    <article class="student-class-card">
      <span>🏫</span>
      <div>
        <strong>${item.name || "Lớp học"}</strong>
        <p>${item.grade || "Khối học"} · Mã lớp: ${item.code || "DEMO"}</p>
      </div>
    </article>
  `).join("");
}

function renderStudentDashboardResults(submissions) {
  const list = document.getElementById("studentResultList");
  if (!list) return;
  const completed = submissions.filter((submission) => submission.submitted_at).slice(0, 5);

  if (!completed.length) {
    list.innerHTML = `
      <article class="student-empty-card samio-empty">
        <strong>Chưa có bài nộp.</strong>
        <p>Kết quả sẽ xuất hiện sau khi bạn hoàn thành bài.</p>
      </article>
    `;
    return;
  }

  list.innerHTML = completed.map((submission) => {
    const source = findStudentAssignment(submission.assignment_id || submission.assignmentId);
    return `
      <article class="student-result-card">
        <div>
          <strong>${source?.title || "Bài tập tiếng Anh"}</strong>
          <span>${formatStudentDashboardDate(submission.submitted_at)}</span>
        </div>
        <b>${submission.score || 0}/${submission.total || 0}</b>
      </article>
    `;
  }).join("");
}

function updateStudentProgressTrack(progress) {
  document.querySelectorAll(".student-badge-grid span").forEach((step, index) => {
    step.classList.toggle("active", progress >= index * 25);
  });
}

function renderStudentDashboard() {
  const name = currentStudentName();
  const initial = name.trim().charAt(0).toUpperCase() || "M";
  const assignments = studentDashboardAssignments();
  const classes = readStudentClasses();
  const submissions = readStudentSubmissions();
  const completed = submissions.filter((submission) => submission.submitted_at);
  const totalScore = completed.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const totalQuestions = completed.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const averagePercent = totalQuestions ? Math.round((totalScore / totalQuestions) * 100) : 0;
  const averageTen = totalQuestions ? (totalScore / totalQuestions * 10).toFixed(1).replace(".0", "") : "-";
  const doneIds = new Set(completed.map((submission) => String(submission.assignment_id || submission.assignmentId)));
  const progress = assignments.length ? Math.round((doneIds.size / assignments.length) * 100) : 0;

  setStudentText("studentDashboardAvatar", initial);
  setStudentText("studentHeroAvatar", initial);
  setStudentText("studentTopbarName", name);
  setStudentText("studentDashboardGreeting", `Chào mừng trở lại, ${name}!`);
  setStudentText("studentClassCount", classes.length);
  setStudentText("studentAssignedCount", assignments.length);
  setStudentText("studentDoneCount", completed.length);
  setStudentText("studentActivityCount", completed.length);
  setStudentText("studentAverageScore", averageTen);
  setStudentText("studentAverageInline", averageTen);
  setStudentText("studentProgressPercent", progress ? `${Math.max(1, Math.ceil(progress / 20))}/5` : "1/5");
  setStudentText("studentSidebarProgress", `${averagePercent}%`);
  setStudentText("studentStreakCount", completed.length ? "2 ngày" : "0 ngày");

  const firstAssignment = assignments[0];
  const continueButton = document.getElementById("studentContinueButton");
  if (continueButton && firstAssignment) {
    continueButton.href = studentAssignmentUrl(firstAssignment.id, firstAssignment.assignedId);
  }

  updateStudentProgressTrack(progress);
  renderStudentDashboardAssignments(assignments, submissions);
  renderStudentDashboardClasses();
  renderStudentDashboardResults(submissions);
}

document.getElementById("studentRefreshButton")?.addEventListener("click", renderStudentDashboard);
document.getElementById("studentMenuButton")?.addEventListener("click", () => {
  document.body.classList.toggle("student-sidebar-open");
});
document.getElementById("studentThemeButton")?.addEventListener("click", () => {
  document.body.classList.toggle("student-soft-dark");
});
document.getElementById("studentBellButton")?.addEventListener("click", () => {
  const assignments = studentDashboardAssignments();
  alert(assignments.length ? `Bạn có ${assignments.length} bài tập đang mở.` : "Chưa có thông báo mới.");
});

if (!localStorage.getItem("mhCurrentUser")) {
  writeStudentJson("mhCurrentUser", { name: "maihuong", username: "maihuong", email: "" });
}

setupStudentRoleSwitchGuard();
setupStudentUserMenu();
renderStudentDashboard();
