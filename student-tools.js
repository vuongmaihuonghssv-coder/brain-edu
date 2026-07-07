const studentToolClassesKey = "mhStaticClasses";

function toolReadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function toolWriteJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toolCurrentUser() {
  const user = toolReadJson("mhCurrentUser", null);
  if (user) return user;
  const fallback = { name: "maihuong.demo", username: "maihuong.demo", email: "maihuong.demo@gmail.com" };
  toolWriteJson("mhCurrentUser", fallback);
  return fallback;
}

function toolApplyUser() {
  const user = toolCurrentUser();
  const name = user.name || user.username || user.email || "maihuong.demo";
  const initial = name.trim().charAt(0).toUpperCase() || "M";
  document.querySelectorAll("[data-student-name]").forEach((item) => {
    item.textContent = name;
  });
  document.querySelectorAll("[data-student-avatar]").forEach((item) => {
    item.textContent = initial;
  });
}

function setupStudentToolShell() {
  toolApplyUser();
  document.getElementById("studentMenuButton")?.addEventListener("click", () => {
    document.body.classList.toggle("student-sidebar-open");
  });
  document.getElementById("studentThemeButton")?.addEventListener("click", () => {
    document.body.classList.toggle("student-soft-dark");
  });
  document.getElementById("studentBellButton")?.addEventListener("click", () => {
    alert("Bạn có 1 bài tập mới và 3 từ cần ôn hôm nay.");
  });
}

function setupReviewPage() {
  if (!document.getElementById("reviewCard")) return;
  const words = [
    { word: "recycle", phonetic: "/ˌriːˈsaɪkəl/", meaning: "tái chế" },
    { word: "reuse", phonetic: "/ˌriːˈjuːz/", meaning: "tái sử dụng" },
    { word: "sorting", phonetic: "/ˈsɔːrtɪŋ/", meaning: "phân loại" },
    { word: "material", phonetic: "/məˈtɪriəl/", meaning: "vật liệu" },
    { word: "waste", phonetic: "/weɪst/", meaning: "rác thải" }
  ];
  const card = document.getElementById("reviewCard");
  const word = document.getElementById("reviewWord");
  const phonetic = document.getElementById("reviewPhonetic");
  const meaning = document.getElementById("reviewMeaning");
  const count = document.getElementById("reviewCount");
  let index = 0;
  let remembered = 0;

  function render() {
    const item = words[index % words.length];
    word.textContent = item.word;
    phonetic.textContent = item.phonetic;
    meaning.textContent = item.meaning;
    card.classList.remove("show-meaning");
    count.textContent = `${words.length * 2} từ`;
  }

  card?.addEventListener("click", () => card.classList.toggle("show-meaning"));
  document.getElementById("reviewForgetButton")?.addEventListener("click", () => {
    index += 1;
    render();
  });
  document.getElementById("reviewRememberButton")?.addEventListener("click", () => {
    remembered += 1;
    index += 1;
    render();
    document.getElementById("reviewStatus").textContent = `Đã nhớ ${remembered} từ. Tiếp tục nhé.`;
  });
  document.getElementById("reviewSpeakButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(word.textContent));
    }
  });
  render();
}

function setupProgressPage() {
  document.getElementById("askAiButton")?.addEventListener("click", () => {
    document.getElementById("aiProgressMessage").textContent =
      "Gợi ý: hôm nay bạn nên ôn nhóm từ môi trường, sau đó làm 1 bài trắc nghiệm ngắn để giữ nhịp học.";
  });
}

function setupClassesPage() {
  const form = document.getElementById("joinClassForm");
  const input = document.getElementById("joinClassCodeInput");
  const list = document.getElementById("studentClassToolList");
  const message = document.getElementById("joinClassMessage");
  if (!form || !input || !list) return;

  function classes() {
    return toolReadJson(studentToolClassesKey, []);
  }

  function render() {
    const items = classes();
    if (!items.length) {
      list.innerHTML = `
        <div class="student-tool-empty">
          <span>▥</span>
          <p>Bạn chưa tham gia lớp nào.<br>Nhập mã lớp ở trên để bắt đầu.</p>
        </div>
      `;
      return;
    }
    list.innerHTML = items.map((item) => `
      <article class="joined-class-card">
        <div>
          <strong>${item.name || "Lớp học"}</strong>
          <span>Mã lớp: ${item.code || "DEMO"}</span>
        </div>
        <a href="classroom-detail.html?id=${encodeURIComponent(item.id || item.code || "demo")}">Xem lớp</a>
      </article>
    `).join("");
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = input.value.trim().toUpperCase();
    if (!code) {
      message.textContent = "Bạn nhập mã lớp trước nhé.";
      return;
    }
    const items = classes();
    if (!items.some((item) => item.code === code)) {
      items.push({ id: `joined-${Date.now()}`, name: `Lớp ${code.slice(0, 2) || "mới"}`, grade: "Demo", code });
      toolWriteJson(studentToolClassesKey, items);
    }
    input.value = "";
    message.textContent = "Đã tham gia lớp.";
    render();
  });

  render();
}

function setupAssignmentCodePage() {
  const form = document.getElementById("assignmentCodeForm");
  const input = document.getElementById("assignmentCodeInput");
  const message = document.getElementById("assignmentCodeMessage");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (!code) {
      message.textContent = "Bạn nhập mã bài tập trước nhé.";
      return;
    }
    localStorage.setItem("mhLastAssignmentCode", code);
    window.location.href = `assignment.html?code=${encodeURIComponent(code)}`;
  });
}

setupStudentToolShell();
setupReviewPage();
setupProgressPage();
setupClassesPage();
setupAssignmentCodePage();
