const state = {
  jobs: [],
  editingId: null
};

async function adminApi(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Không thể xử lý yêu cầu.");
  }
  return data;
}

function showAdminMessage(text, type = "success") {
  const message = document.getElementById("adminMessage");
  if (!message) return;
  message.textContent = text;
  message.className = `form-message ${type}`;
}

async function guardAdminPage() {
  try {
    const data = await adminApi("/api/auth/me");
    if (!data.user) {
      window.location.href = "login.html";
      return false;
    }
    const userName = document.getElementById("adminUserName");
    if (userName) userName.textContent = data.user.name;
    return true;
  } catch {
    window.location.href = "login.html";
    return false;
  }
}

function statusLabel(status) {
  const labels = {
    published: "Đang đăng",
    draft: "Nháp",
    hidden: "Đã ẩn"
  };
  return labels[status] || status;
}

function renderStats(stats) {
  const statsBox = document.getElementById("jobStats");
  if (!statsBox) return;
  const map = Object.fromEntries((stats || []).map((item) => [item.status, item.count]));
  statsBox.innerHTML = `
    <article><strong>${map.published || 0}</strong><span>Đang đăng</span></article>
    <article><strong>${map.draft || 0}</strong><span>Nháp</span></article>
    <article><strong>${map.hidden || 0}</strong><span>Đã ẩn</span></article>
  `;
}

function renderJobs() {
  const body = document.getElementById("jobRows");
  if (!body) return;
  body.innerHTML = state.jobs.map((job) => `
    <div class="post-row" role="row">
      <span>
        <strong>${job.title}</strong>
        <small>${job.description}</small>
      </span>
      <span>${job.type}</span>
      <span class="status ${job.status === "published" ? "live" : job.status}">${statusLabel(job.status)}</span>
      <span class="row-actions">
        <button type="button" data-edit="${job.id}">Sửa</button>
        <button type="button" data-status="${job.id}" data-next="${job.status === "published" ? "hidden" : "published"}">${job.status === "published" ? "Ẩn" : "Đăng"}</button>
        <button type="button" data-delete="${job.id}">Xóa</button>
      </span>
    </div>
  `).join("");
}

async function loadJobs() {
  const q = document.getElementById("jobSearch")?.value || "";
  const status = document.getElementById("jobStatusFilter")?.value || "";
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const data = await adminApi(`/api/admin/jobs?${params.toString()}`);
  state.jobs = data.jobs || [];
  renderStats(data.stats || []);
  renderJobs();
}

function fillJobForm(job) {
  state.editingId = job.id;
  document.getElementById("jobTitle").value = job.title;
  document.getElementById("jobType").value = job.type;
  document.getElementById("jobDescription").value = job.description;
  document.getElementById("jobTags").value = job.tags.join(", ");
  document.getElementById("jobStatus").value = job.status;
  document.getElementById("saveJobButton").textContent = "Cập nhật bài đăng";
}

function resetJobForm() {
  state.editingId = null;
  document.getElementById("jobForm")?.reset();
  document.getElementById("jobStatus").value = "draft";
  document.getElementById("saveJobButton").textContent = "Lưu bài đăng";
}

async function setupAdmin() {
  const allowed = await guardAdminPage();
  if (!allowed) return;
  await loadJobs();

  document.getElementById("jobSearch")?.addEventListener("input", () => loadJobs().catch(() => {}));
  document.getElementById("jobStatusFilter")?.addEventListener("change", () => loadJobs().catch(() => {}));
  document.getElementById("newJobButton")?.addEventListener("click", resetJobForm);

  document.getElementById("jobRows")?.addEventListener("click", async (event) => {
    const editId = event.target.dataset.edit;
    const statusId = event.target.dataset.status;
    const deleteId = event.target.dataset.delete;

    try {
      if (editId) {
        const job = state.jobs.find((item) => String(item.id) === String(editId));
        if (job) fillJobForm(job);
      }
      if (statusId) {
        await adminApi(`/api/admin/jobs/${statusId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: event.target.dataset.next })
        });
        showAdminMessage("Đã cập nhật trạng thái bài đăng.");
        await loadJobs();
      }
      if (deleteId) {
        await adminApi(`/api/admin/jobs/${deleteId}`, { method: "DELETE" });
        showAdminMessage("Đã xóa bài đăng.");
        await loadJobs();
      }
    } catch (error) {
      showAdminMessage(error.message, "error");
    }
  });

  document.getElementById("jobForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      title: document.getElementById("jobTitle").value.trim(),
      type: document.getElementById("jobType").value.trim(),
      description: document.getElementById("jobDescription").value.trim(),
      tags: document.getElementById("jobTags").value.trim(),
      status: document.getElementById("jobStatus").value
    };
    try {
      if (state.editingId) {
        await adminApi(`/api/admin/jobs/${state.editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        showAdminMessage("Đã cập nhật bài tuyển dụng.");
      } else {
        await adminApi("/api/admin/jobs", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        showAdminMessage("Đã tạo bài tuyển dụng.");
      }
      resetJobForm();
      await loadJobs();
    } catch (error) {
      showAdminMessage(error.message, "error");
    }
  });
}

setupAdmin();
