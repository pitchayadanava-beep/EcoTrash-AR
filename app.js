/* ==========================================================================
   EcoAR App Entry - Handles Global State, Navigation, and Level Progression
   ========================================================================== */

window.addEventListener("error", (e) => {
  console.error("JavaScript Error:", e.message, "at", e.filename, "line", e.lineno);
});



// Default initial state
const defaultState = {
  username: "ผู้ตรวจการเขียว BKK " + Math.floor(100 + Math.random() * 900),
  realName: "",
  isVerified: false,
  level: 1,
  xp: 0,
  score: 0,
  scannedCount: 0,
  badge: "1",
  points: 0,
  treeState: {
    waterCount: 0,
    selectedFruit: "apple"
  },
  captchaStats: {
    played: 0,
    highscore: 0,
    totalScore: 0
  },
  lastActive: Date.now()
};

// Global state container
var appState = { ...defaultState };

// Badges by level threshold (Bangkok municipal eco-ranks)
const BADGES = [
  { lv: 1, title: "พลเมืองสะอาดกรุงเทพฯ" },
  { lv: 3, title: "ลูกเสือเขียวกรุงเทพฯ" },
  { lv: 5, title: "ผู้พิทักษ์รักษ์กรุงเทพฯ" },
  { lv: 8, title: "ผู้ดูแลต้นไม้กรุงเทพฯ" },
  { lv: 12, title: "ผู้ป้องกันโลกกรุงเทพฯ" },
  { lv: 20, title: "ผู้ชนะสิ่งแวดล้อมกรุงเทพฯ" }
];

function startApp() {
  if (typeof initAuth === "function") initAuth();
  loadState();
  updateUI();
  initNavigation();
  initLanguageSwitcher();
  
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Initialize sub-modules
  if (typeof initScanner === "function") initScanner();
  if (typeof initTree === "function") initTree();
  
  // Bind focus event for real-time synchronization catch-up
  window.addEventListener("focus", () => {
    if (typeof syncLocalAndCloudAccounts === "function") {
      syncLocalAndCloudAccounts().then(() => {
        loadState();
        updateUI();
        if (typeof renderTree === "function" && document.getElementById("view-tree") && document.getElementById("view-tree").classList.contains("active")) {
          renderTree();
        }
      });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

/**
 * Loads the user profile state from safeLocalStorage.
 */
function loadState() {
  const saved = safeLocalStorage.getItem("eco_ar_user_stats");
  if (saved) {
    try {
      appState = { ...defaultState, ...JSON.parse(saved) };
      // Backward compatibility for legacy accounts
      if (appState.points === undefined) {
        appState.points = appState.score;
      }
      if (appState.treeState === undefined) {
        appState.treeState = { ...defaultState.treeState };
      }
      if (appState.captchaStats === undefined) {
        appState.captchaStats = { ...defaultState.captchaStats };
      }
    } catch (e) {
      console.error("Error reading saved stats:", e);
      appState = { ...defaultState };
    }
  } else {
    saveState();
  }
}

/**
 * Saves current user state to safeLocalStorage and syncs back to accounts database.
 */
function saveState() {
  safeLocalStorage.setItem("eco_ar_user_stats", JSON.stringify(appState));
  
  // Sync to accounts DB if logged in
  if (safeLocalStorage.getItem("eco_user_logged_in") === "true") {
    try {
      const profileStr = safeLocalStorage.getItem("eco_user_profile");
      if (profileStr) {
        const loggedInUser = JSON.parse(profileStr);
        // Keep credentials, but update gameplay state variables
        const updatedUser = {
          ...loggedInUser,
          username: appState.username,
          xp: appState.xp,
          level: appState.level,
          badge: appState.badge,
          score: appState.score,
          scannedCount: appState.scannedCount,
          points: appState.points,
          treeState: appState.treeState,
          captchaStats: appState.captchaStats,
          last_active: Date.now()
        };
        safeLocalStorage.setItem("eco_user_profile", JSON.stringify(updatedUser));
        
        // Also update eco_registered_users array for offline / GitHub Pages support
        let accountsList = [];
        try { accountsList = JSON.parse(safeLocalStorage.getItem("eco_registered_users") || "[]"); } catch (e) {}
        const idx = accountsList.findIndex(a => 
          (a.email && loggedInUser.email && a.email.toLowerCase() === loggedInUser.email.toLowerCase()) || 
          (a.username && a.username.toLowerCase() === (appState.username || "").toLowerCase())
        );
        if (idx !== -1) {
          accountsList[idx] = { ...accountsList[idx], ...updatedUser };
        } else {
          accountsList.push(updatedUser);
        }
        safeLocalStorage.setItem("eco_registered_users", JSON.stringify(accountsList));

        // Push local updates to backend without pulling and reverting
        if (typeof pushLocalStatsToServer === "function") {
          pushLocalStatsToServer();
        }
      }
    } catch (e) {
      console.error("Error syncing to accounts DB:", e);
    }
  }
}

/**
 * Pushes local state to cloud server / backend without overwriting local state
 */
async function pushLocalStatsToServer() {
  try {
    const profileStr = safeLocalStorage.getItem("eco_user_profile");
    if (!profileStr) return;
    const user = JSON.parse(profileStr);
    const email = user.email;
    if (!email) return;

    const syncPayload = {
      email: email,
      username: appState.username,
      real_name: appState.realName || user.real_name || "",
      is_verified: user.is_verified !== undefined ? user.is_verified : 1,
      level: appState.level,
      xp: appState.xp,
      score: appState.score,
      scannedCount: appState.scannedCount,
      points: appState.points !== undefined ? appState.points : (appState.score || 0),
      treeState: appState.treeState || { waterCount: 0, selectedFruit: "apple" },
      captchaStats: appState.captchaStats || { played: 0, highscore: 0, totalScore: 0 },
      badge: appState.badge
    };

    if (typeof CLOUD_SYNC_URL !== "undefined") {
      fetch(`${CLOUD_SYNC_URL}/profile/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncPayload)
      }).catch(() => {});
    }
  } catch (e) {}
}

/**
 * Calculates XP required to advance to the next level.
 */
function getXPForNextLevel(level) {
  return level * 100 + 50; // Level 1: 150XP, Level 2: 250XP, etc.
}

/**
 * Increments the user's XP and handles level-ups.
 */
function addXP(amount) {
  appState.xp += amount;
  appState.score += amount; // Score corresponds to total XP accumulated
  appState.points = (appState.points || 0) + amount; // Spendable points
  
  let nextXP = getXPForNextLevel(appState.level);
  let leveledUp = false;
  
  while (appState.xp >= nextXP) {
    appState.xp -= nextXP;
    appState.level++;
    nextXP = getXPForNextLevel(appState.level);
    leveledUp = true;
  }
  
  appState.badge = String(appState.level);
  
  syncStateImmediate();
  updateUI();

  if (leveledUp) {
    triggerLevelUpCelebration();
  }
}

/**
 * Refreshes all elements in the header stats display.
 */
function updateUI() {
  document.getElementById("nav-username").textContent = appState.username;
  document.getElementById("nav-badge").textContent = appState.badge;
  document.getElementById("current-xp").textContent = appState.xp;
  
  const nextXP = getXPForNextLevel(appState.level);
  document.getElementById("next-level-xp").textContent = nextXP;
  
  const fillPercent = Math.min(100, (appState.xp / nextXP) * 100);
  document.getElementById("xp-fill").style.width = `${fillPercent}%`;
  
  // Change emoji avatar based on level progression
  const avatarEl = document.getElementById("user-avatar");
  if (appState.level < 3) avatarEl.textContent = "🌱";
  else if (appState.level < 6) avatarEl.textContent = "🌿";
  else if (appState.level < 10) avatarEl.textContent = "🌳";
  else avatarEl.textContent = "👑";

  const ptsValEl = document.getElementById("nav-points-val");
  if (ptsValEl) {
    ptsValEl.textContent = appState.points || 0;
  }
}

/**
 * Binds click events for the tab navigation bar.
 */
function initNavigation() {
  const tabs = document.querySelectorAll(".tab-btn");
  const views = document.querySelectorAll(".tab-view");

  if (tabs && views) {
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      tab.addEventListener("click", () => {
        const targetView = tab.getAttribute("data-tab");
        
        // Update tab buttons using a standard for loop
        for (let j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove("active");
        }
        tab.classList.add("active");
        
        // Update active view panels using a standard for loop
        for (let k = 0; k < views.length; k++) {
          const v = views[k];
          if (v.id === `view-${targetView}`) {
            v.classList.add("active");
          } else {
            v.classList.remove("active");
          }
        }

        // Special Tab-Switch actions
        if (targetView !== "scanner") {
          // Switch camera off when leaving scanner tab to optimize performance
          stopWebcam();
        }
        
        if (targetView === "game") {
          // Initialize/resize the game canvas
          initGame();
          setTimeout(resizeCanvas, 50); // Small buffer for rendering engine
        }

        if (targetView === "tree") {
          if (typeof renderTree === "function") {
            renderTree();
          }
        }
      });
    }
  }
}

/**
 * Fires full screen confetti on level up.
 */
function triggerLevelUpCelebration() {
  // Sound effect or voice notification could go here
  if (window.confetti) {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      window.confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#39ef7d', '#11998e', '#a8e6cf']
      });
      window.confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#39ef7d', '#11998e', '#a8e6cf']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }
}

/**
 * Performs an immediate cloud database save and sync, updating active timestamps.
 */
async function syncStateImmediate() {
  appState.lastActive = Date.now();
  saveState();
  if (typeof syncLocalAndCloudAccounts === "function") {
    await syncLocalAndCloudAccounts();
  }
}

/* ==========================================================================
   Full Internationalization & Translation Module (TH / EN Toggle)
   ========================================================================== */
const TRANSLATIONS = {
  th: {
    // Navigation
    scannerTab: "เครื่องสแกน AR",
    gameTab: "เกมคัดแยกขยะ",
    treeTab: "ต้นไม้ของฉัน",
    logoutTitle: "ออกจากระบบ",
    pointsTitle: "คะแนนสะสม / Account Points",
    defaultUsername: "ผู้ตรวจการ BKK",

    // Scanner Controls
    openCam: "เปิดกล้อง",
    closeCam: "ปิดกล้อง",
    toggleFlash: "เปิดแฟลช",
    uploadPhotoLabel: "อัปโหลด & สแกนรูปภาพของคุณ",

    // Game Lobby
    lobbyTitle: "สนุกกับเกม",
    playNowBtn: "เล่นเลย",
    wasteCaptchaTitle: "เกม WasteCaptcha",
    wasteCaptchaDesc: "ภาพสัญลักษณ์ไฟจราจรที่เราคุ้นเคยจากเว็บไซต์ต่างๆ วันนี้มาในรูปแบบใหม่ เพื่อทดสอบให้คุณแยกขยะถูกประเภท",
    sortGameTitle: "เกมท้าทายคัดแยกขยะ",
    sortGameDesc: "เกมท้าทายปัดและลากขยะลงถังสีที่ถูกต้องให้ทันก่อนตกลงพื้น",

    // Game Controls & Stats
    scoreLabel: "คะแนน",
    timeLabel: "เวลา",
    comboLabel: "คอมโบ",
    backBtn: "ย้อนกลับ",
    sortOverlayTitle: "เกมท้าทายคัดแยกขยะ",
    sortOverlayDesc: "ลากหรือปัดขยะที่ตกลงมาใส่ถังขยะด้านล่างให้ถูกต้องก่อนที่จะตกลงสู่พื้น!",
    startGameBtn: "เริ่มเล่นเกม",
    restartGameBtn: "เล่นอีกครั้ง",
    missionSuccessTitle: "ภารกิจทำความสะอาดสำเร็จ!",

    // Captcha & Summary
    captchaTargetPrefix: "เลือกทุกช่องที่เป็น",
    captchaScoreLabel: "คะแนนสะสม",
    verifyBtn: "ยืนยัน",
    shareScoreBtn: "แชร์คะแนน",
    playOtherGamesBtn: "เล่นเกมอื่นๆ",

    // Tree Garden
    treePointsLabel: "คะแนนสะสมของคุณ",
    pointsUnit: "คะแนน",
    waterTreeBtn: "รดน้ำต้นไม้ (ใช้ 50 คะแนน)",
    fruitSelectLabel: "เปลี่ยนชนิดผลไม้:",

    // Auth
    loginTitle: "เข้าสู่ระบบ / สมัครสมาชิก",
    googleLoginBtn: "เข้าสู่ระบบด้วย Google"
  },

  en: {
    // Navigation
    scannerTab: "AR Scanner",
    gameTab: "Sorting Game",
    treeTab: "My Eco Tree",
    logoutTitle: "Log Out",
    pointsTitle: "Account Points",
    defaultUsername: "BKK Inspector",

    // Scanner Controls
    openCam: "Start Camera",
    closeCam: "Stop Camera",
    toggleFlash: "Flash Light",
    uploadPhotoLabel: "Upload & Scan Your Photo",

    // Game Lobby
    lobbyTitle: "Eco Games Arcade",
    playNowBtn: "Play Now",
    wasteCaptchaTitle: "WasteCaptcha Game",
    wasteCaptchaDesc: "Test your recycling skills in a fun CAPTCHA grid puzzle challenge!",
    sortGameTitle: "Eco-Sort Trash Arcade",
    sortGameDesc: "Drag and swipe falling trash items into the correct colored bins!",

    // Game Controls & Stats
    scoreLabel: "Score",
    timeLabel: "Time",
    comboLabel: "Combo",
    backBtn: "Back",
    sortOverlayTitle: "Eco-Sort Challenge",
    sortOverlayDesc: "Drag or swipe falling items into the matching bins before they hit the ground!",
    startGameBtn: "Start Game",
    restartGameBtn: "Play Again",
    missionSuccessTitle: "Cleanup Mission Accomplished!",

    // Captcha & Summary
    captchaTargetPrefix: "Select all squares containing",
    captchaScoreLabel: "Total Score",
    verifyBtn: "Verify",
    shareScoreBtn: "Share Score",
    playOtherGamesBtn: "Play Other Games",

    // Tree Garden
    treePointsLabel: "Your Accumulated Points",
    pointsUnit: "Points",
    waterTreeBtn: "Water Tree (Use 50 Pts)",
    fruitSelectLabel: "Change Fruit Type:",

    // Auth
    loginTitle: "Sign In / Register",
    googleLoginBtn: "Sign in with Google"
  }
};

let currentLang = (typeof window.safeLocalStorage !== "undefined" && window.safeLocalStorage.getItem("eco_app_lang")) || "th";
window.currentLang = currentLang;

function initLanguageSwitcher() {
  const btnToggle = document.getElementById("btn-lang-toggle");
  const menu = document.getElementById("lang-dropdown-menu");
  const langText = document.getElementById("current-lang-text");
  const optionBtns = document.querySelectorAll(".lang-option-btn");

  if (!btnToggle || !menu) return;

  // Set initial UI label & active state
  if (langText) langText.textContent = currentLang.toUpperCase();
  optionBtns.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
  });
  applyLanguage(currentLang);

  // Toggle dropdown on button click
  btnToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  // Close dropdown when clicking anywhere outside
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && e.target !== btnToggle) {
      menu.classList.add("hidden");
    }
  });

  // Handle option selection
  optionBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const selectedLang = btn.getAttribute("data-lang");
      currentLang = selectedLang;
      window.currentLang = currentLang;

      if (typeof window.safeLocalStorage !== "undefined") {
        window.safeLocalStorage.setItem("eco_app_lang", currentLang);
      }

      if (langText) langText.textContent = currentLang.toUpperCase();
      optionBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-lang") === currentLang));

      applyLanguage(currentLang);
      menu.classList.add("hidden");
    });
  });
}

function applyLanguage(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.th;
  
  // Navigation Tabs
  const scannerTab = document.querySelector('[data-tab="scanner"] span');
  if (scannerTab) scannerTab.textContent = dict.scannerTab;

  const gameTab = document.querySelector('[data-tab="game"] span');
  if (gameTab) gameTab.textContent = dict.gameTab;

  const treeTab = document.querySelector('[data-tab="tree"] span');
  if (treeTab) treeTab.textContent = dict.treeTab;

  // Header Buttons & Tooltips
  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) logoutBtn.title = dict.logoutTitle;

  const pointsBtn = document.getElementById("btn-account-points");
  if (pointsBtn) pointsBtn.title = dict.pointsTitle;

  // Scanner UI
  const uploadLabel = document.querySelector(".upload-label span");
  if (uploadLabel) uploadLabel.textContent = dict.uploadPhotoLabel;

  const flashBtn = document.querySelector("#btn-toggle-flashlight span");
  if (flashBtn) flashBtn.textContent = dict.toggleFlash;

  // Game Lobby
  const lobbyTitle = document.querySelector(".lobby-title");
  if (lobbyTitle) lobbyTitle.textContent = dict.lobbyTitle;

  const btnLobbyPlay = document.getElementById("btn-lobby-play");
  if (btnLobbyPlay) btnLobbyPlay.textContent = dict.playNowBtn;

  // Game Overlays & Stats
  const sortOverlayTitle = document.querySelector("#game-start-overlay h2");
  if (sortOverlayTitle) sortOverlayTitle.textContent = dict.sortOverlayTitle;

  const sortOverlayDesc = document.querySelector("#game-start-overlay p");
  if (sortOverlayDesc) sortOverlayDesc.textContent = dict.sortOverlayDesc;

  const btnStartGame = document.getElementById("btn-start-game");
  if (btnStartGame) btnStartGame.textContent = dict.startGameBtn;

  const btnRestartGame = document.getElementById("btn-restart-game");
  if (btnRestartGame) btnRestartGame.textContent = dict.restartGameBtn;

  const statLabels = document.querySelectorAll(".game-stat .stat-label");
  if (statLabels.length >= 3) {
    statLabels[0].textContent = dict.scoreLabel;
    statLabels[1].textContent = dict.timeLabel;
    statLabels[2].textContent = dict.comboLabel;
  }

  // Tree Garden UI
  const treePointsLabel = document.querySelector(".points-label");
  if (treePointsLabel) treePointsLabel.textContent = dict.treePointsLabel;

  const treePointsUnit = document.querySelector(".points-unit");
  if (treePointsUnit) treePointsUnit.textContent = dict.pointsUnit;

  const waterTreeBtn = document.querySelector("#btn-water-tree span");
  if (waterTreeBtn) waterTreeBtn.textContent = dict.waterTreeBtn;

  const fruitLabel = document.querySelector(".fruit-label");
  if (fruitLabel) fruitLabel.textContent = dict.fruitSelectLabel;

  // Dispatch custom languageChanged event for sub-modules (tree.js, scanner.js)
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: { lang } }));
}
