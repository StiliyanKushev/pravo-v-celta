(function () {
  "use strict";

  const data = window.STUDY_DATA;
  const app = document.querySelector("#app");
  const storageKey = "pravo-v-celta-progress-v1";
  const letters = ["A", "Б", "В", "Г"];
  const EXAM_LENGTH = 40;
  const EXAM_MAX_MISTAKES = 8;

  const ui = {
    route: "home",
    cardSection: "all",
    cardsPriorityOnly: false,
    cardsDueOnly: false,
    cardIndex: 0,
    cardFlipped: false,
    partsWeapon: "all",
    partsIndex: 0,
    partsFlipped: false,
    quiz: null,
    lastQuiz: null,
    notesSection: "all",
    notesPriorityOnly: false,
    notesSearch: "",
    openLessons: new Set(),
  };

  let progress = loadProgress();

  function loadProgress() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored && stored.version === 1) {
        if (!stored.parts) stored.parts = {};
        return stored;
      }
    } catch (_) {}
    return { version: 1, cards: {}, questions: {}, parts: {}, studyDays: [] };
  }

  function saveProgress() {
    localStorage.setItem(storageKey, JSON.stringify(progress));
    updateHeaderProgress();
  }

  function markStudyDay() {
    const day = new Date().toLocaleDateString("sv-SE");
    if (!progress.studyDays.includes(day)) {
      progress.studyDays.push(day);
      progress.studyDays = progress.studyDays.slice(-120);
    }
  }

  function getStreak() {
    const days = new Set(progress.studyDays);
    let streak = 0;
    const cursor = new Date();
    const today = cursor.toLocaleDateString("sv-SE");
    if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toLocaleDateString("sv-SE"))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function overallProgress() {
    const seenCards = Object.values(progress.cards).filter((item) => item.seen).length;
    const answered = Object.values(progress.questions).filter((item) => item.attempts > 0).length;
    const cardPart = seenCards / data.cards.length;
    const quizPart = answered / data.questions.length;
    return Math.round((cardPart * 0.68 + quizPart * 0.32) * 100);
  }

  function sectionProgress(sectionId) {
    const cards = data.cards.filter((card) => card.section === sectionId);
    const seen = cards.filter((card) => progress.cards[card.id]?.seen).length;
    return cards.length ? Math.round((seen / cards.length) * 100) : 0;
  }

  function quizAccuracy() {
    const stats = Object.values(progress.questions);
    const attempts = stats.reduce((sum, item) => sum + (item.attempts || 0), 0);
    const correct = stats.reduce((sum, item) => sum + (item.correct || 0), 0);
    return attempts ? Math.round((correct / attempts) * 100) : 0;
  }

  function updateHeaderProgress() {
    const value = overallProgress();
    document.querySelector("#header-progress").textContent = `${value}%`;
    document.querySelector("#header-progress-bar").style.width = `${value}%`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }

  function sectionById(id) {
    return data.sections.find((section) => section.id === id);
  }

  function priorityBadge() {
    return '<span class="priority-badge">Подчертано</span>';
  }

  function sourceButton(page, label = "Виж оригинала") {
    return `<button class="small-button flash-source" data-source-page="${page}">${label} · стр. ${page}</button>`;
  }

  function renderHome() {
    const seenCards = Object.values(progress.cards).filter((item) => item.seen).length;
    const mastered = Object.values(progress.cards).filter((item) => (item.level || 0) >= 3).length;
    const answered = Object.values(progress.questions).reduce((sum, item) => sum + (item.attempts || 0), 0);
    const total = overallProgress();

    app.innerHTML = `
      <section class="page">
        <div class="hero">
          <div class="hero-copy">
            <span class="eyebrow">БЕЗОПАСНО БОРАВЕНЕ · ТЕОРЕТИЧЕН ИЗПИТ</span>
            <h1>УЧИ УМНО.<br><span>ЦЕЛИ ТОЧНО.</span></h1>
            <p>34 снимки, превърнати в ясен конспект, ${data.cards.length} карти и ${data.questions.length} ABC въпроса. Подчертаното е с приоритет, а номерата на членове и алинеи не се зубрят.</p>
            <div class="hero-actions">
              <button class="primary-button" data-route="cards">Започни с картите</button>
              <button class="secondary-button" data-route="parts">Части на оръжието</button>
              <button class="secondary-button" data-start-quiz="quick">Бърз тест · 10</button>
            </div>
          </div>
          <aside class="hero-score">
            <span class="eyebrow">ТВОЯТ НАПРЕДЪК</span>
            <div class="score-value">${total}%</div>
            <p>${seenCards} прегледани карти · ${answered} отговора<br>${getStreak() ? `${getStreak()} дни серия` : "Започни серията си днес"}</p>
            <div class="score-line"><b style="width:${total}%"></b></div>
          </aside>
        </div>

        <div class="stats-strip">
          <div class="stat-card"><strong>${seenCards}</strong><span>прегледани карти</span></div>
          <div class="stat-card"><strong>${mastered}</strong><span>усвоени карти</span></div>
          <div class="stat-card"><strong>${quizAccuracy()}%</strong><span>точност в тестове</span></div>
          <div class="stat-card"><strong>${getStreak()}</strong><span>дни серия</span></div>
        </div>

        <div class="section-heading">
          <div><span class="eyebrow">ПЕТ ТЕМИ</span><h2>Материалът без шум</h2></div>
          <p>Избери тема, за да отвориш конспекта.</p>
        </div>
        <div class="topic-grid">
          ${data.sections.map((section) => {
            const lessonCount = data.lessons.filter((lesson) => lesson.section === section.id).length;
            const value = sectionProgress(section.id);
            return `
              <button class="topic-card" data-open-section="${section.id}" style="--topic-color:${section.color}">
                <span class="topic-number">${section.number}</span>
                <h3>${section.title}</h3>
                <p>${lessonCount} теми · стр. ${section.pages}<br>${value}% прегледано</p>
                <span class="topic-progress"><b style="width:${value}%"></b></span>
              </button>`;
          }).join("")}
        </div>

        <div class="callout-grid">
          <article class="callout">
            <span class="eyebrow">ИЗПИТЕН КАПАН</span>
            <h3>Две версии на едни и същи числа</h3>
            <p>Резюмето на стр. 4 дава по-стари стойности, а подчертаната редакция от 2024 г. на стр. 5 дава 100 патрона за самоотбрана, гладка ловна цев над 44 cm и 2500 капсула / 2500 g барут. Въпросите ти показват конфликта, вместо да го прикриват.</p>
          </article>
          <article class="callout dark">
            <span class="eyebrow">ВАЖНО</span>
            <h3>Учебник, не инструкция</h3>
            <p>Първата помощ и правните казуси са възпроизведени за изпита. При реална спешност звъни на 112; за правен казус провери действащия закон.</p>
          </article>
        </div>
      </section>`;
  }

  function filteredCards() {
    const now = Date.now();
    return data.cards.filter((card) => {
      if (ui.cardSection !== "all" && card.section !== ui.cardSection) return false;
      if (ui.cardsPriorityOnly && !card.priority) return false;
      if (ui.cardsDueOnly) {
        const state = progress.cards[card.id];
        if (state?.due && state.due > now) return false;
      }
      return true;
    });
  }

  function renderCards() {
    const cards = filteredCards();
    if (ui.cardIndex >= cards.length) ui.cardIndex = 0;
    const card = cards[ui.cardIndex];
    const dueCount = data.cards.filter((item) => !progress.cards[item.id]?.due || progress.cards[item.id].due <= Date.now()).length;

    app.innerHTML = `
      <section class="page">
        <div class="page-head">
          <div><span class="eyebrow">АКТИВНО ПРИПОМНЯНЕ</span><h1>Карти</h1></div>
          <p>Обърни картата, опитай да отговориш на глас и оцени колко добре си се справил. Приложението планира повторенията локално.</p>
        </div>
        <div class="toolbar">
          <div class="filter-group">
            <button class="filter-chip ${ui.cardSection === "all" ? "active" : ""}" data-card-section="all">Всички</button>
            ${data.sections.map((section) => `<button class="filter-chip ${ui.cardSection === section.id ? "active" : ""}" data-card-section="${section.id}">${section.short}</button>`).join("")}
          </div>
          <span class="toolbar-spacer"></span>
          <label class="toggle"><input type="checkbox" data-cards-priority ${ui.cardsPriorityOnly ? "checked" : ""}> само подчертаното</label>
          <label class="toggle"><input type="checkbox" data-cards-due ${ui.cardsDueOnly ? "checked" : ""}> за повторение (${dueCount})</label>
        </div>
        ${card ? renderFlashcard(card, cards.length) : renderCardEmpty()}
      </section>`;
  }

  function renderFlashcard(card, count) {
    const section = sectionById(card.section);
    const currentState = progress.cards[card.id] || {};
    const status = currentState.seen ? `ниво ${currentState.level || 0}` : "нова карта";
    return `
      <div class="card-stage">
        <div class="card-meta">
          <span>${ui.cardIndex + 1} / ${count} · ${section.title}</span>
          <span>${status}</span>
        </div>
        <div class="flashcard ${ui.cardFlipped ? "flipped" : ""}" data-flip-card role="button" tabindex="0" aria-label="Обърни картата">
          <div class="flashcard-inner">
            <article class="flash-face flash-front">
              <div>${card.priority ? priorityBadge() : `<span class="section-badge">${section.short}</span>`}</div>
              <span class="flash-kicker">ВЪПРОС</span>
              <h2>${card.front}</h2>
              <span class="flip-hint">Натисни картата или Space, за да видиш отговора</span>
            </article>
            <article class="flash-face flash-back">
              <span class="flash-kicker">ОТГОВОР · ${section.short.toUpperCase()}</span>
              <h2>${card.back}</h2>
              ${sourceButton(card.page)}
              <span class="flip-hint">Оцени отговора си отдолу</span>
            </article>
          </div>
        </div>
        <div class="grade-row ${ui.cardFlipped ? "visible" : ""}">
          <button class="grade-button again" data-grade="again">Пак <span>1 · след 10 мин</span></button>
          <button class="grade-button hard" data-grade="hard">Трудно <span>2 · утре</span></button>
          <button class="grade-button good" data-grade="good">Знам го <span>3 · по-късно</span></button>
        </div>
      </div>`;
  }

  function renderCardEmpty() {
    return `<div class="empty-state"><h2>Няма карти в този филтър</h2><p>Промени темата или покажи всички карти.</p><button class="secondary-button" data-clear-card-filters>Покажи всички</button></div>`;
  }

  function gradeCard(grade) {
    const cards = filteredCards();
    const card = cards[ui.cardIndex];
    if (!card) return;
    const current = progress.cards[card.id] || { level: 0 };
    const intervals = [1, 2, 4, 7, 14, 30];
    let level = current.level || 0;
    let due;
    if (grade === "again") {
      level = 0;
      due = Date.now() + 10 * 60 * 1000;
    } else if (grade === "hard") {
      level = Math.max(1, level);
      due = Date.now() + 24 * 60 * 60 * 1000;
    } else {
      level = Math.min(5, level + 1);
      due = Date.now() + intervals[level] * 24 * 60 * 60 * 1000;
    }
    progress.cards[card.id] = { seen: true, level, due, lastGrade: grade, updated: Date.now() };
    markStudyDay();
    saveProgress();
    ui.cardFlipped = false;
    ui.cardIndex = cards.length > 1 ? (ui.cardIndex + 1) % cards.length : 0;
    renderCards();
  }

  function weaponLabel(key) {
    return data.weaponTypes[key]?.label || key;
  }

  function filteredParts() {
    return data.parts.filter((part) => ui.partsWeapon === "all" || part.weapons.includes(ui.partsWeapon));
  }

  function renderParts() {
    const parts = filteredParts();
    if (ui.partsIndex >= parts.length) ui.partsIndex = 0;
    const part = parts[ui.partsIndex];
    const weaponKeys = Object.keys(data.weaponTypes);

    app.innerHTML = `
      <section class="page">
        <div class="page-head">
          <div><span class="eyebrow">ОРЪЖЕЙНА КУЛТУРА</span><h1>Части на оръжието</h1></div>
          <p>Погледни отбелязаната част на снимката и се опитай да познаеш как се казва и за кое оръжие се отнася, преди да обърнеш картата.</p>
        </div>
        <div class="toolbar">
          <div class="filter-group">
            <button class="filter-chip ${ui.partsWeapon === "all" ? "active" : ""}" data-parts-weapon="all">Всички</button>
            ${weaponKeys.map((key) => `<button class="filter-chip ${ui.partsWeapon === key ? "active" : ""}" data-parts-weapon="${key}">${weaponLabel(key)}</button>`).join("")}
          </div>
        </div>
        ${part ? renderPartCard(part, parts.length) : '<div class="empty-state"><h2>Няма части в този филтър</h2><p>Избери друго оръжие.</p></div>'}
      </section>`;
  }

  function renderPartCard(part, count) {
    const currentState = progress.parts[part.id] || {};
    const status = currentState.seen ? `ниво ${currentState.level || 0}` : "нова част";
    return `
      <div class="card-stage">
        <div class="card-meta">
          <span>${ui.partsIndex + 1} / ${count} · ${part.weapons.map(weaponLabel).join(" / ")}</span>
          <span>${status}</span>
        </div>
        <div class="flashcard part-card ${ui.partsFlipped ? "flipped" : ""}" data-flip-part role="button" tabindex="0" aria-label="Обърни картата">
          <div class="flashcard-inner">
            <article class="flash-face flash-front part-face">
              <span class="flash-kicker">КОЯ ЧАСТ Е ОТБЕЛЯЗАНА?</span>
              <div class="part-image-wrap">
                <img src="${part.image}" alt="Част от оръжие" loading="lazy">
                ${part.boxes.map((box) => `<span class="part-highlight" style="left:${box.x}%;top:${box.y}%;width:${box.w}%;height:${box.h}%"></span>`).join("")}
              </div>
              <span class="flip-hint">Натисни картата или Space, за да видиш отговора</span>
            </article>
            <article class="flash-face flash-back part-face">
              <span class="flash-kicker">ОТГОВОР</span>
              <h2>${part.name}</h2>
              <div class="part-weapon-badges">${part.weapons.map((key) => `<span class="weapon-badge">${weaponLabel(key)}</span>`).join("")}</div>
              <p class="part-note">${part.note}</p>
              <span class="part-credit">${part.credit}</span>
              <span class="flip-hint">Оцени отговора си отдолу</span>
            </article>
          </div>
        </div>
        <div class="grade-row ${ui.partsFlipped ? "visible" : ""}">
          <button class="grade-button again" data-grade-part="again">Пак <span>1 · след 10 мин</span></button>
          <button class="grade-button hard" data-grade-part="hard">Трудно <span>2 · утре</span></button>
          <button class="grade-button good" data-grade-part="good">Знам го <span>3 · по-късно</span></button>
        </div>
      </div>`;
  }

  function gradePart(grade) {
    const parts = filteredParts();
    const part = parts[ui.partsIndex];
    if (!part) return;
    const current = progress.parts[part.id] || { level: 0 };
    const intervals = [1, 2, 4, 7, 14, 30];
    let level = current.level || 0;
    let due;
    if (grade === "again") {
      level = 0;
      due = Date.now() + 10 * 60 * 1000;
    } else if (grade === "hard") {
      level = Math.max(1, level);
      due = Date.now() + 24 * 60 * 60 * 1000;
    } else {
      level = Math.min(5, level + 1);
      due = Date.now() + intervals[level] * 24 * 60 * 60 * 1000;
    }
    progress.parts[part.id] = { seen: true, level, due, lastGrade: grade, updated: Date.now() };
    markStudyDay();
    saveProgress();
    ui.partsFlipped = false;
    ui.partsIndex = parts.length > 1 ? (ui.partsIndex + 1) % parts.length : 0;
    renderParts();
  }

  function renderQuiz() {
    if (!ui.quiz) return renderQuizSetup();
    if (ui.quiz.finished) return renderQuizResult();
    return renderQuizQuestion();
  }

  function renderQuizSetup() {
    const mistakes = data.questions.filter((question) => {
      const item = progress.questions[question.id];
      return item && item.attempts > item.correct;
    }).length;
    app.innerHTML = `
      <section class="page">
        <div class="page-head">
          <div><span class="eyebrow">ABC ТЕСТОВЕ</span><h1>Провери се</h1></div>
          <p>Тренировката обяснява веднага. Изпитният режим пази отговорите до края и смесва всички теми.</p>
        </div>
        <div class="quiz-setup-grid">
          <button class="mode-card" data-start-quiz="quick">
            <span class="mode-number">10</span><h3>Бърза тренировка</h3><p>10 смесени въпроса с незабавна обратна връзка и източник.</p>
          </button>
          <button class="mode-card accent" data-start-quiz="exam">
            <span class="mode-number">${EXAM_LENGTH}</span><h3>Пробен изпит</h3><p>${EXAM_LENGTH} разбъркани въпроса без подсказване, като на реалния изпит. Издържаш при до ${EXAM_MAX_MISTAKES} грешки. Резултатът и грешките се показват накрая.</p>
          </button>
          <button class="mode-card" data-start-quiz="mistakes" ${mistakes ? "" : "disabled"}>
            <span class="mode-number">${mistakes}</span><h3>Моите грешки</h3><p>${mistakes ? "Повтори въпросите, на които си грешил повече пъти." : "Тук ще се появят въпросите, които объркаш."}</p>
          </button>
        </div>
      </section>`;
  }

  function startQuiz(mode) {
    let pool = data.questions;
    let count = 10;
    if (mode === "exam") count = EXAM_LENGTH;
    if (mode === "mistakes") {
      pool = data.questions.filter((question) => {
        const item = progress.questions[question.id];
        return item && item.attempts > item.correct;
      });
      count = pool.length;
    }
    ui.quiz = {
      mode,
      list: shuffle(pool).slice(0, Math.min(count, pool.length)),
      index: 0,
      answers: [],
      selected: null,
      revealed: false,
      finished: false,
    };
    ui.route = "quiz";
    if (location.hash !== "#quiz") history.pushState(null, "", "#quiz");
    document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.route === "quiz"));
    renderQuiz();
  }

  function renderQuizQuestion() {
    const quiz = ui.quiz;
    const question = quiz.list[quiz.index];
    const section = sectionById(question.section);
    const exam = quiz.mode === "exam";
    const width = ((quiz.index + 1) / quiz.list.length) * 100;
    app.innerHTML = `
      <section class="page">
        <div class="quiz-shell">
          <div class="quiz-top"><span>${exam ? "ПРОБЕН ИЗПИТ" : "ТРЕНИРОВКА"} · ${section.title}</span><button class="text-button" data-quit-quiz>Прекрати</button></div>
          <div class="quiz-progress"><b style="width:${width}%"></b></div>
          <article class="question-panel">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
              <span class="source-badge">Въпрос ${quiz.index + 1} / ${quiz.list.length}</span>
              ${question.priority ? priorityBadge() : ""}
            </div>
            <h2>${question.prompt}</h2>
            <div class="answer-list">
              ${question.options.map((option, index) => {
                let state = "";
                if (quiz.revealed && index === question.answer) state = "correct";
                else if (quiz.revealed && index === quiz.selected && index !== question.answer) state = "wrong";
                else if (exam && quiz.selected === index) state = "selected";
                return `<button class="answer-button ${state}" data-answer="${index}" ${quiz.revealed ? "disabled" : ""}><i>${letters[index]}</i><span>${option}</span></button>`;
              }).join("")}
            </div>
            ${quiz.revealed ? `<div class="feedback"><strong>${quiz.selected === question.answer ? "Точно така." : "Верният отговор е друг."}</strong> ${question.explanation}</div>` : ""}
            <div class="question-actions">
              ${sourceButton(question.page, "Източник")}
              ${(quiz.revealed || (exam && quiz.selected !== null)) ? `<button class="primary-button" data-next-question>${quiz.index === quiz.list.length - 1 ? "Виж резултата" : "Следващ въпрос"}</button>` : ""}
            </div>
          </article>
        </div>
      </section>`;
  }

  function selectAnswer(answer) {
    const quiz = ui.quiz;
    if (!quiz || quiz.revealed) return;
    const question = quiz.list[quiz.index];
    quiz.selected = answer;
    quiz.answers[quiz.index] = answer;
    if (quiz.mode !== "exam") {
      quiz.revealed = true;
      recordQuestion(question.id, answer === question.answer);
      markStudyDay();
      saveProgress();
    }
    renderQuizQuestion();
  }

  function recordQuestion(id, correct) {
    const current = progress.questions[id] || { attempts: 0, correct: 0 };
    current.attempts += 1;
    if (correct) current.correct += 1;
    current.updated = Date.now();
    progress.questions[id] = current;
  }

  function nextQuestion() {
    const quiz = ui.quiz;
    if (!quiz) return;
    if (quiz.index === quiz.list.length - 1) {
      if (quiz.mode === "exam") {
        quiz.list.forEach((question, index) => recordQuestion(question.id, quiz.answers[index] === question.answer));
      }
      markStudyDay();
      saveProgress();
      quiz.finished = true;
      quiz.score = quiz.list.reduce((sum, question, index) => sum + Number(quiz.answers[index] === question.answer), 0);
      ui.lastQuiz = quiz;
      renderQuizResult();
      return;
    }
    quiz.index += 1;
    quiz.selected = quiz.answers[quiz.index] ?? null;
    quiz.revealed = false;
    renderQuizQuestion();
  }

  function renderQuizResult() {
    const quiz = ui.quiz;
    const percent = Math.round((quiz.score / quiz.list.length) * 100);
    const mistakes = quiz.list.filter((question, index) => quiz.answers[index] !== question.answer);
    const isExam = quiz.mode === "exam";
    const passed = isExam ? mistakes.length <= EXAM_MAX_MISTAKES : null;
    const title = isExam
      ? (passed ? "Издържан изпит" : "Не издържан изпит")
      : percent >= 85 ? "Готов си за финален кръг" : percent >= 65 ? "Добра основа" : "Още един рунд";
    const summary = isExam
      ? `${mistakes.length} грешки от ${quiz.list.length} въпроса — позволени са до ${EXAM_MAX_MISTAKES}.`
      : `${quiz.score} верни от ${quiz.list.length}. ${mistakes.length ? `Имаш ${mistakes.length} въпроса за повторение.` : "Нито една грешка — отлично."}`;
    app.innerHTML = `
      <section class="page">
        <div class="quiz-shell">
          <div class="result-panel ${isExam ? (passed ? "passed" : "failed") : ""}">
            <div class="result-ring" style="--score:${percent}%"><strong>${percent}%</strong></div>
            <h2>${title}</h2>
            <p>${summary}</p>
            <div class="result-actions">
              <button class="primary-button" data-restart-quiz>Нов тест</button>
              ${mistakes.length ? '<button class="secondary-button" data-review-session-mistakes>Повтори грешките</button>' : ""}
              <button class="secondary-button" data-route="cards">Към картите</button>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderNotes() {
    const query = ui.notesSearch.trim().toLocaleLowerCase("bg");
    const lessons = data.lessons.filter((lesson) => {
      if (ui.notesSection !== "all" && lesson.section !== ui.notesSection) return false;
      if (ui.notesPriorityOnly && !lesson.priority) return false;
      if (query) {
        const haystack = [lesson.title, lesson.summary, ...(lesson.items || [])].join(" ").toLocaleLowerCase("bg");
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    app.innerHTML = `
      <section class="page">
        <div class="page-head">
          <div><span class="eyebrow">КРАТЪК И ПЪЛЕН ПРЕГОВОР</span><h1>Конспект</h1></div>
          <p>Първо учи картите с жълт маркер. После отвори останалите теми, за да свържеш фактите в цялостна картина.</p>
        </div>
        <div class="toolbar">
          <input class="search-input" type="search" placeholder="Търси: срок, патрон, калибър…" value="${escapeHtml(ui.notesSearch)}" data-notes-search>
          <span class="toolbar-spacer"></span>
          <label class="toggle"><input type="checkbox" data-notes-priority ${ui.notesPriorityOnly ? "checked" : ""}> само подчертаното</label>
        </div>
        <div class="notes-layout">
          <aside class="notes-index">
            <button class="${ui.notesSection === "all" ? "active" : ""}" data-notes-section="all">Всички <span>${data.lessons.length}</span></button>
            ${data.sections.map((section) => `<button class="${ui.notesSection === section.id ? "active" : ""}" data-notes-section="${section.id}">${section.short}<span>${data.lessons.filter((lesson) => lesson.section === section.id).length}</span></button>`).join("")}
          </aside>
          <div class="notes-list">
            ${lessons.length ? lessons.map(renderLesson).join("") : '<div class="empty-state"><h2>Няма съвпадение</h2><p>Промени търсенето или филтъра.</p></div>'}
          </div>
        </div>
      </section>`;
  }

  function renderLesson(lesson) {
    const section = sectionById(lesson.section);
    const open = ui.openLessons.has(lesson.id);
    return `
      <article class="lesson-card ${lesson.priority ? "priority" : ""} ${open ? "open" : ""}" id="${lesson.id}">
        <button class="lesson-summary" data-toggle-lesson="${lesson.id}">
          <div>
            <div style="display:flex;gap:7px;flex-wrap:wrap"><span class="section-badge">${section.short}</span>${lesson.priority ? priorityBadge() : ""}<span class="source-badge">стр. ${lesson.page}</span></div>
            <h3>${lesson.title}</h3>
            <p>${lesson.summary}</p>
          </div>
          <span class="chevron">+</span>
        </button>
        <div class="lesson-detail">
          ${lesson.warning ? `<div class="lesson-warning"><strong>Внимание:</strong> ${lesson.warning}</div>` : ""}
          <ul>${lesson.items.map((item) => `<li>${item}</li>`).join("")}</ul>
          <div class="lesson-actions">${sourceButton(lesson.page)}<button class="small-button" data-study-section="${lesson.section}">Учи като карти</button></div>
        </div>
      </article>`;
  }

  function openSource(page) {
    const dialog = document.querySelector("#source-dialog");
    document.querySelector("#source-title").textContent = `Страница ${page}`;
    document.querySelector("#source-image").src = data.pageImages[page];
    dialog.showModal();
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1900);
  }

  function setRoute(route) {
    ui.route = ["home", "cards", "parts", "quiz", "notes"].includes(route) ? route : "home";
    document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.route === ui.route));
    if (ui.route === "home") renderHome();
    if (ui.route === "cards") renderCards();
    if (ui.route === "parts") renderParts();
    if (ui.route === "quiz") renderQuiz();
    if (ui.route === "notes") renderNotes();
    app.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]");
    if (route) {
      event.preventDefault();
      location.hash = route.dataset.route;
      return;
    }

    const openSection = event.target.closest("[data-open-section]");
    if (openSection) {
      ui.notesSection = openSection.dataset.openSection;
      location.hash = "notes";
      return;
    }

    const source = event.target.closest("[data-source-page]");
    if (source) {
      event.stopPropagation();
      openSource(Number(source.dataset.sourcePage));
      return;
    }

    if (event.target.closest("[data-close-dialog]")) {
      document.querySelector("#source-dialog").close();
      return;
    }

    const section = event.target.closest("[data-card-section]");
    if (section) {
      ui.cardSection = section.dataset.cardSection;
      ui.cardIndex = 0;
      ui.cardFlipped = false;
      renderCards();
      return;
    }

    if (event.target.closest("[data-flip-card]")) {
      ui.cardFlipped = !ui.cardFlipped;
      renderCards();
      return;
    }

    const grade = event.target.closest("[data-grade]");
    if (grade) {
      gradeCard(grade.dataset.grade);
      return;
    }

    if (event.target.closest("[data-clear-card-filters]")) {
      ui.cardSection = "all";
      ui.cardsPriorityOnly = false;
      ui.cardsDueOnly = false;
      renderCards();
      return;
    }

    const partsWeapon = event.target.closest("[data-parts-weapon]");
    if (partsWeapon) {
      ui.partsWeapon = partsWeapon.dataset.partsWeapon;
      ui.partsIndex = 0;
      ui.partsFlipped = false;
      renderParts();
      return;
    }

    if (event.target.closest("[data-flip-part]")) {
      ui.partsFlipped = !ui.partsFlipped;
      renderParts();
      return;
    }

    const gradePartButton = event.target.closest("[data-grade-part]");
    if (gradePartButton) {
      gradePart(gradePartButton.dataset.gradePart);
      return;
    }

    const start = event.target.closest("[data-start-quiz]");
    if (start && !start.disabled) {
      startQuiz(start.dataset.startQuiz);
      return;
    }

    const answer = event.target.closest("[data-answer]");
    if (answer) {
      selectAnswer(Number(answer.dataset.answer));
      return;
    }

    if (event.target.closest("[data-next-question]")) {
      nextQuestion();
      return;
    }

    if (event.target.closest("[data-quit-quiz]")) {
      ui.quiz = null;
      renderQuizSetup();
      return;
    }

    if (event.target.closest("[data-restart-quiz]")) {
      ui.quiz = null;
      renderQuizSetup();
      return;
    }

    if (event.target.closest("[data-review-session-mistakes]")) {
      const previous = ui.lastQuiz;
      const list = previous.list.filter((question, index) => previous.answers[index] !== question.answer);
      ui.quiz = { mode: "mistakes", list: shuffle(list), index: 0, answers: [], selected: null, revealed: false, finished: false };
      renderQuizQuestion();
      return;
    }

    const notesSection = event.target.closest("[data-notes-section]");
    if (notesSection) {
      ui.notesSection = notesSection.dataset.notesSection;
      renderNotes();
      return;
    }

    const lesson = event.target.closest("[data-toggle-lesson]");
    if (lesson) {
      const id = lesson.dataset.toggleLesson;
      if (ui.openLessons.has(id)) ui.openLessons.delete(id);
      else ui.openLessons.add(id);
      renderNotes();
      document.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const studySection = event.target.closest("[data-study-section]");
    if (studySection) {
      ui.cardSection = studySection.dataset.studySection;
      ui.cardIndex = 0;
      ui.cardFlipped = false;
      location.hash = "cards";
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-cards-priority]")) {
      ui.cardsPriorityOnly = event.target.checked;
      ui.cardIndex = 0;
      ui.cardFlipped = false;
      renderCards();
    }
    if (event.target.matches("[data-cards-due]")) {
      ui.cardsDueOnly = event.target.checked;
      ui.cardIndex = 0;
      ui.cardFlipped = false;
      renderCards();
    }
    if (event.target.matches("[data-notes-priority]")) {
      ui.notesPriorityOnly = event.target.checked;
      renderNotes();
    }
  });

  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-notes-search]")) return;
    ui.notesSearch = event.target.value;
    renderNotes();
    const input = document.querySelector("[data-notes-search]");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea")) return;
    if (ui.route === "cards") {
      if (event.code === "Space") {
        event.preventDefault();
        ui.cardFlipped = !ui.cardFlipped;
        renderCards();
      }
      if (ui.cardFlipped && ["1", "2", "3"].includes(event.key)) {
        gradeCard({ 1: "again", 2: "hard", 3: "good" }[event.key]);
      }
    }
    if (ui.route === "parts") {
      if (event.code === "Space") {
        event.preventDefault();
        ui.partsFlipped = !ui.partsFlipped;
        renderParts();
      }
      if (ui.partsFlipped && ["1", "2", "3"].includes(event.key)) {
        gradePart({ 1: "again", 2: "hard", 3: "good" }[event.key]);
      }
    }
  });

  document.querySelector("#reset-progress").addEventListener("click", () => {
    if (!confirm("Да изчистя ли всички карти, тестове и серията ти?")) return;
    progress = { version: 1, cards: {}, questions: {}, parts: {}, studyDays: [] };
    saveProgress();
    setRoute(ui.route);
    showToast("Напредъкът е изчистен");
  });

  document.querySelector("#source-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });

  window.addEventListener("hashchange", () => setRoute(location.hash.slice(1) || "home"));

  updateHeaderProgress();
  setRoute(location.hash.slice(1) || "home");
})();
