const memeImage = document.getElementById("meme-image");
const memeTitle = document.getElementById("meme-title");
const memeSubreddit = document.getElementById("meme-subreddit");
const skeleton = document.getElementById("skeleton");

const refreshBtn = document.getElementById("refresh-btn");
const refreshText = document.getElementById("refresh-text");
const refreshSpinner = document.getElementById("refresh-spinner");
const likeBtn = document.getElementById("like-btn");
const shareBtn = document.getElementById("share-btn");
const copyBtn = document.getElementById("copy-btn");
const timerToggleBtn = document.getElementById("timer-toggle-btn");

const historyBtn = document.getElementById("history-btn");
const historyModal = document.getElementById("history-modal");
const closeHistoryBtn = document.getElementById("close-history-btn");
const historyGrid = document.getElementById("history-grid");
const historyEmpty = document.getElementById("history-empty");
const toastContainer = document.getElementById("toast-container");
const countdownText = document.getElementById("countdown-text");

const themeCheckbox = document.getElementById("theme-checkbox");

const HISTORY_KEY = "memeverse_history";
const LIKES_KEY = "memeverse_likes";
const THEME_KEY = "memeverse_theme";
const MAX_HISTORY = 10;
const AUTO_REFRESH_MS = 30000;

let currentMeme = null;
let autoRefreshEnabled = true;
let countdownTimer = null;
let countdownSeconds = 30;
let isLoading = false;

const getStoredJSON = (key, fallback = []) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const saveStoredJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const initTheme = () => {
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
    themeCheckbox.checked = true;
  } else {
    themeCheckbox.checked = false;
  }
};

const toggleTheme = () => {
  const isLight = themeCheckbox.checked;
  if (isLight) {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
  localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
};

const showToast = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => toast.remove(), 2400);
};

const setLoadingState = (loading) => {
  refreshBtn.disabled = loading;
  refreshText.textContent = loading ? "Loading..." : "Refresh";
  refreshSpinner.classList.toggle("hidden", !loading);

  if (loading) {
    memeImage.classList.add("hidden");
    memeImage.classList.remove("fade-in");
    skeleton.classList.remove("hidden");
  }
};

const normalizeMeme = (meme) => ({
  meme: meme.meme,
  title: meme.title,
  subreddit: meme.subreddit,
});

const renderLikeState = () => {
  if (!currentMeme) {
    likeBtn.textContent = "♡ Like";
    return;
  }

  const likedMemes = getStoredJSON(LIKES_KEY);
  const isLiked = likedMemes.some((item) => item.meme === currentMeme.meme);
  likeBtn.textContent = isLiked ? "♥ Liked" : "♡ Like";
};

const isMemeLiked = (memeUrl) => {
  const likedMemes = getStoredJSON(LIKES_KEY);
  return likedMemes.some((item) => item.meme === memeUrl);
};

const addToHistory = (meme) => {
  const history = getStoredJSON(HISTORY_KEY);
  const deduped = history.filter((item) => item.meme !== meme.meme);
  deduped.unshift(meme);
  saveStoredJSON(HISTORY_KEY, deduped.slice(0, MAX_HISTORY));
};

const renderHistory = () => {
  const history = getStoredJSON(HISTORY_KEY);
  historyGrid.innerHTML = "";

  if (!history.length) {
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");

  history.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item text-left";
    button.setAttribute("aria-label", `Load meme: ${item.title}`);

    const thumbContainer = document.createElement("div");
    thumbContainer.style.position = "relative";

    const thumb = document.createElement("img");
    thumb.className = "history-thumb";
    thumb.src = item.meme;
    thumb.alt = item.title;
    thumb.loading = "lazy";

    thumbContainer.appendChild(thumb);

    if (isMemeLiked(item.meme)) {
      const likeIcon = document.createElement("span");
      likeIcon.className = "like-indicator";
      likeIcon.textContent = "♥";
      likeIcon.style.color = "#ef4444";
      thumbContainer.appendChild(likeIcon);
    }

    const content = document.createElement("div");
    content.className = "p-2";

    const title = document.createElement("p");
    title.className = "max-h-9 overflow-hidden text-xs font-medium";
    title.textContent = item.title;

    const subreddit = document.createElement("p");
    subreddit.className = "mt-1 text-[11px]";
    subreddit.style.color = "var(--text-secondary)";
    subreddit.textContent = `r/${item.subreddit}`;

    content.appendChild(title);
    content.appendChild(subreddit);
    button.appendChild(thumbContainer);
    button.appendChild(content);

    button.addEventListener("click", () => {
      applyMemeToUI(item, false);
      closeHistoryModal();
      showToast("Loaded meme from history");
    });

    historyGrid.appendChild(button);
  });
};

const applyMemeToUI = (meme, showLoadedToast = true) => {
  currentMeme = normalizeMeme(meme);

  memeTitle.textContent = currentMeme.title;
  memeSubreddit.textContent = currentMeme.subreddit;

  const preloadImage = new Image();
  preloadImage.onload = () => {
    memeImage.style.opacity = "0";
    memeImage.src = preloadImage.src;
    memeImage.alt = currentMeme.title;

    skeleton.classList.add("hidden");
    memeImage.classList.remove("hidden");
    
    setTimeout(() => {
      memeImage.classList.add("fade-in");
    }, 50);

    addToHistory(currentMeme);
    renderLikeState();
    renderHistory();

    if (showLoadedToast) {
      showToast("Meme loaded");
    }

    startCountdown();
  };

  preloadImage.onerror = () => {
    showToast("Failed to load image");
    if (autoRefreshEnabled) {
      setTimeout(() => loadMeme(), 2000);
    }
  };

  preloadImage.src = currentMeme.meme;
};

const startCountdown = () => {
  clearInterval(countdownTimer);
  countdownSeconds = 30;
  updateCountdownDisplay();

  countdownTimer = setInterval(() => {
    countdownSeconds--;
    updateCountdownDisplay();

    if (countdownSeconds <= 0) {
      clearInterval(countdownTimer);
      if (autoRefreshEnabled) {
        loadMeme();
      }
    }
  }, 1000);
};

const updateCountdownDisplay = () => {
  if (!autoRefreshEnabled) {
    countdownText.textContent = "Auto refresh paused";
    return;
  }
  countdownText.textContent = `Next meme in ${countdownSeconds}s`;
};

const loadMeme = async () => {
  if (isLoading) {
    return;
  }

  isLoading = true;
  setLoadingState(true);
  clearInterval(countdownTimer);

  try {
    const response = await fetch("/meme", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok || !data.meme) {
      throw new Error(data.error || "Failed to load meme");
    }

    applyMemeToUI(data);
  } catch (error) {
    showToast(error.message || "Unable to load meme");
    setTimeout(() => {
      if (autoRefreshEnabled) {
        loadMeme();
      }
    }, 3000);
  } finally {
    setLoadingState(false);
    isLoading = false;
  }
};

const toggleLike = () => {
  if (!currentMeme) {
    return;
  }

  const likedMemes = getStoredJSON(LIKES_KEY);
  const index = likedMemes.findIndex((item) => item.meme === currentMeme.meme);

  if (index >= 0) {
    likedMemes.splice(index, 1);
    showToast("Removed from liked memes");
  } else {
    likedMemes.unshift(currentMeme);
    saveStoredJSON(LIKES_KEY, likedMemes.slice(0, 100));
    showToast("Added to liked memes");
    renderLikeState();
    return;
  }

  saveStoredJSON(LIKES_KEY, likedMemes);
  renderLikeState();
};

const copyToClipboard = async (text, successMessage = "Link copied") => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast("Clipboard unavailable", "error");
  }
};

const shareMeme = async () => {
  if (!currentMeme) {
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: currentMeme.title,
        text: `From r/${currentMeme.subreddit}`,
        url: currentMeme.meme,
      });
      showToast("Meme shared");
      return;
    } catch {
      // User may cancel share dialog; continue to fallback copy.
    }
  }

  await copyToClipboard(currentMeme.meme, "Share link copied");
};

const openHistoryModal = () => {
  renderHistory();
  historyModal.classList.add("active");
  closeHistoryBtn.focus();
};

const closeHistoryModal = () => {
  historyModal.classList.remove("active");
  historyBtn.focus();
};

const toggleAutoRefresh = () => {
  autoRefreshEnabled = !autoRefreshEnabled;
  timerToggleBtn.textContent = autoRefreshEnabled ? "Auto: ON" : "Auto: OFF";
  timerToggleBtn.setAttribute("aria-pressed", String(autoRefreshEnabled));
  showToast(autoRefreshEnabled ? "Auto refresh enabled" : "Auto refresh paused");
  updateCountdownDisplay();
  
  if (!autoRefreshEnabled) {
    clearInterval(countdownTimer);
  } else if (currentMeme) {
    startCountdown();
  }
};

themeCheckbox.addEventListener("change", toggleTheme);
refreshBtn.addEventListener("click", loadMeme);
likeBtn.addEventListener("click", toggleLike);
shareBtn.addEventListener("click", shareMeme);
copyBtn.addEventListener("click", () => currentMeme && copyToClipboard(currentMeme.meme));
historyBtn.addEventListener("click", openHistoryModal);
closeHistoryBtn.addEventListener("click", closeHistoryModal);
timerToggleBtn.addEventListener("click", toggleAutoRefresh);

historyModal.addEventListener("click", (event) => {
  if (event.target === historyModal) {
    closeHistoryModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && historyModal.classList.contains("active")) {
    closeHistoryModal();
  }
});

initTheme();
renderHistory();
timerToggleBtn.setAttribute("aria-pressed", "true");
loadMeme();
