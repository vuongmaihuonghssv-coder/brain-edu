const params = new URLSearchParams(window.location.search);
const assignmentId = params.get("id");
let assignment = null;
let submissionId = null;
let staticStartedAt = null;
const staticAssignmentsKey = "mhStaticAssignments";
const staticSubmissionsKey = "mhStaticSubmissions";

function isStaticMode() {
  return window.location.protocol === "file:";
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function readStaticAssignments() {
  return JSON.parse(localStorage.getItem(staticAssignmentsKey) || "[]");
}

function readStaticSubmissions() {
  return JSON.parse(localStorage.getItem(staticSubmissionsKey) || "[]");
}

function writeStaticSubmissions(items) {
  localStorage.setItem(staticSubmissionsKey, JSON.stringify(items));
}

function prepareStaticAssignment(item) {
  return {
    ...item,
    questions: item.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: shuffle(question.options).map((option) => ({ id: option.id, text: option.text }))
    }))
  };
}

function evaluateStaticAssignment(answers) {
  let score = 0;
  const original = readStaticAssignments().find((item) => String(item.id) === String(assignmentId));
  const details = original.questions.map((question) => {
    const correctIds = question.options.filter((option) => option.correct).map((option) => option.id).sort();
    const selectedIds = [...(answers[question.id] || [])].sort();
    const correct = correctIds.length === selectedIds.length && correctIds.every((id, index) => id === selectedIds[index]);
    if (correct) score += 1;
    return {
      questionId: question.id,
      prompt: question.prompt,
      selectedIds,
      correctIds,
      correct,
      explanation: question.explanation,
      options: question.options
    };
  });
  return { score, total: original.questions.length, details };
}

async function studentApi(url, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("Vui lòng mở link bài tập qua server Node.js.");
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

function showStudentMessage(text, type = "error") {
  const message = document.getElementById("studentMessage");
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function renderQuiz() {
  const container = document.getElementById("quizQuestions");
  container.innerHTML = assignment.questions.map((question, index) => `
    <article class="question-card" data-question-id="${question.id}">
      <h3>Câu ${index + 1}: ${question.prompt}</h3>
      <div class="student-options">
        ${question.options.map((option) => `
          <label class="student-option">
            <input type="checkbox" name="${question.id}" value="${option.id}">
            <span>${option.text}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function collectAnswers() {
  return Object.fromEntries(assignment.questions.map((question) => {
    const selected = [...document.querySelectorAll(`input[name="${question.id}"]:checked`)].map((input) => input.value);
    return [question.id, selected];
  }));
}

function renderResult(result) {
  document.getElementById("resultPanel").hidden = false;
  document.getElementById("scoreText").textContent = `Điểm của bạn: ${result.score}/${result.total}`;
  document.getElementById("timeText").textContent = `Bắt đầu: ${result.startedAt} · Kết thúc: ${result.submittedAt}`;
  document.getElementById("explanationList").innerHTML = result.details.map((detail, index) => `
    <article class="explanation-card ${detail.correct ? "correct" : "wrong"}">
      <h3>Câu ${index + 1}: ${detail.correct ? "Đúng" : "Chưa đúng"}</h3>
      <p>${detail.prompt}</p>
      <p><strong>Đáp án đúng:</strong> ${detail.options.filter((option) => detail.correctIds.includes(option.id)).map((option) => option.text).join(", ")}</p>
      <p><strong>Giải thích:</strong> ${detail.explanation || "Giáo viên chưa nhập giải thích."}</p>
    </article>
  `).join("");
}

async function bootAssignment() {
  if (!assignmentId) {
    showStudentMessage("Link bài tập thiếu mã bài tập.");
    return;
  }
  try {
    if (isStaticMode()) {
      const item = readStaticAssignments().find((assignmentItem) => String(assignmentItem.id) === String(assignmentId));
      if (!item || item.status !== "published") {
        showStudentMessage("Không tìm thấy bài tập hoặc bài tập chưa được mở.");
        return;
      }
      assignment = prepareStaticAssignment(item);
      document.getElementById("assignmentTitle").textContent = assignment.title;
      document.getElementById("assignmentDescription").textContent = assignment.description || "Chọn tất cả đáp án đúng cho từng câu.";
      renderQuiz();
      return;
    }
    const data = await studentApi(`/api/assignments/${assignmentId}`);
    assignment = data.assignment;
    document.getElementById("assignmentTitle").textContent = assignment.title;
    document.getElementById("assignmentDescription").textContent = assignment.description || "Chọn tất cả đáp án đúng cho từng câu.";
    renderQuiz();
  } catch (error) {
    showStudentMessage(error.message);
  }
}

document.getElementById("studentStartForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const studentName = document.getElementById("studentName").value.trim();
  const studentCode = document.getElementById("studentCode").value.trim();
  const email = document.getElementById("studentEmail").value.trim();

  try {
    if (isStaticMode()) {
      if ((!studentName && !studentCode) || !email) {
        showStudentMessage("Học sinh cần nhập tên hoặc số báo danh và Gmail.");
        return;
      }
      submissionId = crypto.randomUUID();
      staticStartedAt = new Date().toISOString();
      const submissions = readStaticSubmissions();
      submissions.unshift({
        id: submissionId,
        assignment_id: assignmentId,
        student_name: studentName || studentCode,
        student_code: studentCode,
        email,
        started_at: staticStartedAt,
        submitted_at: null,
        score: 0,
        total: 0,
        feedback: ""
      });
      writeStaticSubmissions(submissions);
      document.getElementById("studentLoginPanel").hidden = true;
      document.getElementById("quizForm").hidden = false;
      return;
    }
    const data = await studentApi(`/api/assignments/${assignmentId}/start`, {
      method: "POST",
      body: JSON.stringify({ studentName, studentCode, email })
    });
    submissionId = data.submissionId;
    document.getElementById("studentLoginPanel").hidden = true;
    document.getElementById("quizForm").hidden = false;
  } catch (error) {
    showStudentMessage(error.message);
  }
});

document.getElementById("quizForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (isStaticMode()) {
      const answers = collectAnswers();
      const result = evaluateStaticAssignment(answers);
      const submittedAt = new Date().toISOString();
      const submissions = readStaticSubmissions().map((submission) => (
        submission.id === submissionId
          ? { ...submission, answers, score: result.score, total: result.total, submitted_at: submittedAt }
          : submission
      ));
      writeStaticSubmissions(submissions);
      document.getElementById("quizForm").hidden = true;
      renderResult({ ...result, startedAt: staticStartedAt, submittedAt });
      return;
    }
    const result = await studentApi(`/api/assignments/${assignmentId}/submit`, {
      method: "POST",
      body: JSON.stringify({ submissionId, answers: collectAnswers() })
    });
    document.getElementById("quizForm").hidden = true;
    renderResult(result);
  } catch (error) {
    showStudentMessage(error.message);
  }
});

bootAssignment();
