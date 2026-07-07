const classesKey = "mhStaticClasses";
const assignmentsKey = "mhStaticAssignments";
const assignedWorkKey = "mhStaticAssignedWork";

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

function ensureClasses() {
  const classes = readJson(classesKey, null);
  if (classes) return classes;
  const seeded = [{ id: "class-5a", name: "5A", grade: "--", note: "--", studentCount: 0, code: "CFZJH3" }];
  writeJson(classesKey, seeded);
  return seeded;
}

function ensureAssignments() {
  const assignments = readJson(assignmentsKey, null);
  if (assignments) return assignments;
  const seeded = [
    {
      id: "demo-english-1",
      title: "English Multiple-Answer Practice",
      description: "Bài tập tiếng Anh trắc nghiệm nhiều đáp án đúng.",
      status: "published",
      questions: []
    }
  ];
  writeJson(assignmentsKey, seeded);
  return seeded;
}

function formatDate(value) {
  if (!value) return "–";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function publicAssignmentLink(assignmentId, assignedId = "") {
  const base = window.location.href.replace(/assign-work\.html.*$/, "assignment.html");
  return `${base}?id=${encodeURIComponent(assignmentId)}${assignedId ? `&assigned=${encodeURIComponent(assignedId)}` : ""}`;
}

function selectedRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function selectedAssignment() {
  const id = document.getElementById("assignAssignmentSelect").value;
  return ensureAssignments().find((item) => String(item.id) === String(id));
}

function selectedClass() {
  const id = document.getElementById("assignClassSelect").value;
  return ensureClasses().find((item) => String(item.id) === String(id));
}

function fillSelects() {
  const classes = ensureClasses();
  const assignments = ensureAssignments();
  const classSelect = document.getElementById("assignClassSelect");
  const assignmentSelect = document.getElementById("assignAssignmentSelect");
  classSelect.innerHTML = [
    `<option value="">– Không giao lớp (chỉ lấy link/mã chia sẻ) –</option>`,
    ...classes.map((item) => `<option value="${item.id}">${item.name}</option>`)
  ].join("");
  assignmentSelect.innerHTML = assignments.map((item) => `<option value="${item.id}">${item.title}</option>`).join("");
}

function titleFromAssignment() {
  const assignment = selectedAssignment();
  const titleInput = document.getElementById("assignTitleInput");
  if (assignment && !titleInput.value.trim()) {
    titleInput.value = assignment.title;
  }
}

function renderRecent() {
  const items = readJson(assignedWorkKey, []).slice(0, 8);
  const body = document.getElementById("assignRecentBody");
  if (!items.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4"><div class="table-empty">Chưa có bài đã giao gần đây.</div></td>
      </tr>
    `;
    return;
  }
  body.innerHTML = items.map((item) => `
    <tr>
      <td><strong>📚 ${item.title || item.assignmentTitle}</strong></td>
      <td>${item.className || "–"}</td>
      <td>${formatDate(item.dueAt)}</td>
      <td>
        <div class="table-actions">
          <button type="button" data-copy-assigned="${item.id}">Copy link</button>
          <button type="button" data-delete-assigned="${item.id}">×</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function message(text, type = "success") {
  const element = document.getElementById("assignWorkMessage");
  element.textContent = text;
  element.className = `form-message ${type}`;
}

function clearMessage() {
  const element = document.getElementById("assignWorkMessage");
  element.textContent = "";
  element.className = "form-message";
}

async function copyAssignedLink(assignedId) {
  const item = readJson(assignedWorkKey, []).find((entry) => String(entry.id) === String(assignedId));
  if (!item) return;
  const link = publicAssignmentLink(item.assignmentId, item.id);
  try {
    await navigator.clipboard.writeText(link);
    message("Đã copy link bài tập.");
  } catch {
    window.prompt("Copy link bài tập:", link);
  }
}

function collectPayload() {
  const assignment = selectedAssignment();
  const classItem = selectedClass();
  return {
    id: crypto.randomUUID(),
    title: document.getElementById("assignTitleInput").value.trim(),
    assignmentId: assignment?.id || "",
    assignmentTitle: assignment?.title || document.getElementById("assignTitleInput").value.trim(),
    classId: classItem?.id || "",
    className: classItem?.name || "–",
    contentType: document.getElementById("assignContentTypeInput").value,
    topic: document.getElementById("assignTopicInput").value,
    activityHomework: document.getElementById("activityHomeworkInput").checked,
    note: document.getElementById("assignNoteInput").value.trim(),
    startAt: document.getElementById("assignStartInput").value,
    dueAt: document.getElementById("assignDueInput").value,
    durationMinutes: Number(document.getElementById("assignDurationInput").value || 0),
    status: "active",
    options: {
      assignMode: selectedRadio("assignMode"),
      password: document.getElementById("assignPasswordInput").value.trim(),
      attempts: Number(document.getElementById("assignAttemptInput").value || 0),
      scoreMode: document.getElementById("scoreModeInput").value,
      scoreScale: Number(document.getElementById("scoreScaleInput").value || 10),
      securityMode: selectedRadio("securityMode"),
      shuffleAnswers: document.getElementById("shuffleAnswersInput").checked,
      afterSubmitView: selectedRadio("afterSubmitView"),
      afterDeadlineView: selectedRadio("afterDeadlineView")
    },
    assignedAt: new Date().toISOString()
  };
}

document.getElementById("assignAssignmentSelect").addEventListener("change", titleFromAssignment);

document.getElementById("assignWorkForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = collectPayload();
  if (!payload.title || !payload.assignmentId || !payload.activityHomework) {
    message("Vui lòng nhập tiêu đề, chọn bài tập và chọn ít nhất một hoạt động.", "error");
    return;
  }
  writeJson(assignedWorkKey, [payload, ...readJson(assignedWorkKey, [])]);
  clearMessage();
  renderRecent();
});

document.getElementById("assignRecentBody").addEventListener("click", (event) => {
  const copyId = event.target.dataset.copyAssigned;
  const deleteId = event.target.dataset.deleteAssigned;
  if (copyId) copyAssignedLink(copyId);
  if (deleteId) {
    writeJson(assignedWorkKey, readJson(assignedWorkKey, []).filter((item) => String(item.id) !== String(deleteId)));
    renderRecent();
  }
});

fillSelects();
renderRecent();
