const classesKey = "mhStaticClasses";
const studentsKey = "mhStaticClassStudents";
const assignedWorkKey = "mhStaticAssignedWork";
const submissionsKey = "mhStaticSubmissions";

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getClassId() {
  return new URLSearchParams(window.location.search).get("id") || "class-5a";
}

function ensureClasses() {
  const saved = readJson(classesKey, null);
  if (saved) return saved;
  const seeded = [{ id: "class-5a", name: "5A", grade: "--", note: "--", studentCount: 0, code: "CFZJH3", isOpen: false, isFreeCourse: false }];
  writeJson(classesKey, seeded);
  return seeded;
}

function currentClass() {
  const classes = ensureClasses();
  return classes.find((item) => String(item.id) === String(getClassId())) || classes[0];
}

function updateClass(patch) {
  const classItem = currentClass();
  const classes = ensureClasses().map((item) => (
    String(item.id) === String(classItem.id) ? { ...item, ...patch } : item
  ));
  writeJson(classesKey, classes);
}

function studentsForClass(classId) {
  return readJson(studentsKey, []).filter((student) => String(student.classId) === String(classId));
}

function assignedForClass(classId) {
  return readJson(assignedWorkKey, []).filter((item) => String(item.classId) === String(classId));
}

function submissionsForClass(classId) {
  const assigned = assignedForClass(classId);
  const assignmentIds = new Set(assigned.map((item) => String(item.assignmentId)));
  return readJson(submissionsKey, []).filter((submission) => assignmentIds.has(String(submission.assignmentId || submission.assignment_id)));
}

function formatDate(value) {
  if (!value) return "Không giới hạn";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function statusText(status) {
  if (status === "active") return "Đang giao";
  if (status === "draft") return "Nháp";
  if (status === "hidden") return "Đã ẩn";
  return status || "Đang giao";
}

function updateClassStudentCount(classId, count) {
  const classes = ensureClasses().map((item) => (
    String(item.id) === String(classId) ? { ...item, studentCount: count } : item
  ));
  writeJson(classesKey, classes);
}

function scoreStats(classId) {
  const submissions = submissionsForClass(classId);
  const scored = submissions.filter((item) => Number(item.total || 0) > 0);
  const average = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + (Number(item.score || 0) / Number(item.total || 1)) * 100, 0) / scored.length)
    : null;
  return { submissions, average };
}

function renderHeader() {
  const classItem = currentClass();
  if (!classItem) return;
  document.getElementById("breadcrumbClassName").textContent = classItem.name;
  document.getElementById("classroomName").textContent = classItem.name;
  document.getElementById("classroomCode").textContent = classItem.code || "------";
}

function renderOpenState() {
  const classItem = currentClass();
  const isOpen = Boolean(classItem.isOpen);
  const isFreeCourse = Boolean(classItem.isFreeCourse);
  document.getElementById("classLockIcon").textContent = isOpen ? "🔓" : "🔒";
  document.getElementById("classOpenTitle").textContent = isOpen ? "Lớp đang MỞ" : "Lớp đang ĐÓNG";
  document.getElementById("classOpenText").textContent = isOpen
    ? "Học viên có thể vào lớp bằng mã lớp hoặc link chia sẻ."
    : "Chỉ học viên có tài khoản mới vào lớp được (qua mã lớp). Bật “Lớp mở” để chia sẻ link cho khách.";
  document.getElementById("toggleClassOpen").textContent = isOpen ? "🌐 Tắt lớp mở" : "🌐 Bật lớp mở";
  document.getElementById("toggleFreeCourse").textContent = isFreeCourse ? "🎓 Đã đăng khoá miễn phí" : "🎓 Đăng làm Khoá học miễn phí";
  document.getElementById("toggleFreeCourse").classList.toggle("is-on", isFreeCourse);
}

function renderStats() {
  const classItem = currentClass();
  const students = studentsForClass(classItem.id);
  const assigned = assignedForClass(classItem.id);
  const { submissions, average } = scoreStats(classItem.id);
  const completion = students.length ? Math.round((submissions.length / students.length) * 100) : 0;
  document.getElementById("classStudentCount").textContent = students.length;
  document.getElementById("classStudentCountInline").textContent = students.length;
  document.getElementById("classAssignedCount").textContent = assigned.length;
  document.getElementById("classAverageScore").textContent = average === null ? "--" : `${average}%`;
  document.getElementById("classCompletionRate").textContent = `${Math.min(completion, 100)}%`;
  updateClassStudentCount(classItem.id, students.length);
}

function renderStudents() {
  const classItem = currentClass();
  const students = studentsForClass(classItem.id);
  const body = document.getElementById("studentTableBody");
  const empty = document.getElementById("studentEmptyState");
  const wrap = document.getElementById("studentTableWrap");
  empty.hidden = students.length > 0;
  wrap.hidden = students.length === 0;
  if (!students.length) {
    body.innerHTML = "";
    return;
  }
  body.innerHTML = students.map((student, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${student.name}</strong></td>
      <td>${student.code || "--"}</td>
      <td>${student.email || "--"}</td>
      <td>
        <div class="table-actions">
          <button type="button" data-remove-student="${student.id}">Xóa</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderAssigned() {
  const classItem = currentClass();
  const assigned = assignedForClass(classItem.id);
  const list = document.getElementById("classAssignedList");
  if (!assigned.length) {
    list.innerHTML = `<div class="classroom-empty-message">Chưa giao bài nào.</div>`;
    return;
  }
  list.innerHTML = assigned.map((item) => `
    <article>
      <strong>${item.assignmentTitle}</strong>
      <p>${statusText(item.status)} · Hạn nộp: ${formatDate(item.dueAt)}</p>
      <a href="assignment.html?id=${encodeURIComponent(item.assignmentId)}&assigned=${encodeURIComponent(item.id)}">Mở bài</a>
    </article>
  `).join("");
}

function renderPage() {
  renderHeader();
  renderOpenState();
  renderStats();
  renderStudents();
  renderAssigned();
}

function openStudentModal() {
  document.getElementById("studentModal").hidden = false;
  document.getElementById("studentNameInput").focus();
}

function closeStudentModal() {
  document.getElementById("studentModal").hidden = true;
  document.getElementById("studentForm").reset();
}

function openInfoModal(title, html) {
  document.getElementById("classroomInfoTitle").textContent = title;
  document.getElementById("classroomInfoBody").innerHTML = html;
  document.getElementById("classroomInfoModal").hidden = false;
}

function closeInfoModal() {
  document.getElementById("classroomInfoModal").hidden = true;
}

async function copyClassCode() {
  const code = currentClass()?.code || "";
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    window.prompt("Copy mã lớp:", code);
  }
}

function showCommentReport() {
  const classItem = currentClass();
  const students = studentsForClass(classItem.id);
  openInfoModal("Nhận xét lớp", `
    <p><strong>${classItem.name}</strong> hiện có ${students.length} học viên.</p>
    <textarea class="classroom-modal-note" rows="5" placeholder="Nhập nhận xét chung cho lớp...">${classItem.comment || ""}</textarea>
    <button class="button primary" type="button" data-save-class-comment>Lưu nhận xét</button>
  `);
}

function showScoreMap() {
  const classItem = currentClass();
  const { submissions, average } = scoreStats(classItem.id);
  openInfoModal("Bản đồ điểm", `
    <div class="score-map-demo">
      <article><strong>${average === null ? "--" : `${average}%`}</strong><span>Điểm trung bình</span></article>
      <article><strong>${submissions.length}</strong><span>Lượt nộp</span></article>
      <article><strong>${studentsForClass(classItem.id).length}</strong><span>Học viên</span></article>
    </div>
    <p class="classroom-muted">Bản đồ điểm sẽ tự cập nhật khi học sinh làm bài.</p>
  `);
}

function showScoreBook() {
  const classItem = currentClass();
  const students = studentsForClass(classItem.id);
  const rows = students.length ? students.map((student, index) => `
    <tr><td>${index + 1}</td><td>${student.name}</td><td>${student.code || "--"}</td><td>--</td></tr>
  `).join("") : `<tr><td colspan="4">Chưa có học viên để lập sổ điểm.</td></tr>`;
  openInfoModal("Sổ điểm", `
    <div class="table-scroll">
      <table class="teacher-data-table classroom-scorebook">
        <thead><tr><th>STT</th><th>Học viên</th><th>SBD</th><th>Điểm TB</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `);
}

document.getElementById("backToClasses").addEventListener("click", () => {
  window.location.href = "classes.html";
});
document.getElementById("openStudentForm").addEventListener("click", openStudentModal);
document.getElementById("copyClassCode").addEventListener("click", copyClassCode);
document.getElementById("openClassComment").addEventListener("click", showCommentReport);
document.getElementById("openScoreMap").addEventListener("click", showScoreMap);
document.getElementById("openScoreBook").addEventListener("click", showScoreBook);
document.getElementById("toggleClassOpen").addEventListener("click", () => {
  updateClass({ isOpen: !currentClass().isOpen });
  renderPage();
});
document.getElementById("toggleFreeCourse").addEventListener("click", () => {
  updateClass({ isFreeCourse: !currentClass().isFreeCourse });
  renderPage();
});
document.getElementById("deleteClassButton").addEventListener("click", () => {
  const classItem = currentClass();
  if (!window.confirm(`Xóa lớp ${classItem.name}?`)) return;
  writeJson(classesKey, ensureClasses().filter((item) => String(item.id) !== String(classItem.id)));
  window.location.href = "classes.html";
});

document.querySelectorAll("[data-close-student-modal]").forEach((button) => {
  button.addEventListener("click", closeStudentModal);
});
document.querySelectorAll("[data-close-info-modal]").forEach((button) => {
  button.addEventListener("click", closeInfoModal);
});
document.getElementById("studentModal").addEventListener("click", (event) => {
  if (event.target.id === "studentModal") closeStudentModal();
});
document.getElementById("classroomInfoModal").addEventListener("click", (event) => {
  if (event.target.id === "classroomInfoModal") closeInfoModal();
});

document.getElementById("studentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const classItem = currentClass();
  const students = readJson(studentsKey, []);
  students.push({
    id: crypto.randomUUID(),
    classId: classItem.id,
    name: document.getElementById("studentNameInput").value.trim(),
    code: document.getElementById("studentCodeInput").value.trim(),
    email: document.getElementById("studentEmailInput").value.trim(),
    createdAt: new Date().toISOString()
  });
  writeJson(studentsKey, students);
  closeStudentModal();
  renderPage();
});

document.getElementById("studentTableBody").addEventListener("click", (event) => {
  const studentId = event.target.dataset.removeStudent;
  if (!studentId) return;
  if (!window.confirm("Xóa học viên này khỏi lớp?")) return;
  writeJson(studentsKey, readJson(studentsKey, []).filter((student) => String(student.id) !== String(studentId)));
  renderPage();
});

document.getElementById("classroomInfoBody").addEventListener("click", (event) => {
  if (event.target.dataset.saveClassComment === undefined) return;
  const comment = document.querySelector(".classroom-modal-note").value.trim();
  updateClass({ comment });
  closeInfoModal();
});

renderPage();
