const staticAssignmentsKey = "mhStaticAssignments";
const createParams = new URLSearchParams(window.location.search);
const editingId = createParams.get("id");
let activeAiSectionId = null;
let pendingMediaTarget = null;

function readAssignments() {
  return JSON.parse(localStorage.getItem(staticAssignmentsKey) || "[]");
}

function writeAssignments(items) {
  localStorage.setItem(staticAssignmentsKey, JSON.stringify(items));
}

function newOption(correct = false) {
  return { id: crypto.randomUUID(), text: "", correct };
}

function newQuestion() {
  return {
    id: crypto.randomUUID(),
    type: "Trắc nghiệm 1",
    prompt: "",
    explanation: "",
    media: { image: "", mp3: "", youtube: "" },
    options: [newOption(true), newOption(false)]
  };
}

function blankQuestionOfType(type) {
  const mappedType = mapAiType(type);
  const question = {
    id: crypto.randomUUID(),
    type: mappedType,
    prompt: "",
    explanation: "",
    media: { image: "", mp3: "", youtube: "" },
    options: []
  };

  if (mappedType === "Trắc nghiệm N") {
    question.options = [newOption(true), newOption(true), newOption(false), newOption(false)];
    return question;
  }
  if (mappedType === "Đúng/Sai") {
    question.options = ensureTrueFalseOptions([]).map((option, index) => ({ ...option, correct: index === 0 }));
    return question;
  }
  if (mappedType === "Điền từ") {
    question.options = [{ id: crypto.randomUUID(), text: "", correct: true }];
    return question;
  }
  if (mappedType === "Ghép cặp") {
    question.options = matchingPairs([]).map((pair) => ({ id: pair.id, text: `${pair.left}::${pair.right}`, correct: true }));
    return question;
  }
  if (mappedType === "Sắp xếp") {
    question.options = orderingItems([]).map((item) => ({ id: item.id, text: item.text, correct: true }));
    return question;
  }

  question.type = "Trắc nghiệm 1";
  question.options = [newOption(true), newOption(false)];
  return question;
}

function splitAiPromptText(seedText = "") {
  return seedText
    .replace(/\r/g, "\n")
    .split(/[\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractAiKeywords(seedText = "") {
  const quoted = [...seedText.matchAll(/["'“”‘’]([^"'“”‘’]{2,})["'“”‘’]/g)].map((match) => match[1].trim());
  const topicMatches = [...seedText.matchAll(/(?:về|about|topic|chủ đề)\s+([^.;\n]+)/gi)]
    .flatMap((match) => match[1].split(/[,/|]+/))
    .map((item) => item.trim());
  const commaItems = seedText
    .split(/[,|/]+/)
    .map((item) => item.trim())
    .filter((item) => /^[A-Za-z][A-Za-z\s-]{1,24}$/.test(item));
  const englishWords = seedText.match(/\b[A-Za-z]{3,}\b/g) || [];
  const stopWords = new Set(["create", "make", "question", "questions", "exercise", "english", "grammar", "vocabulary", "about", "with", "for", "the", "and", "this", "that", "have", "from", "using", "choose", "answer", "present", "simple", "past", "future", "comparative"]);
  const words = englishWords
    .map((word) => word.toLowerCase())
    .filter((word) => !stopWords.has(word))
    .slice(0, 12);
  const combined = [...quoted, ...topicMatches, ...commaItems, ...words];
  const unique = [...new Set(combined.map((item) => item.trim()).filter(Boolean))];
  return unique.length ? unique : ["school", "study", "friend", "library", "teacher", "homework"];
}

function inferAiTopic(seedText = "") {
  const lower = seedText.toLowerCase();
  if (/present simple|hiện tại đơn|every day|usually|often|she ____ to school/.test(lower)) return "present simple";
  if (/past simple|quá khứ đơn|yesterday|last week/.test(lower)) return "past simple";
  if (/future|tương lai|will|going to/.test(lower)) return "future";
  if (/comparative|so sánh|more than|er than/.test(lower)) return "comparative";
  if (/vocabulary|từ vựng|meaning|synonym|correct word|weather was so/.test(lower)) return "vocabulary";
  if (/reading|đọc hiểu|passage|đoạn văn/.test(lower)) return "reading";
  return "general English";
}

function aiRequestedCount(seedText = "", fallback = 5) {
  const match = seedText.match(/(?:tạo|create|make|generate)?\s*(\d{1,2})\s*(?:câu|questions?|bài|items?)/i);
  const parsed = match ? Number(match[1]) : Number(fallback || 5);
  return Math.max(1, Math.min(20, parsed || 5));
}

function wantsSingleAnswer(seedText = "") {
  return /exactly\s+one|one\s+correct|single\s+answer|multiple\s+choice|chọn\s+1|một\s+đáp\s+án/i.test(seedText);
}

function isLikelyRequestLine(line = "") {
  return /(hãy|tạo|sinh|viết|generate|create|make|questions?|bài tập|câu hỏi|trắc nghiệm|đúng sai|điền từ)/i.test(line);
}

function sentenceFromPrompt(lines, keyword, topic) {
  const directSentence = lines.find((line) => (
    /\b[A-Za-z]{3,}\b/.test(line)
    && line.length > 14
    && !isLikelyRequestLine(line)
  ));
  if (directSentence) return directSentence;
  if (topic === "past simple") return `Yesterday, I learned ${keyword} at school.`;
  if (topic === "future") return `I will practice ${keyword} tomorrow.`;
  if (topic === "comparative") return `${keyword} is more interesting than before.`;
  if (topic === "vocabulary") return `${keyword} is an important English word.`;
  if (topic === "reading") return `The passage is about ${keyword}.`;
  return `She studies ${keyword} every day.`;
}

function analyzeAiPrompt(seedText = "", index = 1) {
  const lines = splitAiPromptText(seedText);
  const keywords = extractAiKeywords(seedText);
  const topic = inferAiTopic(seedText);
  const keyword = keywords[(index - 1) % keywords.length];
  const nextKeyword = keywords[index % keywords.length] || "English";
  const sentence = sentenceFromPrompt(lines, keyword, topic);
  const request = seedText.trim() || "Tạo bài tập tiếng Anh cơ bản";
  const title = topic === "general English" ? "English practice" : topic;
  const correctSentence = topic === "past simple"
    ? `Yesterday, I learned ${keyword} at school.`
    : topic === "future"
    ? `I will learn ${keyword} tomorrow.`
    : topic === "comparative"
    ? `${keyword} is more useful than ${nextKeyword}.`
    : `She studies ${keyword} every day.`;
  return {
    request,
    title,
    topic,
    keyword,
    nextKeyword,
    sentence,
    stem: `${title}: ${keyword}`,
    correctSentence
  };
}

function makeAiDistractors(keyword, nextKeyword) {
  return [
    `not ${keyword}`,
    nextKeyword,
    "different topic",
    "incorrect grammar"
  ];
}

function multipleChoiceTemplate(ai, index = 1) {
  const grammarQuestions = [
    {
      prompt: "Choose the correct word: I ___ a student.",
      correct: "am",
      options: ["am", "is", "are", "be"]
    },
    {
      prompt: "Select the correct answer: She ___ a book every evening.",
      correct: "reads",
      options: ["read", "reads", "reading", "to read"]
    },
    {
      prompt: "Choose the correct word: They ___ English on Mondays.",
      correct: "study",
      options: ["study", "studies", "studying", "to study"]
    },
    {
      prompt: "Choose the correct word: My brother ___ breakfast at seven.",
      correct: "has",
      options: ["have", "has", "having", "had"]
    }
  ];
  const pastSimple = [
    {
      prompt: "Choose the correct word: We ___ to school yesterday.",
      correct: "went",
      options: ["go", "goes", "went", "going"]
    },
    {
      prompt: "Select the correct answer: She ___ her homework last night.",
      correct: "finished",
      options: ["finish", "finishes", "finished", "finishing"]
    }
  ];
  const future = [
    {
      prompt: "Choose the correct word: She ___ visit her teacher tomorrow.",
      correct: "will",
      options: ["will", "was", "did", "does"]
    },
    {
      prompt: "Select the correct answer: They are going to ___ for the test.",
      correct: "practice",
      options: ["practice", "practices", "practiced", "practicing"]
    }
  ];
  const comparative = [
    {
      prompt: "Choose the correct word: This exercise is ___ than the last one.",
      correct: "easier",
      options: ["easy", "easier", "easiest", "easily"]
    },
    {
      prompt: "Select the correct answer: My bag is ___ than yours.",
      correct: "heavier",
      options: ["heavy", "heavier", "heaviest", "heavily"]
    }
  ];
  const vocabulary = [
    {
      prompt: "Vocabulary: Choose the correct word. The weather was so ___ that everyone stayed indoors.",
      correct: "terrible",
      options: ["terrible", "delicious", "generous", "crowded"]
    },
    {
      prompt: "Vocabulary: Choose the correct word. She gave a very ___ answer to the question.",
      correct: "clear",
      options: ["clear", "hungry", "wooden", "noisy"]
    },
    {
      prompt: "Vocabulary: Choose the correct word. The students worked hard to ___ the problem.",
      correct: "solve",
      options: ["solve", "wear", "drink", "borrow"]
    }
  ];
  const general = [
    {
      prompt: "Choose the correct word: Tom ___ football after school.",
      correct: "plays",
      options: ["play", "plays", "playing", "played"]
    },
    {
      prompt: "Choose the correct word: There ___ a pencil on the desk.",
      correct: "is",
      options: ["is", "are", "am", "be"]
    }
  ];

  const bank = ai.topic === "past simple"
    ? pastSimple
    : ai.topic === "future"
    ? future
    : ai.topic === "comparative"
    ? comparative
    : ai.topic === "vocabulary" || ai.topic === "reading"
    ? vocabulary
    : ai.topic === "present simple"
    ? grammarQuestions
    : general;
  const template = bank[(index - 1) % bank.length];
  const fallbackOptions = ["am", "is", "are", "be"];
  const options = [...new Set([...template.options, ...fallbackOptions])]
    .filter(Boolean)
    .slice(0, 4);
  if (!options.includes(template.correct)) {
    options[0] = template.correct;
  }
  return {
    ...template,
    options
  };
}

function createQuestion(type, seedText = "", index = 1) {
  const requestedType = mapAiType(type);
  const mappedType = requestedType === "Trắc nghiệm N" && wantsSingleAnswer(seedText)
    ? "Trắc nghiệm 1"
    : requestedType;
  const ai = analyzeAiPrompt(seedText, index);
  const basePrompt = ai.stem;
  const distractors = makeAiDistractors(ai.keyword, ai.nextKeyword);
  if (mappedType === "Trắc nghiệm N") {
    return {
      id: crypto.randomUUID(),
      type: mappedType,
      aiGenerated: true,
      prompt: `${basePrompt}: Chọn tất cả đáp án đúng liên quan đến "${ai.keyword}" (${index}).`,
      explanation: `Các đáp án đúng liên quan trực tiếp đến chủ đề ${ai.topic}.`,
      media: { image: "", mp3: "", youtube: "" },
      options: [
        { id: crypto.randomUUID(), text: ai.keyword, correct: true },
        { id: crypto.randomUUID(), text: ai.correctSentence, correct: true },
        { id: crypto.randomUUID(), text: distractors[1], correct: false },
        { id: crypto.randomUUID(), text: distractors[2], correct: false }
      ]
    };
  }
  if (mappedType === "Đúng/Sai") {
    const statement = ai.sentence || ai.correctSentence;
    return {
      id: crypto.randomUUID(),
      type: mappedType,
      aiGenerated: true,
      prompt: `${statement}`,
      explanation: `Câu này được tạo theo yêu cầu: ${ai.request}`,
      media: { image: "", mp3: "", youtube: "" },
      options: ensureTrueFalseOptions([]).map((option, optionIndex) => ({ ...option, correct: optionIndex === 0 }))
    };
  }
  if (mappedType === "Điền từ") {
    const fillPrompt = ai.sentence.includes("____")
      ? ai.sentence
      : topicFillBlankPrompt(ai);
    return {
      id: crypto.randomUUID(),
      type: mappedType,
      aiGenerated: true,
      prompt: `${fillPrompt} (${index})`,
      explanation: `Đáp án phù hợp với chủ đề ${ai.topic}.`,
      media: { image: "", mp3: "", youtube: "" },
      options: [{ id: crypto.randomUUID(), text: ai.keyword, correct: true }]
    };
  }
  if (mappedType === "Ghép cặp") {
    return {
      id: crypto.randomUUID(),
      type: mappedType,
      aiGenerated: true,
      prompt: `${basePrompt}: Ghép từ/cụm từ với ý nghĩa phù hợp (${index}).`,
      explanation: `Các cặp được tạo từ dữ liệu/yêu cầu bạn nhập.`,
      media: { image: "", mp3: "", youtube: "" },
      options: [
        { id: crypto.randomUUID(), text: `${ai.keyword}::related to ${ai.topic}`, correct: true },
        { id: crypto.randomUUID(), text: `${ai.nextKeyword}::another key idea`, correct: true }
      ]
    };
  }
  if (mappedType === "Sắp xếp") {
    const words = (ai.sentence || ai.correctSentence).replace(/[.?!]/g, "").split(/\s+/).filter(Boolean);
    return {
      id: crypto.randomUUID(),
      type: mappedType,
      aiGenerated: true,
      prompt: `${basePrompt}: Sắp xếp các từ thành câu đúng (${index}).`,
      explanation: `Sắp xếp thành câu: ${words.join(" ")}`,
      media: { image: "", mp3: "", youtube: "" },
      options: words.slice(0, 8).map((word) => ({ id: crypto.randomUUID(), text: word, correct: true }))
    };
  }
  const mc = multipleChoiceTemplate(ai, index);
  return {
    id: crypto.randomUUID(),
    type: "Trắc nghiệm 1",
    aiGenerated: true,
    prompt: mc.prompt,
    explanation: "",
    media: { image: "", mp3: "", youtube: "" },
    options: mc.options.map((option) => ({
      id: crypto.randomUUID(),
      text: option,
      correct: option === mc.correct
    }))
  };
}

function topicFillBlankPrompt(ai) {
  if (ai.topic === "past simple") return `Yesterday, I ____ about ${ai.nextKeyword}.`;
  if (ai.topic === "future") return `Tomorrow, we will learn ____ in class.`;
  if (ai.topic === "comparative") return `${ai.keyword} is ____ useful than ${ai.nextKeyword}.`;
  if (ai.topic === "vocabulary") return `The correct vocabulary word is ____.`;
  return `She studies ____ every day.`;
}

function mapAiType(type) {
  if (type === "Đúng/Sai THPT") return "Đúng/Sai";
  if (type === "Điền từ (Gợi ý)" || type === "Điền từ (DS)") return "Điền từ";
  if (type === "Phân loại") return "Ghép cặp";
  return type;
}

function newSection(title = "") {
  return {
    id: crypto.randomUUID(),
    title,
    readingContent: "",
    readingVisible: false,
    type: "Trắc nghiệm 1",
    questions: [newQuestion()]
  };
}

function flattenQuestions(sections) {
  return sections.flatMap((section) => section.questions.map((question) => ({
    ...question,
    prompt: question.prompt || section.title || "Câu hỏi trắc nghiệm",
    explanation: question.explanation || "Xem lại kiến thức trong phần này."
  })));
}

function renderSections(sections) {
  const container = document.getElementById("visualSections");
  container.innerHTML = sections.map((section, index) => `
    <section class="create-card visual-section" data-section-id="${section.id}">
      <div class="section-line">
        <span>Phần ${index + 1}</span>
        <input type="text" data-section-title="${section.id}" value="${section.title || ""}" placeholder="Tiêu đề phần (VD: Reading 1)">
        <button class="button secondary" type="button" data-toggle-reading="${section.id}">▥ Bài đọc</button>
        <button class="delete-section-button" type="button" data-delete-section="${section.id}">Xóa phần</button>
      </div>
      ${renderReadingEditor(section)}
      <div class="question-type-row">
        <button class="${section.type === "Trắc nghiệm 1" ? "active" : ""}" type="button" data-type="${section.id}:Trắc nghiệm 1">Trắc nghiệm 1</button>
        <button class="${section.type === "Trắc nghiệm N" ? "active" : ""}" type="button" data-type="${section.id}:Trắc nghiệm N">Trắc nghiệm N</button>
        <button class="${section.type === "Đúng/Sai" ? "active" : ""}" type="button" data-type="${section.id}:Đúng/Sai">Đúng/Sai</button>
        <button class="${section.type === "Điền từ" ? "active" : ""}" type="button" data-type="${section.id}:Điền từ">Điền từ</button>
        <button class="${section.type === "Ghép cặp" ? "active" : ""}" type="button" data-type="${section.id}:Ghép cặp">Ghép cặp</button>
        <button class="${section.type === "Sắp xếp" ? "active" : ""}" type="button" data-type="${section.id}:Sắp xếp">Sắp xếp</button>
        <button class="${section.type === "AI" ? "active" : ""}" type="button" data-type="${section.id}:AI">✧ AI</button>
      </div>
      ${(section.questions || [newQuestion()]).map((question, questionIndex) => renderVisualQuestion(question, questionIndex)).join("")}
    </section>
  `).join("");
}

function renderReadingEditor(section) {
  if (!section.readingVisible && !section.readingContent) return "";
  return `
    <div class="reading-editor" data-reading-panel="${section.id}">
      <div class="reading-toolbar" aria-label="Công cụ bài đọc">
        <button type="button" data-reading-command="${section.id}:bold">B</button>
        <button type="button" data-reading-command="${section.id}:italic">/</button>
        <button type="button" data-reading-command="${section.id}:underline">U</button>
        <button type="button" data-reading-command="${section.id}:heading">H</button>
        <button type="button" data-reading-command="${section.id}:list">• List</button>
        <button type="button" data-reading-command="${section.id}:image">▧ Ảnh</button>
        <button type="button" data-reading-command="${section.id}:youtube">▣ Youtube</button>
        <button type="button" data-reading-command="${section.id}:audio">♫ Âm thanh</button>
      </div>
      <div class="reading-content" contenteditable="true" data-reading-content="${section.id}" aria-label="Nội dung bài đọc">${section.readingContent || ""}</div>
    </div>
  `;
}

function renderVisualQuestion(question, questionIndex) {
  const isTrueFalse = question.type === "Đúng/Sai";
  const isFillBlank = question.type === "Điền từ";
  const isMatching = question.type === "Ghép cặp";
  const isOrdering = question.type === "Sắp xếp";
  const singleChoice = question.type !== "Trắc nghiệm N";
  const inputType = singleChoice ? "radio" : "checkbox";
  const helperText = isOrdering
    ? "Nhập theo đúng thứ tự"
    : isMatching
    ? "Ghép vế trái với vế phải"
    : isFillBlank
    ? "Nhập đáp án đúng"
    : isTrueFalse
    ? "Chọn 1 đáp án đúng"
    : singleChoice
    ? "Chọn 1 đáp án đúng"
    : "Có thể chọn nhiều đáp án đúng";
  const optionLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const options = isTrueFalse
    ? ensureTrueFalseOptions(question.options)
    : question.options;
  return `
    <div class="visual-question expanded" data-question-id="${question.id}" data-ai-generated="${question.aiGenerated ? "true" : ""}" data-media-image="${question.media?.image || ""}" data-media-mp3="${question.media?.mp3 || ""}" data-media-youtube="${question.media?.youtube || ""}">
      <div class="visual-question-head">
        <h3>Câu ${questionIndex + 1} <span>(${question.type || "Trắc nghiệm 1"} · ${helperText})</span></h3>
        <div class="visual-media-actions">
          <button type="button" data-media-field="${question.id}:image">▧ Hình</button>
          <button type="button" data-media-field="${question.id}:mp3">♫ MP3</button>
          <button type="button" data-media-field="${question.id}:youtube">▣ Youtube</button>
          <button class="delete-question-button" type="button" data-clear-question="${question.id}">Xóa câu hỏi</button>
        </div>
      </div>
      ${renderMediaPreview(question)}
      <input class="question-content-input" type="text" data-question-prompt="${question.id}" value="${question.prompt || ""}" placeholder="Nội dung câu hỏi">
      ${isMatching ? renderMatchingEditor(question) : ""}
      ${isOrdering ? renderOrderingEditor(question) : ""}
      ${isFillBlank
        ? `<input class="question-content-input" type="text" data-fill-answer="${question.id}" value="${fillBlankValue(question.options)}" placeholder="Đáp án đúng (nhiều đáp án cách nhau bởi dấu /)">`
        : ""}
      ${isTrueFalse || isFillBlank || isMatching || isOrdering || question.aiGenerated ? "" : `<input class="question-content-input" type="text" data-question-explanation="${question.id}" value="${question.explanation || ""}" placeholder="Giải thích đáp án">`}
      ${isFillBlank || isMatching || isOrdering ? "" : `<div class="visual-options">
        ${options.map((option, optionIndex) => `
          <label class="visual-option-row ${isTrueFalse ? "true-false-row" : ""}">
            <input type="${inputType}" name="correct-${question.id}" data-option-correct="${question.id}:${option.id}" ${option.correct ? "checked" : ""}>
            ${isTrueFalse
              ? `<span>${option.text}</span><input type="hidden" data-option-text="${question.id}:${option.id}" value="${option.text}">`
              : `<input type="text" data-option-text="${question.id}:${option.id}" value="${option.text || ""}" placeholder="Đáp án ${optionLetters[optionIndex] || optionIndex + 1}"><button type="button" data-remove-visual-option="${question.id}:${option.id}">×</button>`}
          </label>
        `).join("")}
      </div>`}
      ${isTrueFalse || isFillBlank || isMatching || isOrdering ? "" : `<button class="add-answer-button" type="button" data-add-visual-option="${question.id}">+ Thêm</button>`}
      <div class="score-line">
        <span>Cách tính điểm</span>
        <input type="number" min="0" value="1" aria-label="Điểm câu hỏi">
      </div>
    </div>
  `;
}

function renderMediaPreview(question) {
  const image = question.media?.image || "";
  const mp3 = question.media?.mp3 || "";
  const youtube = question.media?.youtube || "";
  if (!image && !mp3 && !youtube) return "";
  return `
    <div class="media-preview">
      ${image ? `<img src="${image}" alt="Hình minh họa câu hỏi">` : ""}
      ${mp3 ? `<audio src="${mp3}" controls></audio>` : ""}
      ${youtube ? `<a href="${youtube}" target="_blank" rel="noreferrer">Mở Youtube</a>` : ""}
    </div>
  `;
}

function renderMatchingEditor(question) {
  const pairs = matchingPairs(question.options);
  return `
    <div class="matching-editor">
      ${pairs.map((pair, index) => `
        <div class="matching-row" data-match-id="${pair.id}">
          <input type="text" data-match-left="${question.id}:${pair.id}" value="${pair.left}" placeholder="Vế trái #${index + 1}">
          <span>↔</span>
          <input type="text" data-match-right="${question.id}:${pair.id}" value="${pair.right}" placeholder="Vế phải #${index + 1}">
          <button type="button" data-remove-match="${question.id}:${pair.id}">×</button>
        </div>
      `).join("")}
      <button class="add-answer-button" type="button" data-add-match="${question.id}">+ Thêm cặp</button>
    </div>
  `;
}

function matchingPairs(options = []) {
  const pairs = options
    .filter((option) => option.correct && option.text.includes("::"))
    .map((option) => {
      const [left, right] = option.text.split("::");
      return { id: option.id, left: left || "", right: right || "" };
    });
  return pairs.length ? pairs : [
    { id: crypto.randomUUID(), left: "", right: "" },
    { id: crypto.randomUUID(), left: "", right: "" }
  ];
}

function renderOrderingEditor(question) {
  const items = orderingItems(question.options);
  return `
    <div class="ordering-editor">
      <p>Nhập theo ĐÚNG thứ tự:</p>
      ${items.map((item, index) => `
        <div class="ordering-row" data-order-id="${item.id}">
          <span>${index + 1}</span>
          <input type="text" data-order-text="${question.id}:${item.id}" value="${item.text}" placeholder="Mục ${index + 1}">
          <button type="button" data-remove-order="${question.id}:${item.id}">×</button>
        </div>
      `).join("")}
      <button class="add-answer-button" type="button" data-add-order="${question.id}">+ Mục</button>
    </div>
  `;
}

function orderingItems(options = []) {
  const items = options
    .filter((option) => option.correct)
    .map((option) => ({ id: option.id, text: option.text || "" }));
  return items.length ? items : [
    { id: crypto.randomUUID(), text: "" },
    { id: crypto.randomUUID(), text: "" }
  ];
}

function ensureTrueFalseOptions(options = []) {
  const trueOption = options.find((option) => option.text === "Đúng") || { id: crypto.randomUUID(), text: "Đúng", correct: true };
  const falseOption = options.find((option) => option.text === "Sai") || { id: crypto.randomUUID(), text: "Sai", correct: false };
  return [trueOption, falseOption];
}

function fillBlankValue(options = []) {
  return options.filter((option) => option.correct).map((option) => option.text).join(" / ");
}

function collectSections() {
  return [...document.querySelectorAll(".visual-section")].map((sectionNode) => {
    const sectionId = sectionNode.dataset.sectionId;
    const checkedTypeButton = sectionNode.querySelector(".question-type-row button.active");
    const questions = [...sectionNode.querySelectorAll(".visual-question")].map((questionNode) => collectVisualQuestion(questionNode, checkedTypeButton?.textContent.trim() || "Trắc nghiệm 1"));
    return {
      id: sectionId,
      title: sectionNode.querySelector(`[data-section-title="${sectionId}"]`).value.trim(),
      readingContent: sectionNode.querySelector(`[data-reading-content="${sectionId}"]`)?.innerHTML.trim() || "",
      readingVisible: Boolean(sectionNode.querySelector(`[data-reading-panel="${sectionId}"]`)),
      type: checkedTypeButton?.textContent.trim() || "Trắc nghiệm 1",
      questions
    };
  });
}

function collectVisualQuestion(questionNode, fallbackType) {
  const questionId = questionNode.dataset.questionId;
  const title = questionNode.querySelector(".visual-question-head h3 span")?.textContent || "";
  const type = title.includes("Trắc nghiệm N") ? "Trắc nghiệm N"
    : title.includes("Đúng/Sai") ? "Đúng/Sai"
    : title.includes("Điền từ") ? "Điền từ"
    : title.includes("Ghép cặp") ? "Ghép cặp"
    : title.includes("Sắp xếp") ? "Sắp xếp"
    : fallbackType;
  const fillAnswerInput = questionNode.querySelector(`[data-fill-answer="${questionId}"]`);
  const matchInputs = [...questionNode.querySelectorAll("[data-match-left]")];
  const orderInputs = [...questionNode.querySelectorAll("[data-order-text]")];
  const options = fillAnswerInput
    ? fillAnswerInput.value.split("/").map((answer) => answer.trim()).filter(Boolean).map((answer) => ({
      id: crypto.randomUUID(),
      text: answer,
      correct: true
    }))
    : matchInputs.length
    ? matchInputs.map((leftInput) => {
      const [, pairId] = leftInput.dataset.matchLeft.split(":");
      const rightInput = questionNode.querySelector(`[data-match-right="${questionId}:${pairId}"]`);
      return {
        id: pairId,
        text: `${leftInput.value.trim()}::${rightInput.value.trim()}`,
        correct: true
      };
    })
    : orderInputs.length
    ? orderInputs.map((input) => {
      const [, itemId] = input.dataset.orderText.split(":");
      return {
        id: itemId,
        text: input.value.trim(),
        correct: true
      };
    })
    : [...questionNode.querySelectorAll("[data-option-text]")].map((input) => {
      const [, optionId] = input.dataset.optionText.split(":");
      return {
        id: optionId,
        text: input.value.trim(),
        correct: questionNode.querySelector(`[data-option-correct="${questionId}:${optionId}"]`).checked
      };
    });

  return {
    id: questionId,
    type,
    aiGenerated: questionNode.dataset.aiGenerated === "true",
    prompt: questionNode.querySelector(`[data-question-prompt="${questionId}"]`).value.trim(),
    explanation: questionNode.querySelector(`[data-question-explanation="${questionId}"]`)?.value.trim() || "",
    media: {
      image: questionNode.dataset.mediaImage || "",
      mp3: questionNode.dataset.mediaMp3 || "",
      youtube: questionNode.dataset.mediaYoutube || ""
    },
    options
  };
}

function showMessage(text, type = "success") {
  const message = document.getElementById("visualAssignmentMessage");
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function loadInitial() {
  const assignment = readAssignments().find((item) => String(item.id) === String(editingId));
  if (assignment) {
    document.getElementById("visualAssignmentTitle").value = assignment.title;
    renderSections(assignment.sections?.length ? assignment.sections : [newSection(assignment.description || "Phần 1")]);
    return;
  }
  renderSections([newSection()]);
}

document.getElementById("addVisualSection").addEventListener("click", () => {
  renderSections([...collectSections(), newSection()]);
});

document.getElementById("visualSections").addEventListener("click", (event) => {
  const clickedButton = event.target.closest("button");
  if (!clickedButton || !document.getElementById("visualSections").contains(clickedButton)) return;

  const deleteId = clickedButton.dataset.deleteSection;
  const typeValue = clickedButton.dataset.type;
  const addOptionQuestionId = clickedButton.dataset.addVisualOption;
  const removeOptionValue = clickedButton.dataset.removeVisualOption;
  const clearQuestionId = clickedButton.dataset.clearQuestion;
  const addMatchQuestionId = clickedButton.dataset.addMatch;
  const removeMatchValue = clickedButton.dataset.removeMatch;
  const addOrderQuestionId = clickedButton.dataset.addOrder;
  const removeOrderValue = clickedButton.dataset.removeOrder;
  const mediaField = clickedButton.dataset.mediaField;
  const toggleReadingId = clickedButton.dataset.toggleReading;
  const readingCommand = clickedButton.dataset.readingCommand;
  if (deleteId) {
    const next = collectSections().filter((section) => section.id !== deleteId);
    renderSections(next);
    return;
  }
  if (toggleReadingId) {
    const next = collectSections().map((section) => (
      section.id === toggleReadingId
        ? { ...section, readingVisible: !section.readingVisible }
        : section
    ));
    renderSections(next);
    return;
  }
  if (readingCommand) {
    const [sectionId, command] = readingCommand.split(":");
    runReadingCommand(sectionId, command);
    return;
  }
  if (typeValue) {
    const [sectionId, type] = typeValue.split(":");
    if (type === "AI") {
      activeAiSectionId = sectionId;
      openAiModal();
      return;
    }
    const next = collectSections().map((section) => {
      if (section.id !== sectionId) return section;
      const hasOnlyEmptyDefault = section.questions.length === 1 &&
        !section.questions[0].prompt &&
        !section.questions[0].explanation &&
        section.questions[0].options.every((option) => !option.text);
      const nextQuestion = blankQuestionOfType(type);
      return {
        ...section,
        type,
        questions: hasOnlyEmptyDefault ? [nextQuestion] : [...section.questions, nextQuestion]
      };
    });
    renderSections(next);
    return;
  }
  if (addOptionQuestionId) {
    const next = collectSections().map((section) => ({
      ...section,
      questions: section.questions.map((question) => (
        question.id === addOptionQuestionId
          ? { ...question, options: [...question.options, newOption(false)] }
          : question
      ))
    }));
    renderSections(next);
    return;
  }
  if (removeOptionValue) {
    const [questionId, optionId] = removeOptionValue.split(":");
    const next = collectSections().map((section) => ({
      ...section,
      questions: section.questions.map((question) => (
        question.id === questionId
          ? { ...question, options: question.options.filter((option) => option.id !== optionId) }
          : question
      ))
    }));
    renderSections(next);
    return;
  }
  if (addMatchQuestionId) {
    const next = collectSections().map((section) => ({
      ...section,
      questions: section.questions.map((question) => (
        question.id === addMatchQuestionId
          ? { ...question, options: [...question.options, { id: crypto.randomUUID(), text: "::", correct: true }] }
          : question
      ))
    }));
    renderSections(next);
    return;
  }
  if (removeMatchValue) {
    const [questionId, pairId] = removeMatchValue.split(":");
    const next = collectSections().map((section) => ({
      ...section,
      questions: section.questions.map((question) => (
        question.id === questionId
          ? { ...question, options: question.options.filter((option) => option.id !== pairId) }
          : question
      ))
    }));
    renderSections(next);
    return;
  }
  if (addOrderQuestionId) {
    const next = collectSections().map((section) => ({
      ...section,
      questions: section.questions.map((question) => (
        question.id === addOrderQuestionId
          ? { ...question, options: [...question.options, { id: crypto.randomUUID(), text: "", correct: true }] }
          : question
      ))
    }));
    renderSections(next);
    return;
  }
  if (removeOrderValue) {
    const [questionId, itemId] = removeOrderValue.split(":");
    const next = collectSections().map((section) => ({
      ...section,
      questions: section.questions.map((question) => (
        question.id === questionId
          ? { ...question, options: question.options.filter((option) => option.id !== itemId) }
          : question
      ))
    }));
    renderSections(next);
    return;
  }
  if (clearQuestionId) {
    const next = collectSections().map((section) => ({
      ...section,
      questions: section.questions.filter((question) => question.id !== clearQuestionId)
    }));
    renderSections(next);
    return;
  }
  if (mediaField) {
    const [questionId, field] = mediaField.split(":");
    pendingMediaTarget = { questionId, field };
    if (field === "image") {
      document.getElementById("questionImagePicker").click();
    }
    if (field === "mp3") {
      document.getElementById("questionAudioPicker").click();
    }
    if (field === "youtube") {
      openYoutubeModal(questionId);
    }
    return;
  }
});

function runReadingCommand(sectionId, command) {
  const editor = document.querySelector(`[data-reading-content="${sectionId}"]`);
  if (!editor) return;
  editor.focus();

  if (command === "bold") {
    document.execCommand("bold");
    return;
  }
  if (command === "italic") {
    document.execCommand("italic");
    return;
  }
  if (command === "underline") {
    document.execCommand("underline");
    return;
  }
  if (command === "heading") {
    document.execCommand("formatBlock", false, "h3");
    return;
  }
  if (command === "list") {
    document.execCommand("insertUnorderedList");
    return;
  }
  if (command === "image") {
    const imageUrl = window.prompt("Dán link hình ảnh:");
    if (imageUrl) document.execCommand("insertImage", false, imageUrl.trim());
    return;
  }
  if (command === "youtube") {
    const youtubeUrl = window.prompt("Dán link Youtube:");
    if (youtubeUrl) {
      document.execCommand("insertHTML", false, `<p><a href="${youtubeUrl.trim()}" target="_blank" rel="noreferrer">Mở Youtube</a></p>`);
    }
    return;
  }
  if (command === "audio") {
    const audioUrl = window.prompt("Dán link âm thanh MP3:");
    if (audioUrl) {
      document.execCommand("insertHTML", false, `<p><audio src="${audioUrl.trim()}" controls></audio></p>`);
    }
  }
}

function setQuestionMedia(questionId, field, value) {
  const next = collectSections().map((section) => ({
    ...section,
    questions: section.questions.map((question) => (
      question.id === questionId
        ? { ...question, media: { ...(question.media || {}), [field]: value } }
        : question
    ))
  }));
  renderSections(next);
}

function readPickedFile(file, callback) {
  if (!file || !pendingMediaTarget) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    callback(reader.result);
    pendingMediaTarget = null;
  });
  reader.readAsDataURL(file);
}

document.getElementById("questionImagePicker").addEventListener("change", (event) => {
  readPickedFile(event.target.files[0], (dataUrl) => {
    setQuestionMedia(pendingMediaTarget.questionId, "image", dataUrl);
    event.target.value = "";
  });
});

document.getElementById("questionAudioPicker").addEventListener("change", (event) => {
  readPickedFile(event.target.files[0], (dataUrl) => {
    setQuestionMedia(pendingMediaTarget.questionId, "mp3", dataUrl);
    event.target.value = "";
  });
});

function openYoutubeModal(questionId) {
  const questionNode = document.querySelector(`[data-question-id="${questionId}"]`);
  pendingMediaTarget = { questionId, field: "youtube" };
  document.getElementById("youtubeModalInput").value = questionNode?.dataset.mediaYoutube || "";
  document.getElementById("youtubeLinkModal").hidden = false;
  document.getElementById("youtubeModalInput").focus();
}

function closeYoutubeModal() {
  document.getElementById("youtubeLinkModal").hidden = true;
  document.getElementById("youtubeModalInput").value = "";
  pendingMediaTarget = null;
}

document.getElementById("closeYoutubeModal").addEventListener("click", closeYoutubeModal);
document.getElementById("cancelYoutubeModal").addEventListener("click", closeYoutubeModal);

document.getElementById("insertYoutubeLink").addEventListener("click", () => {
  const link = document.getElementById("youtubeModalInput").value.trim();
  if (!pendingMediaTarget?.questionId) return;
  setQuestionMedia(pendingMediaTarget.questionId, "youtube", link);
  closeYoutubeModal();
});

function openAiModal() {
  const modal = document.getElementById("aiQuestionModal");
  modal.hidden = false;
}

function closeAiModal() {
  const modal = document.getElementById("aiQuestionModal");
  modal.hidden = true;
}

function selectedAiTypes() {
  return [...document.querySelectorAll(".ai-type-grid input:checked")].map((input) => input.value);
}

function generateAiQuestionsForSection() {
  const types = selectedAiTypes();
  const prompt = document.getElementById("aiPromptText").value.trim();
  const count = aiRequestedCount(prompt, document.getElementById("aiQuestionCount").value || 5);
  if (!types.length) {
    alert("Vui lòng chọn ít nhất một dạng câu hỏi.");
    return;
  }
  if (!activeAiSectionId) {
    alert("Vui lòng chọn phần cần tạo câu hỏi.");
    return;
  }

  const createdQuestions = types.flatMap((type) => (
    Array.from({ length: count }, (_, index) => createQuestion(type, prompt, index + 1))
  ));

  const next = collectSections().map((section) => {
    if (section.id !== activeAiSectionId) return section;
    return {
      ...section,
      type: createdQuestions[0]?.type || section.type,
      questions: [...section.questions, ...createdQuestions]
    };
  });

  renderSections(next);
  closeAiModal();
}

document.getElementById("closeAiModal")?.addEventListener("click", closeAiModal);
document.getElementById("cancelAiModal")?.addEventListener("click", closeAiModal);
document.getElementById("generateAiQuestions")?.addEventListener("click", generateAiQuestionsForSection);
document.getElementById("aiQuestionModal")?.addEventListener("click", (event) => {
  if (event.target.id === "aiQuestionModal") closeAiModal();
});

document.getElementById("visualAssignmentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const sections = collectSections();
  const title = document.getElementById("visualAssignmentTitle").value.trim();
  const description = sections.map((section) => section.title).filter(Boolean).join(" · ");
  const questions = flattenQuestions(sections);
  const invalid = questions.some((question) => (
    question.type === "Điền từ"
      ? question.options.filter((option) => option.text && option.correct).length < 1
      : question.type === "Ghép cặp"
      ? question.options.filter((option) => {
        const [left, right] = option.text.split("::");
        return left && right;
      }).length < 1
      : question.type === "Sắp xếp"
      ? question.options.filter((option) => option.text && option.correct).length < 2
      : question.options.filter((option) => option.text).length < 2 ||
    !question.options.some((option) => option.correct)
  ));
  if (invalid) {
    showMessage("Trắc nghiệm cần ít nhất 2 đáp án; Điền từ cần 1 đáp án; Ghép cặp cần 1 cặp; Sắp xếp cần ít nhất 2 mục.", "error");
    return;
  }
  const items = readAssignments();
  const payload = {
    id: editingId || crypto.randomUUID(),
    title,
    description,
    status: "published",
    sections,
    questions
  };
  const next = editingId
    ? items.map((item) => (String(item.id) === String(editingId) ? payload : item))
    : [payload, ...items];
  writeAssignments(next);
  showMessage("Đã lưu bài tập. Đang quay lại danh sách...");
  window.setTimeout(() => {
    window.location.href = "assignments.html";
  }, 650);
});

loadInitial();
