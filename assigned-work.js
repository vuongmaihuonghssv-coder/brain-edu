const assignedWorkKey = "mhStaticAssignedWork";
const submissionsKey = "mhStaticSubmissions";
let assignedFilter = "all";

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

function statusText(status) {
  if (status === "active") return "Đang giao";
  if (status === "draft") return "Nháp";
  if (status === "hidden") return "Đã ẩn";
  return status || "Đang giao";
}

function formatDate(value) {
  if (!value) return "Không giới hạn";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

function publicAssignmentLink(assignmentId, assignedId = "") {
  const base = window.location.href.replace(/assigned-work\.html.*$/, "assignment.html");
  return `${base}?id=${encodeURIComponent(assignmentId)}${assignedId ? `&assigned=${encodeURIComponent(assignedId)}` : ""}`;
}

function submissionsFor(item) {
  return readJson(submissionsKey, []).filter((submission) => (
    String(submission.assignmentId || submission.assignment_id) === String(item.assignmentId)
  ));
}

function filteredAssigned() {
  const query = document.getElementById("assignedSearch").value.trim().toLowerCase();
  return readJson(assignedWorkKey, []).filter((item) => {
    const statusMatches = assignedFilter === "all" || item.status === assignedFilter;
    const queryMatches = !query || `${item.assignmentTitle} ${item.className}`.toLowerCase().includes(query);
    return statusMatches && queryMatches;
  });
}

function renderSummary(items) {
  const submissions = readJson(submissionsKey, []);
  document.getElementById("activeAssignedCount").textContent = items.filter((item) => item.status === "active").length;
  document.getElementById("draftAssignedCount").textContent = items.filter((item) => item.status === "draft").length;
  document.getElementById("hiddenAssignedCount").textContent = items.filter((item) => item.status === "hidden").length;
  document.getElementById("submissionAssignedCount").textContent = submissions.length;
}

function renderAssignedWork() {
  const allItems = readJson(assignedWorkKey, []);
  const items = filteredAssigned();
  renderSummary(allItems);
  const body = document.getElementById("assignedWorkBody");
  if (!items.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="table-empty">Chưa có bài đã giao phù hợp.</div>
        </td>
      </tr>
    `;
    return;
  }
  body.innerHTML = items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${item.assignmentTitle}</strong><small>${item.note || "Không có lời nhắn."}</small></td>
      <td>${item.className}</td>
      <td>${formatDate(item.dueAt)}</td>
      <td><span class="status-pill ${item.status}">${statusText(item.status)}</span></td>
      <td><span class="table-badge">${submissionsFor(item).length}</span></td>
      <td>
        <div class="table-actions">
          <button type="button" data-copy-assigned="${item.id}">Copy link</button>
          <button type="button" data-toggle-assigned="${item.id}">${item.status === "hidden" ? "Mở" : "Ẩn"}</button>
          <button type="button" data-delete-assigned="${item.id}">Xóa</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function message(text, type = "success") {
  const element = document.getElementById("assignedWorkMessage");
  element.textContent = text;
  element.className = `form-message ${type}`;
}

async function copyAssignedLink(id) {
  const item = readJson(assignedWorkKey, []).find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const link = publicAssignmentLink(item.assignmentId, item.id);
  try {
    await navigator.clipboard.writeText(link);
    message("Đã copy link bài tập.");
  } catch {
    window.prompt("Copy link bài tập:", link);
  }
}

document.getElementById("assignedSearch").addEventListener("input", renderAssignedWork);
document.querySelectorAll("[data-assigned-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    assignedFilter = button.dataset.assignedFilter;
    document.querySelectorAll("[data-assigned-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderAssignedWork();
  });
});

document.getElementById("assignedWorkBody").addEventListener("click", (event) => {
  const copyId = event.target.dataset.copyAssigned;
  const toggleId = event.target.dataset.toggleAssigned;
  const deleteId = event.target.dataset.deleteAssigned;
  if (copyId) copyAssignedLink(copyId);
  if (toggleId) {
    const next = readJson(assignedWorkKey, []).map((item) => (
      String(item.id) === String(toggleId)
        ? { ...item, status: item.status === "hidden" ? "active" : "hidden" }
        : item
    ));
    writeJson(assignedWorkKey, next);
    renderAssignedWork();
    message("Đã cập nhật trạng thái bài giao.");
  }
  if (deleteId) {
    if (!window.confirm("Xóa bài đã giao này?")) return;
    writeJson(assignedWorkKey, readJson(assignedWorkKey, []).filter((item) => String(item.id) !== String(deleteId)));
    renderAssignedWork();
    message("Đã xóa bài đã giao.");
  }
});

renderAssignedWork();
