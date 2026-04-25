const state = {
  currentMode: "flashcards",
  flashcards: [...SSAT_WORDS],
  cardIndex: 0,
  mastered: new Set(JSON.parse(localStorage.getItem("ssat-mastered") || "[]")),
  bestScore: Number(localStorage.getItem("ssat-best-score") || 0),
  quiz: { asked: 0, correct: 0, current: null, answered: false },
  analogies: shuffle([...ANALOGIES]),
  analogyIndex: 0,
  match: { board: [], selected: [], matched: 0, locked: false },
  speed: { timer: 30, score: 0, current: null, intervalId: null, active: false },
};

const elements = {
  modeCards: document.querySelectorAll(".mode-card"),
  panels: document.querySelectorAll(".study-panel"),
  jumpButtons: document.querySelectorAll("[data-jump]"),
  wordCount: document.getElementById("word-count"),
  masteredCount: document.getElementById("mastered-count"),
  bestScore: document.getElementById("best-score"),
  flashcard: document.getElementById("flashcard"),
  cardWord: document.getElementById("card-word"),
  cardPart: document.getElementById("card-part"),
  cardDefinition: document.getElementById("card-definition"),
  cardExample: document.getElementById("card-example"),
  cardStatus: document.getElementById("card-status"),
  flashcardSearch: document.getElementById("flashcard-search"),
  quizWord: document.getElementById("quiz-word"),
  quizOptions: document.getElementById("quiz-options"),
  quizFeedback: document.getElementById("quiz-feedback"),
  quizProgress: document.getElementById("quiz-progress"),
  quizScore: document.getElementById("quiz-score"),
  analogyStem: document.getElementById("analogy-stem"),
  analogyOptions: document.getElementById("analogy-options"),
  analogyFeedback: document.getElementById("analogy-feedback"),
  analogyExplanation: document.getElementById("analogy-explanation"),
  analogyProgress: document.getElementById("analogy-progress"),
  matchGrid: document.getElementById("match-grid"),
  matchFeedback: document.getElementById("match-feedback"),
  speedTimer: document.getElementById("speed-timer"),
  speedWord: document.getElementById("speed-word"),
  speedOptions: document.getElementById("speed-options"),
  speedFeedback: document.getElementById("speed-feedback"),
  speedScore: document.getElementById("speed-score"),
  wordbankSearch: document.getElementById("wordbank-search"),
  wordbankList: document.getElementById("wordbank-list"),
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sampleWords(excludedWord, count) {
  return shuffle(SSAT_WORDS.filter((entry) => entry.word !== excludedWord)).slice(0, count);
}

function setMode(mode) {
  state.currentMode = mode;
  elements.modeCards.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.id === mode));
}

function updateMetrics() {
  elements.wordCount.textContent = String(SSAT_WORDS.length);
  elements.masteredCount.textContent = String(state.mastered.size);
  elements.bestScore.textContent = `${state.bestScore}%`;
}

function saveProgress() {
  localStorage.setItem("ssat-mastered", JSON.stringify([...state.mastered]));
  localStorage.setItem("ssat-best-score", String(state.bestScore));
  updateMetrics();
}

function renderFlashcard() {
  if (!state.flashcards.length) {
    elements.cardWord.textContent = "No matches";
    elements.cardPart.textContent = "";
    elements.cardDefinition.textContent = "Try a different search to pull words back into the deck.";
    elements.cardExample.textContent = "";
    elements.cardStatus.textContent = "";
    return;
  }

  const card = state.flashcards[state.cardIndex];
  elements.flashcard.classList.remove("flipped");
  elements.cardWord.textContent = card.word;
  elements.cardPart.textContent = card.part;
  elements.cardDefinition.textContent = card.definition;
  elements.cardExample.textContent = card.example;
  elements.cardStatus.textContent = state.mastered.has(card.word)
    ? "Mastered"
    : `Card ${state.cardIndex + 1} of ${state.flashcards.length}`;
}

function updateFlashcardSearch() {
  const query = elements.flashcardSearch.value.trim().toLowerCase();
  state.flashcards = SSAT_WORDS.filter((entry) => {
    if (!query) {
      return true;
    }
    return entry.word.toLowerCase().includes(query) || entry.definition.toLowerCase().includes(query);
  });
  state.cardIndex = 0;
  renderFlashcard();
}

function nextCard(step) {
  if (!state.flashcards.length) {
    return;
  }
  state.cardIndex = (state.cardIndex + step + state.flashcards.length) % state.flashcards.length;
  renderFlashcard();
}

function toggleMastered() {
  const current = state.flashcards[state.cardIndex];
  if (!current) {
    return;
  }
  if (state.mastered.has(current.word)) {
    state.mastered.delete(current.word);
  } else {
    state.mastered.add(current.word);
  }
  saveProgress();
  renderFlashcard();
}

function newQuizQuestion() {
  state.quiz.answered = false;
  const correct = SSAT_WORDS[Math.floor(Math.random() * SSAT_WORDS.length)];
  const options = shuffle([
    correct.definition,
    ...sampleWords(correct.word, 3).map((entry) => entry.definition),
  ]);
  state.quiz.current = { correct, options };
  elements.quizWord.textContent = correct.word;
  elements.quizOptions.innerHTML = "";
  elements.quizFeedback.textContent = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.addEventListener("click", () => answerQuiz(button, option));
    elements.quizOptions.appendChild(button);
  });
  elements.quizProgress.textContent = `Question ${state.quiz.asked + 1}`;
  elements.quizScore.textContent = `Score ${state.quiz.correct}/${state.quiz.asked}`;
}

function answerQuiz(button, option) {
  if (state.quiz.answered || !state.quiz.current) {
    return;
  }
  state.quiz.answered = true;
  state.quiz.asked += 1;
  const isCorrect = option === state.quiz.current.correct.definition;
  if (isCorrect) {
    state.quiz.correct += 1;
    button.classList.add("correct");
    elements.quizFeedback.textContent = "Correct. Nice work.";
  } else {
    button.classList.add("wrong");
    elements.quizFeedback.textContent = `Not quite. ${state.quiz.current.correct.word} means "${state.quiz.current.correct.definition}."`;
    [...elements.quizOptions.children].forEach((choice) => {
      if (choice.textContent === state.quiz.current.correct.definition) {
        choice.classList.add("correct");
      }
    });
  }
  const percent = Math.round((state.quiz.correct / state.quiz.asked) * 100);
  if (percent > state.bestScore) {
    state.bestScore = percent;
    saveProgress();
  }
  elements.quizProgress.textContent = `Question ${state.quiz.asked}`;
  elements.quizScore.textContent = `Score ${state.quiz.correct}/${state.quiz.asked}`;
}

function resetQuiz() {
  state.quiz = { asked: 0, correct: 0, current: null, answered: false };
  newQuizQuestion();
}

function renderAnalogy() {
  const item = state.analogies[state.analogyIndex % state.analogies.length];
  elements.analogyStem.textContent = item.stem;
  elements.analogyOptions.innerHTML = "";
  elements.analogyFeedback.textContent = "";
  elements.analogyExplanation.textContent = "";
  elements.analogyProgress.textContent = `Set ${state.analogyIndex + 1} of ${state.analogies.length}`;
  item.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.addEventListener("click", () => answerAnalogy(button, option, item.answer));
    elements.analogyOptions.appendChild(button);
  });
}

function answerAnalogy(button, option, answer) {
  const alreadyChosen = [...elements.analogyOptions.children].some((choice) =>
    choice.classList.contains("correct") || choice.classList.contains("wrong")
  );
  if (alreadyChosen) {
    return;
  }
  if (option === answer) {
    button.classList.add("correct");
    elements.analogyFeedback.textContent = "Correct relationship.";
  } else {
    button.classList.add("wrong");
    elements.analogyFeedback.textContent = `Better pick: ${answer}.`;
    [...elements.analogyOptions.children].forEach((choice) => {
      if (choice.textContent === answer) {
        choice.classList.add("correct");
      }
    });
  }
  elements.analogyExplanation.textContent = state.analogies[state.analogyIndex].explanation;
}

function nextAnalogy() {
  state.analogyIndex = (state.analogyIndex + 1) % state.analogies.length;
  renderAnalogy();
}

function buildMatchBoard() {
  state.match = { board: [], selected: [], matched: 0, locked: false };
  const chosen = shuffle(SSAT_WORDS).slice(0, 6);
  const cards = shuffle([
    ...chosen.map((entry) => ({ id: entry.word, pairId: entry.id, type: "word", text: entry.word })),
    ...chosen.map((entry) => ({
      id: `${entry.word}-def`,
      pairId: entry.id,
      type: "definition",
      text: entry.definition,
    })),
  ]);
  state.match.board = cards.map((card) => ({ ...card, revealed: false, matched: false }));
  elements.matchFeedback.textContent = "Match each word with its meaning.";
  renderMatchBoard();
}

function renderMatchBoard() {
  elements.matchGrid.innerHTML = "";
  state.match.board.forEach((card, index) => {
    const button = document.createElement("button");
    button.className = `match-tile${card.revealed ? " revealed" : ""}${card.matched ? " matched" : ""}`;
    button.textContent = card.revealed || card.matched ? card.text : "?";
    button.disabled = card.matched || state.match.locked;
    button.addEventListener("click", () => selectMatchCard(index));
    elements.matchGrid.appendChild(button);
  });
}

function selectMatchCard(index) {
  const card = state.match.board[index];
  if (card.revealed || card.matched || state.match.locked) {
    return;
  }
  card.revealed = true;
  state.match.selected.push(index);
  renderMatchBoard();
  if (state.match.selected.length < 2) {
    return;
  }
  const [firstIndex, secondIndex] = state.match.selected;
  const first = state.match.board[firstIndex];
  const second = state.match.board[secondIndex];
  if (first.pairId === second.pairId && first.type !== second.type) {
    first.matched = true;
    second.matched = true;
    state.match.selected = [];
    state.match.matched += 1;
    elements.matchFeedback.textContent = state.match.matched === 6 ? "Board cleared. Strong memory run." : "Match found.";
    renderMatchBoard();
    return;
  }
  state.match.locked = true;
  elements.matchFeedback.textContent = "No match. Try again.";
  window.setTimeout(() => {
    first.revealed = false;
    second.revealed = false;
    state.match.selected = [];
    state.match.locked = false;
    renderMatchBoard();
  }, 750);
}

function setSpeedTimerVisual() {
  const degrees = (state.speed.timer / 30) * 360;
  document.querySelector(".timer-ring").style.background =
    `radial-gradient(circle at center, rgba(255, 255, 255, 0.96) 0 52%, transparent 53%), conic-gradient(var(--primary) 0deg, var(--gold) ${degrees}deg, rgba(28, 36, 48, 0.1) ${degrees}deg)`;
}

function newSpeedQuestion() {
  const correct = SSAT_WORDS[Math.floor(Math.random() * SSAT_WORDS.length)];
  const options = shuffle([
    correct.definition,
    ...sampleWords(correct.word, 3).map((entry) => entry.definition),
  ]);
  state.speed.current = { correct, options };
  elements.speedWord.textContent = correct.word;
  elements.speedOptions.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.addEventListener("click", () => answerSpeed(button, option));
    elements.speedOptions.appendChild(button);
  });
}

function answerSpeed(button, option) {
  if (!state.speed.active || !state.speed.current) {
    return;
  }
  if (option === state.speed.current.correct.definition) {
    state.speed.score += 1;
    elements.speedFeedback.textContent = "Correct. Keep going.";
    button.classList.add("correct");
    elements.speedScore.textContent = String(state.speed.score);
    window.setTimeout(newSpeedQuestion, 180);
  } else {
    button.classList.add("wrong");
    elements.speedFeedback.textContent = `Quick reset: ${state.speed.current.correct.definition}.`;
    [...elements.speedOptions.children].forEach((choice) => {
      if (choice.textContent === state.speed.current.correct.definition) {
        choice.classList.add("correct");
      }
    });
  }
}

function startSpeedRound() {
  window.clearInterval(state.speed.intervalId);
  state.speed = { timer: 30, score: 0, current: null, intervalId: null, active: true };
  elements.speedTimer.textContent = "30";
  elements.speedScore.textContent = "0";
  elements.speedFeedback.textContent = "Go.";
  setSpeedTimerVisual();
  newSpeedQuestion();
  state.speed.intervalId = window.setInterval(() => {
    state.speed.timer -= 1;
    elements.speedTimer.textContent = String(state.speed.timer);
    setSpeedTimerVisual();
    if (state.speed.timer <= 0) {
      window.clearInterval(state.speed.intervalId);
      state.speed.active = false;
      elements.speedFeedback.textContent = `Time. You scored ${state.speed.score} in 30 seconds.`;
    }
  }, 1000);
}

function renderWordBank() {
  const query = elements.wordbankSearch.value.trim().toLowerCase();
  const words = SSAT_WORDS.filter((entry) => {
    if (!query) {
      return true;
    }
    return entry.word.toLowerCase().includes(query) || entry.definition.toLowerCase().includes(query);
  });
  elements.wordbankList.innerHTML = "";
  words.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "word-item";
    article.innerHTML = `
      <h3>${entry.word}</h3>
      <p><strong>${entry.part}</strong> - ${entry.definition}</p>
    `;
    elements.wordbankList.appendChild(article);
  });
}

document.getElementById("flip-card").addEventListener("click", () => elements.flashcard.classList.toggle("flipped"));
elements.flashcard.addEventListener("click", () => elements.flashcard.classList.toggle("flipped"));
document.getElementById("prev-card").addEventListener("click", () => nextCard(-1));
document.getElementById("next-card").addEventListener("click", () => nextCard(1));
document.getElementById("shuffle-cards").addEventListener("click", () => {
  state.flashcards = shuffle(state.flashcards);
  state.cardIndex = 0;
  renderFlashcard();
});
document.getElementById("mark-mastered").addEventListener("click", toggleMastered);
elements.flashcardSearch.addEventListener("input", updateFlashcardSearch);
document.getElementById("next-question").addEventListener("click", newQuizQuestion);
document.getElementById("reset-quiz").addEventListener("click", resetQuiz);
document.getElementById("next-analogy").addEventListener("click", nextAnalogy);
document.getElementById("reset-match").addEventListener("click", buildMatchBoard);
document.getElementById("start-speed").addEventListener("click", startSpeedRound);
elements.wordbankSearch.addEventListener("input", renderWordBank);

elements.modeCards.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

elements.jumpButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.jump));
});

updateMetrics();
renderFlashcard();
resetQuiz();
renderAnalogy();
buildMatchBoard();
startSpeedRound();
renderWordBank();
