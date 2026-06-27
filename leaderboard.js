/* ==========================================================================
   EcoAR Leaderboard Module - Manages competitor profiles and ranking updates
   ========================================================================== */



// Bangkok themed mock competitors (10 players total, including user)
const BASE_COMPETITORS = [
  { id: "comp1", username: "Somchai_GreenBKK", level: 6, score: 950, scannedCount: 19, avatar: "🌳", badge: "Lv. 6 ผู้ดูแลต้นไม้กรุงเทพฯ" },
  { id: "comp2", username: "Pim_EcoBangkok", level: 5, score: 720, scannedCount: 14, avatar: "🌿", badge: "Lv. 5 ผู้พิทักษ์รักษ์กรุงเทพฯ" },
  { id: "comp3", username: "Anan_CleanAir", level: 4, score: 580, scannedCount: 11, avatar: "🌱", badge: "Lv. 4 ผู้พิทักษ์รักษ์กรุงเทพฯ" },
  { id: "comp4", username: "Kanya_GreenScout", level: 3, score: 410, scannedCount: 8, avatar: "🌿", badge: "Lv. 3 ลูกเสือเขียวกรุงเทพฯ" },
  { id: "comp5", username: "Veera_Recycle", level: 2, score: 290, scannedCount: 6, avatar: "🌱", badge: "Lv. 2 ลูกเสือเขียวกรุงเทพฯ" },
  { id: "comp6", username: "Somsak_SaveWater", level: 2, score: 240, scannedCount: 5, avatar: "🌱", badge: "Lv. 2 ลูกเสือเขียวกรุงเทพฯ" },
  { id: "comp7", username: "Nattaporn_Eco", level: 1, score: 130, scannedCount: 3, avatar: "🌱", badge: "Lv. 1 พลเมืองสะอาดกรุงเทพฯ" },
  { id: "comp8", username: "Chai_CleanUp", level: 1, score: 80, scannedCount: 2, avatar: "🌱", badge: "Lv. 1 พลเมืองสะอาดกรุงเทพฯ" },
  { id: "comp9", username: "BKK_EcoBeginner", level: 1, score: 50, scannedCount: 1, avatar: "🌱", badge: "Lv. 1 พลเมืองสะอาดกรุงเทพฯ" }
];

let competitors = [];
let updateInterval = null;

/**
 * Initializes the leaderboard: loads competitors from safeLocalStorage or defaults,
 * and starts the active competition simulator.
 */
function initLeaderboard() {
  const saved = safeLocalStorage.getItem("eco_ar_competitors");
  if (saved) {
    try {
      competitors = JSON.parse(saved);
    } catch (e) {
      competitors = [...BASE_COMPETITORS];
    }
  } else {
    competitors = [...BASE_COMPETITORS];
    saveCompetitors();
  }

  renderLeaderboard();

  // Start background competition updater (simulates other users scanning trash)
  startCompetitionSim();
}

/**
 * Persists competitors list
 */
function saveCompetitors() {
  safeLocalStorage.setItem("eco_ar_competitors", JSON.stringify(competitors));
}

/**
 * Integrates current user stats, sorts descending, and updates DOM.
 */
function renderLeaderboard() {
  const container = document.getElementById("leaderboard-container");
  if (!container) return;

  const userRow = {
    id: "user",
    username: appState.username + " (คุณ)",
    level: appState.level,
    score: appState.score,
    scannedCount: appState.scannedCount,
    avatar: appState.level < 3 ? "🌱" : appState.level < 6 ? "🌿" : appState.level < 10 ? "🌳" : "👑",
    badge: appState.badge
  };

  // Merge, sort by total score, and slice to top 10 rows
  const allPlayers = [userRow, ...competitors]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  container.innerHTML = "";

  allPlayers.forEach((player, index) => {
    const rank = index + 1;
    const isUser = player.id === "user";
    
    // Create list item
    const rowEl = document.createElement("div");
    rowEl.className = `leader-row rank-${rank} ${isUser ? 'user-row' : ''}`;
    
    rowEl.innerHTML = `
      <div class="leader-left">
        <div class="rank-badge">#${rank}</div>
        <div class="leader-profile-pic">${player.avatar}</div>
        <div class="leader-name-box">
          <span class="leader-name">${player.username}</span>
          <span class="leader-title">${player.badge}</span>
        </div>
      </div>
      <div class="leader-right">
        <span class="leader-xp">${player.score} XP</span>
        <span class="leader-scans">${player.scannedCount} ชิ้น</span>
      </div>
    `;

    container.appendChild(rowEl);
  });
}

/**
 * Call this when user stats change to update the board immediately.
 */
function updateUserOnLeaderboard() {
  renderLeaderboard();
}

/**
 * Periodically increments mock competitor scores to simulate an active app.
 */
function startCompetitionSim() {
  if (updateInterval) clearInterval(updateInterval);

  updateInterval = setInterval(() => {
    // Pick a random competitor
    const randomIndex = Math.floor(Math.random() * competitors.length);
    const competitor = competitors[randomIndex];
    
    // Add XP/Scans
    competitor.score += 50;
    competitor.scannedCount += 1;

    // Check competitor level up
    let nextXP = competitor.level * 100 + 50;
    if (competitor.score >= nextXP) {
      competitor.level++;
      
      // Update BMA environmental badges titles
      const titles = ["พลเมืองสะอาดกรุงเทพฯ", "ลูกเสือเขียวกรุงเทพฯ", "ผู้พิทักษ์รักษ์กรุงเทพฯ", "ผู้ดูแลต้นไม้กรุงเทพฯ", "ผู้ป้องกันโลกกรุงเทพฯ"];
      const titleIndex = Math.min(titles.length - 1, Math.floor(competitor.level / 2.5));
      competitor.badge = `Lv. ${competitor.level} ${titles[titleIndex]}`;
      
      // Update avatar icons
      if (competitor.level >= 8) competitor.avatar = "👑";
      else if (competitor.level >= 5) competitor.avatar = "🌳";
      else if (competitor.level >= 3) competitor.avatar = "🌿";
    }

    saveCompetitors();
    renderLeaderboard();
  }, 12000);
}
