/* ==========================================================================
   EcoAR App Entry - Handles Global State, Navigation, and Level Progression
   ========================================================================== */

window.addEventListener("error", (e) => {
  alert("พบข้อผิดพลาด JavaScript: " + e.message + " ใน " + e.filename + " บรรทัดที่ " + e.lineno);
});



// Default initial state
const defaultState = {
  username: "ผู้ตรวจการเขียว BKK " + Math.floor(100 + Math.random() * 900),
  level: 1,
  xp: 0,
  score: 0,
  scannedCount: 0,
  badge: "Lv. 1 พลเมืองสะอาดกรุงเทพฯ"
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

/**
 * Initializes the application, loading state and binding DOM event listeners.
 */
function startApp() {
  initAuth();
  loadState();
  updateUI();
  initNavigation();
  
  // Initialize lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Initialize sub-modules
  initScanner();
  initLeaderboard();
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
      const accounts = JSON.parse(safeLocalStorage.getItem("eco_accounts") || "[]");
      const profileStr = safeLocalStorage.getItem("eco_user_profile");
      if (profileStr) {
        const loggedInEmail = JSON.parse(profileStr).email;
        const userIndex = accounts.findIndex(a => a.email.toLowerCase() === loggedInEmail.toLowerCase());
        if (userIndex !== -1) {
          // Keep credentials, but update gameplay state variables
          accounts[userIndex] = {
            ...accounts[userIndex],
            username: appState.username,
            xp: appState.xp,
            level: appState.level,
            badge: appState.badge,
            score: appState.score,
            scannedCount: appState.scannedCount
          };
          safeLocalStorage.setItem("eco_accounts", JSON.stringify(accounts));
          
          // Trigger background cloud sync if cloud URL is active
          if (typeof CLOUD_SYNC_URL !== "undefined" && CLOUD_SYNC_URL && typeof saveCloudAccounts === "function") {
            saveCloudAccounts(accounts).then(() => {
              console.log("Cloud stats sync complete.");
            });
          }
        }
      }
    } catch (e) {
      console.error("Error syncing to accounts DB:", e);
    }
  }
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
  
  let nextXP = getXPForNextLevel(appState.level);
  let leveledUp = false;
  
  while (appState.xp >= nextXP) {
    appState.xp -= nextXP;
    appState.level++;
    nextXP = getXPForNextLevel(appState.level);
    leveledUp = true;
  }
  
  // Update badge title based on level
  let currentBadgeTitle = BADGES[0].title;
  for (let b of BADGES) {
    if (appState.level >= b.lv) {
      currentBadgeTitle = b.title;
    }
  }
  appState.badge = `Lv. ${appState.level} ${currentBadgeTitle}`;
  
  saveState();
  updateUI();
  updateUserOnLeaderboard();

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
