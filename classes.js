const classesKey = "mhStaticClasses";
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

function generateClassCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function readClasses() {
  const saved = readJson(classesKey, null);
  if (saved) return saved;
  const seeded = [
    {
      id: "class-5a",
      name: "5A",
      grade: "--",
      note: "--",
      studentCount: 0,
      code: "CFZJH3",
      createdAt: new Date().toISOString()
    }
  ];
  writeJson(classesKey, seeded);
  return seeded;
}

function assignedCountForClass(classId) {
  return readJson(assignedWorkKey, []).filter((item) => String(item.classId) === String(classId)).length;
}

function renderClasses() {
  const classes = readClasses();
  const body = document.getElementById("classTableBody");
  body.innerHTML = classes.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.grade || "--"}</td>
      <td>${item.note || "--"}</td>
      <td><span class="table-badge">${item.studentCount || 0}</span></td>
      <td><span class="table-badge">${assignedCountForClass(item.id)}</span></td>
      <td><span class="table-code">${item.code}</span></td>
      <td>
        <div class="table-actions">
          <button type="button" data-manage-class="${item.id}">Quản lý</button>
          <button type="button" data-delete-class="${item.id}">Xóa</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function openClassModal() {
  document.getElementById("classModal").hidden = false;
  document.getElementById("classNameInput").focus();
}

function closeClassModal() {
  document.getElementById("classModal").hidden = true;
  document.getElementById("classForm").reset();
}

document.getElementById("openClassForm").addEventListener("click", openClassModal);
document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeClassModal);
});
document.getElementById("classModal").addEventListener("click", (event) => {
  if (event.target.id === "classModal") closeClassModal();
});

document.getElementById("classForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const classes = readClasses();
  const item = {
    id: crypto.randomUUID(),
    name: document.getElementById("classNameInput").value.trim(),
    grade: document.getElementById("classGradeInput").value.trim() || "--",
    note: document.getElementById("classNoteInput").value.trim() || "--",
    studentCount: 0,
    code: generateClassCode(),
    createdAt: new Date().toISOString()
  };
  writeJson(classesKey, [...classes, item]);
  closeClassModal();
  renderClasses();
});

document.getElementById("classTableBody").addEventListener("click", (event) => {
  const manageId = event.target.dataset.manageClass;
  const deleteId = event.target.dataset.deleteClass;
  if (manageId) {
    window.location.href = `classroom-detail.html?id=${encodeURIComponent(manageId)}`;
  }
  if (deleteId) {
    const classItem = readClasses().find((item) => String(item.id) === String(deleteId));
    if (!window.confirm(`Xóa lớp ${classItem?.name || ""}?`)) return;
    writeJson(classesKey, readClasses().filter((item) => String(item.id) !== String(deleteId)));
    renderClasses();
  }
});

renderClasses();
