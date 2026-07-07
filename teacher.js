let assignments = [];
let currentAssignmentId = null;
const staticAssignmentsKey = "mhStaticAssignments";
const staticSubmissionsKey = "mhStaticSubmissions";

function teacherStaticMode() {
  return window.location.protocol === "file:";
}

function readTeacherStaticAssignments() {
  const saved = localStorage.getItem(staticAssignmentsKey);
  if (saved) return JSON.parse(saved);
  const seeded = [];
  localStorage.setItem(staticAssignmentsKey, JSON.stringify(seeded));
  return seeded;
}

function writeTeacherStaticAssignments(items) {
  localStorage.setItem(staticAssignmentsKey, JSON.stringify(items));
}

function readTeacherStaticSubmissions() {
  return JSON.parse(localStorage.getItem(staticSubmissionsKey) || "[]");
}

async function teacherApi(url, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("Vui lòng chạy bằng server Node.js để dùng trang giáo viên.");
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

function teacherMessage(text, type = "success") {
  const element = document.getElementById("teacherMessage");
  if (!element) return;
  element.textContent = text;
  element.className = `form-message ${type}`;
}

function emptyQuestion() {
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

function renderQuestionEditor(questions = [emptyQuestion()]) {
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

function collectQuestions() {
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

function assignmentLink(id) {
  if (teacherStaticMode()) {
    const base = window.location.href.replace(/teacher\.html.*$/, "assignment.html");
    return `${base}?id=${id}`;
  }
  return `${window.location.origin}/assignment.html?id=${id}`;
}

async function copyTeacherAssignmentLink(id) {
  const link = assignmentLink(id);
  try {
    await navigator.clipboard.writeText(link);
    teacherMessage("Đã copy link bài tập để gửi cho học sinh.");
  } catch {
    window.prompt("Copy link bài tập:", link);
  }
}

function renderAssignments() {
  const list = document.getElementById("assignmentList");
  list.innerHTML = assignments.map((assignment) => `
    <article class="assignment-item">
      <div>
        <h3>${assignment.title}</h3>
        <p>${assignment.description || "Chưa có mô tả."}</p>
        <small>${assignment.questions.length} câu hỏi · ${assignment.status}</small>
      </div>
      <div class="row-actions">
        <button type="button" data-edit-assignment="${assignment.id}">Sửa</button>
        <button type="button" data-copy-assignment="${assignment.id}">Copy link</button>
        <button type="button" data-view-submissions="${assignment.id}">Bài nộp</button>
        <button type="button" data-delete-assignment="${assignment.id}">Xóa</button>
      </div>
    </article>
  `).join("");
  document.getElementById("assignmentCount").textContent = assignments.length;
  document.getElementById("givenCount").textContent = assignments.filter((assignment) => assignment.status === "published").length;
}

async function loadAssignments() {
  if (teacherStaticMode()) {
    assignments = readTeacherStaticAssignments();
    renderAssignments();
    return;
  }
  const data = await teacherApi("/api/admin/assignments");
  assignments = data.assignments || [];
  renderAssignments();
}

function resetAssignmentForm() {
  if (!document.getElementById("assignmentForm")) return;
  currentAssignmentId = null;
  document.getElementById("assignmentForm").reset();
  document.getElementById("assignmentStatus").value = "published";
  renderQuestionEditor([emptyQuestion()]);
  document.getElementById("saveAssignmentButton").textContent = "Lưu bài tập";
}

function editAssignment(assignment) {
  if (!document.getElementById("assignmentForm")) {
    window.location.href = `assignment-create.html?id=${assignment.id}`;
    return;
  }
  currentAssignmentId = assignment.id;
  document.getElementById("assignmentTitle").value = assignment.title;
  document.getElementById("assignmentDescription").value = assignment.description || "";
  document.getElementById("assignmentStatus").value = assignment.status;
  renderQuestionEditor(assignment.questions);
  document.getElementById("saveAssignmentButton").textContent = "Cập nhật bài tập";
}

async function loadSubmissions(assignmentId) {
  if (teacherStaticMode()) {
    const submissions = readTeacherStaticSubmissions().filter((submission) => String(submission.assignment_id) === String(assignmentId));
    const studentTotal = new Set(submissions.map((submission) => `${submission.email}:${submission.student_code}`)).size;
    document.getElementById("submissionCount").textContent = submissions.length;
    document.getElementById("studentCount").textContent = studentTotal;
    document.getElementById("studentCountInline").textContent = studentTotal;
    const panel = document.getElementById("submissionList");
    panel.innerHTML = submissions.length ? submissions.map((submission) => `
      <article class="submission-item">
        <div>
          <h3>${submission.student_name} ${submission.student_code ? `(${submission.student_code})` : ""}</h3>
          <p>${submission.email}</p>
          <small>Bắt đầu: ${submission.started_at} · Kết thúc: ${submission.submitted_at || "Chưa nộp"}</small>
          <strong>Điểm: ${submission.score}/${submission.total}</strong>
        </div>
      </article>
    `).join("") : "<p>Chưa có học sinh nộp bài.</p>";
    return;
  }
  const data = await teacherApi(`/api/admin/assignments/${assignmentId}/submissions`);
  const studentTotal = new Set(data.submissions.map((submission) => `${submission.email}:${submission.student_code}`)).size;
  document.getElementById("submissionCount").textContent = data.submissions.length;
  document.getElementById("studentCount").textContent = studentTotal;
  document.getElementById("studentCountInline").textContent = studentTotal;
  const panel = document.getElementById("submissionList");
  if (!data.submissions.length) {
    panel.innerHTML = "<p>Chưa có học sinh nộp bài.</p>";
    return;
  }
  panel.innerHTML = data.submissions.map((submission) => `
    <article class="submission-item">
      <div>
        <h3>${submission.student_name} ${submission.student_code ? `(${submission.student_code})` : ""}</h3>
        <p>${submission.email}</p>
        <small>Bắt đầu: ${submission.started_at} · Kết thúc: ${submission.submitted_at || "Chưa nộp"}</small>
        <strong>Điểm: ${submission.score}/${submission.total}</strong>
      </div>
      <label>
        Đánh giá của giáo viên
        <input type="text" value="${submission.feedback || ""}" data-feedback="${submission.id}" placeholder="Nhập nhận xét">
      </label>
      <div class="row-actions">
        <button type="button" data-save-feedback="${submission.id}">Lưu đánh giá</button>
        <button type="button" data-delete-submission="${submission.id}">Xóa bài nộp</button>
      </div>
    </article>
  `).join("");
}

async function bootTeacher() {
  try {
    if (teacherStaticMode()) {
      resetAssignmentForm();
      await loadAssignments();
      return;
    }
    const auth = await teacherApi("/api/auth/me");
    if (!auth.user) {
      window.location.href = "login.html";
      return;
    }
    resetAssignmentForm();
    await loadAssignments();
  } catch (error) {
    teacherMessage(error.message, "error");
  }
}

document.getElementById("newAssignmentButton")?.addEventListener("click", () => {
  window.location.href = "assignment-create.html";
});
document.getElementById("newAssignmentButtonSecondary")?.addEventListener("click", () => {
  window.location.href = "assignment-create.html";
});

document.getElementById("addQuestionButton")?.addEventListener("click", () => {
  renderQuestionEditor([...collectQuestions(), emptyQuestion()]);
});

document.getElementById("questionEditor")?.addEventListener("click", (event) => {
  const questions = collectQuestions();
  const removeQuestionId = event.target.dataset.removeQuestion;
  const addOptionId = event.target.dataset.addOption;
  const removeOption = event.target.dataset.removeOption;

  if (removeQuestionId) {
    renderQuestionEditor(questions.filter((question) => question.id !== removeQuestionId));
  }
  if (addOptionId) {
    const nextQuestions = questions.map((question) => {
      if (question.id !== addOptionId) return question;
      return { ...question, options: [...question.options, { id: crypto.randomUUID(), text: "", correct: false }] };
    });
    renderQuestionEditor(nextQuestions);
  }
  if (removeOption) {
    const [questionId, optionId] = removeOption.split(":");
    const nextQuestions = questions.map((question) => {
      if (question.id !== questionId) return question;
      return { ...question, options: question.options.filter((option) => option.id !== optionId) };
    });
    renderQuestionEditor(nextQuestions);
  }
});

document.getElementById("assignmentForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    title: document.getElementById("assignmentTitle").value.trim(),
    description: document.getElementById("assignmentDescription").value.trim(),
    status: document.getElementById("assignmentStatus").value,
    questions: collectQuestions()
  };
  try {
    if (currentAssignmentId) {
      if (teacherStaticMode()) {
        assignments = readTeacherStaticAssignments().map((item) => (
          String(item.id) === String(currentAssignmentId) ? { ...payload, id: item.id } : item
        ));
        writeTeacherStaticAssignments(assignments);
        teacherMessage("Đã cập nhật bài tập trên trình duyệt.");
        resetAssignmentForm();
        await loadAssignments();
        return;
      }
      await teacherApi(`/api/admin/assignments/${currentAssignmentId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      teacherMessage("Đã cập nhật bài tập.");
    } else {
      if (teacherStaticMode()) {
        assignments = [{ ...payload, id: crypto.randomUUID() }, ...readTeacherStaticAssignments()];
        writeTeacherStaticAssignments(assignments);
        teacherMessage("Đã tạo bài tập trên trình duyệt.");
        resetAssignmentForm();
        await loadAssignments();
        return;
      }
      await teacherApi("/api/admin/assignments", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      teacherMessage("Đã tạo bài tập.");
    }
    resetAssignmentForm();
    await loadAssignments();
  } catch (error) {
    teacherMessage(error.message, "error");
  }
});

document.getElementById("assignmentList")?.addEventListener("click", async (event) => {
  const editId = event.target.dataset.editAssignment;
  const copyId = event.target.dataset.copyAssignment;
  const viewId = event.target.dataset.viewSubmissions;
  const deleteId = event.target.dataset.deleteAssignment;

  try {
    if (editId) editAssignment(assignments.find((assignment) => String(assignment.id) === String(editId)));
    if (copyId) {
      await copyTeacherAssignmentLink(copyId);
    }
    if (viewId) await loadSubmissions(viewId);
    if (deleteId) {
      if (teacherStaticMode()) {
        assignments = readTeacherStaticAssignments().filter((assignment) => String(assignment.id) !== String(deleteId));
        writeTeacherStaticAssignments(assignments);
        teacherMessage("Đã xóa bài tập.");
        await loadAssignments();
        return;
      }
      await teacherApi(`/api/admin/assignments/${deleteId}`, { method: "DELETE" });
      teacherMessage("Đã xóa bài tập.");
      await loadAssignments();
    }
  } catch (error) {
    teacherMessage(error.message, "error");
  }
});

document.getElementById("submissionList")?.addEventListener("click", async (event) => {
  const saveId = event.target.dataset.saveFeedback;
  const deleteId = event.target.dataset.deleteSubmission;

  try {
    if (saveId) {
      const feedback = document.querySelector(`[data-feedback="${saveId}"]`).value;
      await teacherApi(`/api/admin/submissions/${saveId}/feedback`, {
        method: "PUT",
        body: JSON.stringify({ feedback })
      });
      teacherMessage("Đã lưu đánh giá.");
    }
    if (deleteId) {
      await teacherApi(`/api/admin/submissions/${deleteId}`, { method: "DELETE" });
      event.target.closest(".submission-item").remove();
      teacherMessage("Đã xóa bài nộp.");
    }
  } catch (error) {
    teacherMessage(error.message, "error");
  }
});

bootTeacher();
