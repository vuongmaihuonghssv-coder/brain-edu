let assignmentPageItems = [];
let assignmentPageEditingId = null;
let assignmentPageTab = "all";
const staticAssignmentsKey = "mhStaticAssignments";

function isStaticMode() {
  return window.location.protocol === "file:";
}

function readStaticAssignments() {
  const saved = localStorage.getItem(staticAssignmentsKey);
  if (saved) return JSON.parse(saved);
  const seeded = [
    {
      id: "demo-english-1",
      title: "English Multiple-Answer Practice",
      description: "Bài tập tiếng Anh trắc nghiệm nhiều đáp án đúng.",
      status: "published",
      questions: [
        {
          id: "q1",
          prompt: "Choose the correct meanings of the word 'bright'.",
          explanation: "'Bright' can describe strong light and also an intelligent person.",
          options: [
            { id: "q1a", text: "Full of light", correct: true },
            { id: "q1b", text: "Intelligent", correct: true },
            { id: "q1c", text: "Very quiet", correct: false },
            { id: "q1d", text: "Extremely cold", correct: false }
          ]
        }
      ]
    }
  ];
  localStorage.setItem(staticAssignmentsKey, JSON.stringify(seeded));
  return seeded;
}

function writeStaticAssignments(items) {
  localStorage.setItem(staticAssignmentsKey, JSON.stringify(items));
}

async function assignmentPageApi(url, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("Vui lòng chạy bằng server Node.js để dùng trang bài tập.");
  }
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Không thể xử lý yêu cầu.");
  return data;
}

function assignmentPageMessage(text, type = "success") {
  const element = document.getElementById("assignmentPageMessage");
  element.textContent = text;
  element.className = `form-message ${type}`;
}

function assignmentPageEmptyQuestion() {
  return {
    id: crypto.randomUUID(),
    prompt: "",
    explanation: "",
    options: [
      { id: crypto.randomUUID(), text: "", correct: true },
      { id: crypto.randomUUID(), text: "", correct: false }
    ]
  };
}

function renderAssignmentPageQuestionEditor(questions = [assignmentPageEmptyQuestion()]) {
  const editor = document.getElementById("questionEditor");
  editor.innerHTML = questions.map((question, questionIndex) => `
    <article class="question-card" data-question-id="${question.id}">
      <div class="question-head">
        <strong>Câu ${questionIndex + 1}</strong>
        <button type="button" data-remove-question="${question.id}">Xóa câu</button>
      </div>
      <label>
        Nội dung câu hỏi
        <input type="text" data-question-prompt="${question.id}" value="${question.prompt || ""}" required>
      </label>
      <label>
        Giải thích sau khi làm bài
        <input type="text" data-question-explanation="${question.id}" value="${question.explanation || ""}" placeholder="Vì sao đáp án đúng?">
      </label>
      <div class="option-editor">
        ${(question.options || []).map((option, optionIndex) => `
          <div class="option-row" data-option-id="${option.id}">
            <label class="check-line">
              <input type="checkbox" data-option-correct="${question.id}:${option.id}" ${option.correct ? "checked" : ""}>
              Đúng
            </label>
            <input type="text" data-option-text="${question.id}:${option.id}" value="${option.text || ""}" placeholder="Đáp án ${optionIndex + 1}" required>
            <button type="button" data-remove-option="${question.id}:${option.id}">Xóa</button>
          </div>
        `).join("")}
      </div>
      <button class="button secondary full-button" type="button" data-add-option="${question.id}">Thêm đáp án</button>
    </article>
  `).join("");
}

function collectAssignmentPageQuestions() {
  return [...document.querySelectorAll(".question-card")].map((card) => {
    const questionId = card.dataset.questionId;
    const options = [...card.querySelectorAll(".option-row")].map((row) => {
      const optionId = row.dataset.optionId;
      return {
        id: optionId,
        text: card.querySelector(`[data-option-text="${questionId}:${optionId}"]`).value.trim(),
        correct: card.querySelector(`[data-option-correct="${questionId}:${optionId}"]`).checked
      };
    });
    return {
      id: questionId,
      prompt: card.querySelector(`[data-question-prompt="${questionId}"]`).value.trim(),
      explanation: card.querySelector(`[data-question-explanation="${questionId}"]`).value.trim(),
      options
    };
  });
}

function assignmentPublicLink(id) {
  if (isStaticMode()) {
    const base = window.location.href.replace(/assignments\.html.*$/, "assignment.html");
    return `${base}?id=${id}`;
  }
  return `${window.location.origin}/assignment.html?id=${id}`;
}

async function copyAssignmentLink(id) {
  const link = assignmentPublicLink(id);
  try {
    await navigator.clipboard.writeText(link);
    alert("Đã copy link bài tập.");
  } catch {
    window.prompt("Copy link bài tập:", link);
  }
}

function statusText(status) {
  if (status === "published") return "Đang mở";
  if (status === "draft") return "Chưa gán";
  if (status === "hidden") return "Đã ẩn";
  return status;
}

function filteredAssignments() {
  const query = document.getElementById("assignmentSearch").value.trim().toLowerCase();
  return assignmentPageItems.filter((assignment) => {
    const tabMatches = assignmentPageTab === "all" || assignment.status === assignmentPageTab;
    const queryMatches = !query || assignment.title.toLowerCase().includes(query);
    return tabMatches && queryMatches;
  });
}

function renderAssignmentListPage() {
  const list = document.getElementById("assignmentListView");
  const empty = document.getElementById("assignmentEmptyState");
  const items = filteredAssignments();
  empty.hidden = items.length > 0;
  list.innerHTML = items.map((assignment) => `
    <article class="assignment-list-row">
      <div class="assignment-row-icon">□</div>
      <div>
        <h3>${assignment.title}</h3>
        <p>${assignment.description || "Chưa có mô tả."}</p>
        <small>${assignment.questions.length} câu hỏi · ${statusText(assignment.status)}</small>
      </div>
      <div class="row-actions">
        <button type="button" data-edit-assignment="${assignment.id}">Sửa</button>
        <button type="button" data-copy-assignment="${assignment.id}">Copy link</button>
        <button type="button" data-delete-assignment="${assignment.id}">Xóa</button>
      </div>
    </article>
  `).join("");
}

async function loadAssignmentPageItems() {
  if (isStaticMode()) {
    assignmentPageItems = readStaticAssignments();
    renderAssignmentListPage();
    return;
  }
  const auth = await assignmentPageApi("/api/auth/me");
  if (!auth.user) {
    window.location.href = "login.html";
    return;
  }
  const data = await assignmentPageApi("/api/admin/assignments");
  assignmentPageItems = data.assignments || [];
  renderAssignmentListPage();
}

function openAssignmentCreator(assignment = null) {
  document.getElementById("assignmentCreatePanel").hidden = false;
  document.getElementById("assignmentEditorTitle").textContent = assignment ? "Sửa bài tập" : "Tạo bài tập";
  assignmentPageEditingId = assignment?.id || null;
  document.getElementById("assignmentTitle").value = assignment?.title || "";
  document.getElementById("assignmentDescription").value = assignment?.description || "";
  document.getElementById("assignmentStatus").value = assignment?.status || "published";
  renderAssignmentPageQuestionEditor(assignment?.questions || [assignmentPageEmptyQuestion()]);
}

function closeAssignmentCreator() {
  assignmentPageEditingId = null;
  document.getElementById("assignmentForm").reset();
  document.getElementById("assignmentCreatePanel").hidden = true;
  renderAssignmentPageQuestionEditor([assignmentPageEmptyQuestion()]);
}

document.getElementById("assignmentSearch").addEventListener("input", renderAssignmentListPage);

document.querySelectorAll("[data-assignment-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    assignmentPageTab = button.dataset.assignmentTab;
    document.querySelectorAll("[data-assignment-tab]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderAssignmentListPage();
  });
});

document.getElementById("questionEditor")?.addEventListener("click", (event) => {
  const questions = collectAssignmentPageQuestions();
  const removeQuestionId = event.target.dataset.removeQuestion;
  const addOptionId = event.target.dataset.addOption;
  const removeOption = event.target.dataset.removeOption;

  if (removeQuestionId) {
    renderAssignmentPageQuestionEditor(questions.filter((question) => question.id !== removeQuestionId));
  }
  if (addOptionId) {
    renderAssignmentPageQuestionEditor(questions.map((question) => {
      if (question.id !== addOptionId) return question;
      return { ...question, options: [...question.options, { id: crypto.randomUUID(), text: "", correct: false }] };
    }));
  }
  if (removeOption) {
    const [questionId, optionId] = removeOption.split(":");
    renderAssignmentPageQuestionEditor(questions.map((question) => {
      if (question.id !== questionId) return question;
      return { ...question, options: question.options.filter((option) => option.id !== optionId) };
    }));
  }
});

document.getElementById("assignmentForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    title: document.getElementById("assignmentTitle").value.trim(),
    description: document.getElementById("assignmentDescription").value.trim(),
    status: document.getElementById("assignmentStatus").value,
    questions: collectAssignmentPageQuestions()
  };
  try {
    if (isStaticMode()) {
      const items = readStaticAssignments();
      if (assignmentPageEditingId) {
        assignmentPageItems = items.map((item) => (
          String(item.id) === String(assignmentPageEditingId) ? { ...payload, id: item.id } : item
        ));
        assignmentPageMessage("Đã cập nhật bài tập trên trình duyệt.");
      } else {
        assignmentPageItems = [{ ...payload, id: crypto.randomUUID() }, ...items];
        assignmentPageMessage("Đã tạo bài tập trên trình duyệt.");
      }
      writeStaticAssignments(assignmentPageItems);
      closeAssignmentCreator();
      renderAssignmentListPage();
      return;
    }
    if (assignmentPageEditingId) {
      await assignmentPageApi(`/api/admin/assignments/${assignmentPageEditingId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      assignmentPageMessage("Đã cập nhật bài tập.");
    } else {
      await assignmentPageApi("/api/admin/assignments", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      assignmentPageMessage("Đã tạo bài tập.");
    }
    closeAssignmentCreator();
    await loadAssignmentPageItems();
  } catch (error) {
    assignmentPageMessage(error.message, "error");
  }
});

document.getElementById("assignmentListView").addEventListener("click", async (event) => {
  const editId = event.target.dataset.editAssignment;
  const copyId = event.target.dataset.copyAssignment;
  const deleteId = event.target.dataset.deleteAssignment;
  try {
    if (editId) {
      window.location.href = `assignment-create.html?id=${encodeURIComponent(editId)}`;
    }
    if (copyId) {
      await copyAssignmentLink(copyId);
    }
    if (deleteId) {
      if (isStaticMode()) {
        assignmentPageItems = readStaticAssignments().filter((assignment) => String(assignment.id) !== String(deleteId));
        writeStaticAssignments(assignmentPageItems);
        renderAssignmentListPage();
        return;
      }
      await assignmentPageApi(`/api/admin/assignments/${deleteId}`, { method: "DELETE" });
      await loadAssignmentPageItems();
    }
  } catch (error) {
    alert(error.message);
  }
});

loadAssignmentPageItems().catch((error) => alert(error.message));
