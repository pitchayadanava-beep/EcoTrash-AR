/* ==========================================================================
   EcoAR Game Module - Canvas-based interactive educational sorting game
   ========================================================================== */



// Game variables
let canvas, ctx;
let btnStart, btnRestart, startOverlay, gameOverOverlay;
let gameActive = false;
let score = 0;
let timeRemaining = 60;
let timerInterval = null;
let combo = 1;
let comboCount = 0;
let itemsSorted = 0;
let itemsCorrect = 0;

// Game entities
let fallingTrash = [];
let bins = [];
let nextSpawnTime = 0;
let activeDragItem = null;
let hoveredBin = null; // Track mouse hover on canvas bins

// Cartoon scenery elements
let clouds = [
  { x: 40, y: 60, speed: 0.15, r: 25 },
  { x: 200, y: 30, speed: 0.10, r: 35 },
  { x: 380, y: 70, speed: 0.20, r: 20 }
];

// Mock/Visual confetti particles
let particles = [];

// Images of Bins loaded from assets
const binImages = {
  recycling: new Image(),
  organic: new Image(),
  hazardous: new Image(),
  general: new Image()
};

// Trash items database for game
const GAME_TRASH_ITEMS = [
  // Recyclables (Blue)
  { emoji: "🥤", name: "แก้วพลาสติก", type: "recycling" },
  { emoji: "🍾", name: "ขวดแก้ว", type: "recycling" },
  { emoji: "🥫", name: "กระป๋องโลหะ", type: "recycling" },
  { emoji: "📰", name: "หนังสือพิมพ์", type: "recycling" },
  { emoji: "📦", name: "กล่องกระดาษ", type: "recycling" },
  
  // Organic Compost (Green)
  { emoji: "🍌", name: "เปลือกกล้วย", type: "organic" },
  { emoji: "🍎", name: "เศษแอปเปิ้ล", type: "organic" },
  { emoji: "🍉", name: "แตงโม", type: "organic" },
  { emoji: "🥬", name: "ใบผักกาด", type: "organic" },
  { emoji: "🍞", name: "ขนมปังค้างคืน", type: "organic" },
  
  // Hazardous E-Waste (Red)
  { emoji: "🔋", name: "แบตเตอรี่", type: "hazardous" },
  { emoji: "💡", name: "หลอดไฟ", type: "hazardous" },
  { emoji: "🔌", name: "ปลั๊กไฟ", type: "hazardous" },
  { emoji: "📱", name: "โทรศัพท์เก่า", type: "hazardous" },
  { emoji: "🧪", name: "ขวดสารเคมี", type: "hazardous" },
  
  // General Waste (Gray)
  { emoji: "🍿", name: "ซองขนม", type: "general" },
  { emoji: "🛍️", name: "ถุงพลาสติก", type: "general" },
  { emoji: "🧻", name: "กระดาษชำระใช้แล้ว", type: "general" },
  { emoji: "🚭", name: "ก้นบุหรี่", type: "general" },
  { emoji: "🩹", name: "พลาสเตอร์ยาใช้แล้ว", type: "general" }
];

/**
 * Initializes the game canvas, DOM triggers, and image assets.
 */
function initGame() {
  canvas = document.getElementById("game-canvas");
  if (canvas) ctx = canvas.getContext("2d");
  
  btnStart = document.getElementById("btn-start-game");
  btnRestart = document.getElementById("btn-restart-game");
  startOverlay = document.getElementById("game-start-overlay");
  gameOverOverlay = document.getElementById("game-over-overlay");

  // Load images
  binImages.recycling.src = "assets/recycling.png";
  binImages.organic.src = "assets/organic.png";
  binImages.hazardous.src = "assets/hazardous.png";
  binImages.general.src = "assets/general.png";

  // Bind button events once
  if (btnStart && !btnStart.dataset.bound) {
    btnStart.addEventListener("click", startGame);
    if (btnRestart) btnRestart.addEventListener("click", startGame);
    window.addEventListener("resize", resizeCanvas);
    btnStart.dataset.bound = true;
  }

  // Bind mouse/touch events
  bindInputEvents();

  // Setup bin positions
  setupBins();

  // Initialize Lobby, WasteCaptcha & Ocean Rescue
  initLobbyAndCaptcha();
  initOceanGame();
}

/**
 * Automatically resize canvas to fit container element
 */
function resizeCanvas() {
  if (!canvas) return;
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  setupBins();
}

/**
 * Configures the coordinates and colors for the 4 sorting bins at bottom of canvas.
 */
function setupBins() {
  if (!canvas) return;
  const w = canvas.width;
  const h = canvas.height;
  const numBins = 4;
  const binWidth = w / numBins;
  const binHeight = 95;
  const yOffset = h - binHeight - 12;

  bins = [
    { type: "recycling", color: "#38bdf8", name: "รีไซเคิล", img: binImages.recycling, x: 0 * binWidth, y: yOffset, w: binWidth, h: binHeight, glow: 0 },
    { type: "organic", color: "#4ade80", name: "ขยะอินทรีย์", img: binImages.organic, x: 1 * binWidth, y: yOffset, w: binWidth, h: binHeight, glow: 0 },
    { type: "hazardous", color: "#f87171", name: "อันตราย", img: binImages.hazardous, x: 2 * binWidth, y: yOffset, w: binWidth, h: binHeight, glow: 0 },
    { type: "general", color: "#94a3b8", name: "ทั่วไป", img: binImages.general, x: 3 * binWidth, y: yOffset, w: binWidth, h: binHeight, glow: 0 }
  ];
}

/**
 * Prepares stats and starts the animation frames and timer.
 */
function startGame() {
  gameActive = true;
  score = 0;
  timeRemaining = 60;
  combo = 1;
  comboCount = 0;
  itemsSorted = 0;
  itemsCorrect = 0;
  fallingTrash = [];
  particles = [];
  activeDragItem = null;
  hoveredBin = null;

  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");

  document.getElementById("game-score").textContent = "0000";
  document.getElementById("game-timer").textContent = "60 วิ";
  document.getElementById("game-combo").textContent = "x1";

  // Start timer loop
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeRemaining--;
    document.getElementById("game-timer").textContent = `${timeRemaining} วิ`;
    
    if (timeRemaining <= 0) {
      endGame();
    }
  }, 1000);

  resizeCanvas();
  nextSpawnTime = Date.now() + 500;
  
  // Begin animation rendering loop
  requestAnimationFrame(gameLoop);
}

/**
 * Halts active updates and triggers game results modal.
 */
function endGame() {
  gameActive = false;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;

  // Calculate stats
  const accuracy = itemsSorted > 0 ? Math.round((itemsCorrect / itemsSorted) * 100) : 0;
  const xpEarned = Math.round(score * 0.1) + (accuracy >= 80 ? 50 : 0); // Scale XP earned, add bonus for high accuracy

  // Award XP to user's global profile!
  addXP(xpEarned);

  // Update Game Over panel text fields
  document.getElementById("summary-items").textContent = itemsSorted;
  document.getElementById("summary-accuracy").textContent = `${accuracy}%`;
  document.getElementById("summary-score").textContent = score;
  document.getElementById("summary-xp").textContent = `+${xpEarned} XP`;

  // Display screen
  gameOverOverlay.classList.remove("hidden");
}

/**
 * Frame update and draw loop
 */
function gameLoop() {
  if (!gameActive) return;

  updateEntities();
  drawScene();

  requestAnimationFrame(gameLoop);
}

/**
 * Updates coordinates of trash, spawns new items, and updates animations.
 */
function updateEntities() {
  const now = Date.now();

  // Spawn new item
  if (now > nextSpawnTime) {
    spawnTrash();
    const minSpawnDelay = 800;
    const maxSpawnDelay = 1800;
    const delayProgress = (60 - timeRemaining) / 60; // 0 to 1
    const currentDelay = maxSpawnDelay - (maxSpawnDelay - minSpawnDelay) * delayProgress;
    nextSpawnTime = now + currentDelay;
  }

  // Update clouds horizontal position
  clouds.forEach(cloud => {
    cloud.x += cloud.speed;
    if (cloud.x > canvas.width + 100) {
      cloud.x = -80;
    }
  });

  // Update particles
  particles.forEach((p, idx) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // Gravity
    p.alpha -= 0.02;
    if (p.alpha <= 0) particles.splice(idx, 1);
  });

  // Update bin glow fades
  bins.forEach(bin => {
    if (bin.glow > 0) bin.glow -= 0.05;
  });

  // Update falling trash items
  fallingTrash.forEach((item, index) => {
    if (item.isDragging) return;

    item.y += item.speed;

    // Check if missed (fell off bottom of screen)
    if (item.y - item.radius > canvas.height - 115) {
      combo = 1;
      comboCount = 0;
      document.getElementById("game-combo").textContent = "x1";
      
      // Spawn floating penalty text
      spawnTextParticle(item.x, item.y - 20, "พลาด!", "#f87171");
      
      fallingTrash.splice(index, 1);
    }
  });
}

/**
 * Spawns a random trash emoji at the top of the canvas.
 */
function spawnTrash() {
  const itemDef = GAME_TRASH_ITEMS[Math.floor(Math.random() * GAME_TRASH_ITEMS.length)];
  const radius = 24;
  
  const x = radius + Math.random() * (canvas.width - radius * 2);
  const y = -radius;
  
  const minSpeed = 1.2;
  const maxSpeed = 3.2;
  const speedProgress = (60 - timeRemaining) / 60;
  const speed = minSpeed + (maxSpeed - minSpeed) * speedProgress + Math.random() * 0.5;

  fallingTrash.push({
    ...itemDef,
    x,
    y,
    radius,
    speed,
    isDragging: false,
    dragX: 0,
    dragY: 0
  });
}

/**
 * Renders all canvas visuals (cartoon background, clouds, hills, bins, trash, particles).
 */
function drawScene() {
  // 1. Sky Background (Light Sky Blue gradient)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, "#bae6fd"); // Light Sky Blue
  skyGrad.addColorStop(0.6, "#e0f2fe");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Draw Sun in top-right corner
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(canvas.width - 40, 45, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 3. Draw Cartoon Clouds
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  clouds.forEach(cloud => {
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.r * 0.7, cloud.y - cloud.r * 0.3, cloud.r * 0.8, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.r * 1.4, cloud.y, cloud.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4. Draw Far Hills (Soft Green)
  ctx.fillStyle = "#a7f3d0";
  ctx.beginPath();
  ctx.moveTo(-10, canvas.height);
  ctx.quadraticCurveTo(canvas.width * 0.25, canvas.height - 180, canvas.width * 0.6, canvas.height - 130);
  ctx.quadraticCurveTo(canvas.width * 0.85, canvas.height - 100, canvas.width + 10, canvas.height - 140);
  ctx.lineTo(canvas.width + 10, canvas.height);
  ctx.closePath();
  ctx.fill();

  // 5. Draw Near Hills (Lush Green)
  ctx.fillStyle = "#4ade80";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-10, canvas.height);
  ctx.quadraticCurveTo(canvas.width * 0.35, canvas.height - 130, canvas.width * 0.7, canvas.height - 105);
  ctx.quadraticCurveTo(canvas.width * 0.9, canvas.height - 90, canvas.width + 10, canvas.height - 110);
  ctx.lineTo(canvas.width + 10, canvas.height);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 6. Draw Bins at the bottom (Cute Rounded containers with thin outlines)
  bins.forEach(bin => {
    let drawY = bin.y;
    let drawH = bin.h;
    let imgSize = 54;
    
    if (hoveredBin === bin) {
      drawY -= 6;
      drawH += 6;
      imgSize = 60;
    }
    
    // Draw white bin container card
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bin.x + 5, drawY, bin.w - 10, drawH);
    
    // Draw soft outline
    ctx.strokeStyle = hoveredBin === bin ? "#3e6b53" : "#e2e8f0";
    ctx.lineWidth = hoveredBin === bin ? 2.5 : 1.5;
    ctx.strokeRect(bin.x + 5, drawY, bin.w - 10, drawH);

    // If hovered, color the background soft green tint
    if (hoveredBin === bin) {
      ctx.fillStyle = "rgba(178, 216, 195, 0.15)";
      ctx.fillRect(bin.x + 7, drawY + 2, bin.w - 14, drawH - 4);
    }

    // Flash correct/incorrect colors when bin glow is active
    if (bin.glow > 0) {
      const alertColor = bin.color === "#f87171" ? "rgba(248, 113, 113, 0.45)" : "rgba(178, 216, 195, 0.5)";
      ctx.fillStyle = alertColor;
      ctx.fillRect(bin.x + 7, drawY + 2, bin.w - 14, drawH - 4);
    }

    // Draw bin 3D illustration centered inside card
    if (bin.img.complete) {
      const imgX = bin.x + (bin.w - imgSize) / 2;
      const imgY = drawY + 8;
      ctx.drawImage(bin.img, imgX, imgY, imgSize, imgSize);
    }
    
    // Draw bin label
    // User Hover Rule: change text color to theme green (#3e6b53) and increase font size on hover!
    if (hoveredBin === bin) {
      ctx.fillStyle = "#3e6b53";
      ctx.font = "bold 15px 'Athiti', 'Chakra Petch', sans-serif";
    } else {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 13px 'Athiti', 'Chakra Petch', sans-serif";
    }
    ctx.textAlign = "center";
    ctx.fillText(bin.name, bin.x + bin.w / 2, bin.y + bin.h - 10);
  });

  // 7. Draw Falling Trash Items (Solid Round Badges with Thick Outlines - 100% Opaque)
  fallingTrash.forEach(item => {
    ctx.save();
    // 100% Solid White Badge Background
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = item.isDragging ? "#059669" : "#1e293b";
    ctx.lineWidth = item.isDragging ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Draw emoji centered inside sticker - 100% solid opacity
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.emoji, item.x, item.y + 1);
    
    // Draw dashed outline wrapper when actively dragging
    if (item.isDragging) {
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // 8. Draw particles & text indicators (stretching stroked outlines for readability)
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    if (p.isText) {
      ctx.font = "bold 19px 'Athiti', 'Chakra Petch', sans-serif";
      ctx.textAlign = "center";
      
      // Draw solid white stroke behind text for cleanliness
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  });
}

/**
 * Handles pointer input mappings for drag actions, swiping, and hover indicators
 */
function bindInputEvents() {
  const getCoordinates = (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const onStart = (e) => {
    if (!gameActive) return;
    const { x, y } = getCoordinates(e);

    // Pick topmost item clicked
    for (let i = fallingTrash.length - 1; i >= 0; i--) {
      const item = fallingTrash[i];
      const dist = Math.hypot(item.x - x, item.y - y);
      
      if (dist < item.radius + 15) {
        activeDragItem = item;
        item.isDragging = true;
        item.dragX = x - item.x;
        item.dragY = y - item.y;
        e.preventDefault();
        break;
      }
    }
  };

  const onMove = (e) => {
    if (!gameActive) return;
    const { x, y } = getCoordinates(e);

    if (activeDragItem) {
      activeDragItem.x = x - activeDragItem.dragX;
      activeDragItem.y = y - activeDragItem.dragY;
      
      // Keep inside bounds
      activeDragItem.x = Math.max(activeDragItem.radius, Math.min(canvas.width - activeDragItem.radius, activeDragItem.x));
      e.preventDefault();
    } else {
      // Hover detection: Check if pointing to any clickable bin
      let foundHover = null;
      for (let bin of bins) {
        if (x >= bin.x && x <= bin.x + bin.w && y >= bin.y && y <= bin.y + bin.h) {
          foundHover = bin;
          break;
        }
      }

      if (foundHover) {
        // Change cursor to pointer, trigger text color hover update
        canvas.style.cursor = 'pointer';
        hoveredBin = foundHover;
      } else {
        canvas.style.cursor = 'default';
        hoveredBin = null;
      }
    }
  };

  const onEnd = (e) => {
    if (!gameActive || !activeDragItem) return;

    const item = activeDragItem;
    item.isDragging = false;
    activeDragItem = null;

    let disposed = false;

    // Check collision with bins
    for (let bin of bins) {
      const intersectX = item.x >= bin.x && item.x <= bin.x + bin.w;
      const intersectY = item.y + item.radius >= bin.y;

      if (intersectX && intersectY) {
        disposed = true;
        itemsSorted++;
        
        // Correct Category verification
        if (item.type === bin.type) {
          itemsCorrect++;
          comboCount++;
          
          if (comboCount > 0 && comboCount % 4 === 0) {
            combo++;
            document.getElementById("game-combo").textContent = `x${combo}`;
            spawnTextParticle(item.x, bin.y - 45, "คอมโบเพิ่ม!", "#fbbf24");
          }

          const pointsEarned = 10 * combo;
          score += pointsEarned;
          document.getElementById("game-score").textContent = String(score).padStart(4, "0");

          bin.glow = 1.0;
          
          spawnBinSparkles(item.x, bin.y, bin.color);
          spawnTextParticle(item.x, bin.y - 25, `+${pointsEarned}`, "#22c55e");
        } else {
          // Wrong Bin penalty
          combo = 1;
          comboCount = 0;
          document.getElementById("game-combo").textContent = "x1";
          
          score = Math.max(0, score - 5);
          document.getElementById("game-score").textContent = String(score).padStart(4, "0");
          
          bin.glow = 1.0;
          const oldColor = bin.color;
          bin.color = "#f87171"; // Temporary override to red
          setTimeout(() => {
            const originalColors = { recycling: "#38bdf8", organic: "#4ade80", hazardous: "#f87171", general: "#94a3b8" };
            bin.color = originalColors[bin.type];
          }, 450);

          spawnTextParticle(item.x, bin.y - 25, "-5 ผิดถัง!", "#f87171");
        }

        const idx = fallingTrash.indexOf(item);
        if (idx !== -1) fallingTrash.splice(idx, 1);
        break;
      }
    }

    if (!disposed) {
      item.isDragging = false;
    }
  };

  if (canvas) {
    canvas.addEventListener("mousedown", onStart);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);

    canvas.addEventListener("touchstart", onStart, { passive: false });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }
}

/**
 * Spawns colorful sparkling dot particles on correct bin drop
 */
function spawnBinSparkles(x, y, color) {
  for (let i = 0; i < 15; i++) {
    particles.push({
      x,
      y,
      radius: 2.5 + Math.random() * 3,
      color,
      vx: -3 + Math.random() * 6,
      vy: -2.5 - Math.random() * 5,
      alpha: 1.0,
      isText: false
    });
  }
}

/**
 * Spawns animated floating cartoon text with outlines
 */
function spawnTextParticle(x, y, text, color) {
  particles.push({
    x,
    y,
    text,
    color,
    vx: -0.5 + Math.random(),
    vy: -2,
    alpha: 1.0,
    isText: true
  });
}

/* ==========================================================================
   GAME LOBBY CAROUSEL & WASTE CAPTCHA LOGIC
   ========================================================================== */

// Carousel state
let currentCarouselIndex = 1; // WasteCaptcha selected by default!
const CAROUSEL_GAMES = [
  {
    title: { th: "เกมท้าทายคัดแยกขยะ (Eco-Sort)", en: "Eco-Sort Trash Challenge" },
    desc: {
      th: "ลากหรือปัดขยะที่ตกลงมาใส่ถังขยะด้านล่างให้ถูกต้องก่อนที่จะตกลงสู่พื้น!",
      en: "Drag or swipe falling trash items into the correct colored bins before they hit the ground!"
    },
    screenId: "game-sort-screen"
  },
  {
    title: { th: "เกม WasteCaptcha", en: "WasteCaptcha Game" },
    desc: {
      th: "ภาพสัญลักษณ์ไฟจราจรที่เราคุ้นเคยจากเว็บไซต์ต่างๆ วันนี้มาในรูปแบบใหม่ เพื่อทดสอบให้คุณแยกขยะถูกประเภท",
      en: "Identify correctly classified waste types in a fun CAPTCHA grid puzzle challenge!"
    },
    screenId: "game-captcha-screen"
  },
  {
    title: { th: "เกมกู้วิกฤตขยะในมหาสมุทร (Eco-Ocean Rescue)", en: "Eco Ocean Rescue Challenge" },
    desc: {
      th: "ลากเรือกู้ภัยเก็บขยะพลาสติกในทะเล และช่วยปกป้องชีวิตสัตว์ทะเล!",
      en: "Steer your rescue boat to scoop up ocean plastic trash and protect marine sea life!"
    },
    screenId: "game-ocean-screen"
  }
];

// Captcha Game State
let captchaTargetCategory = ""; // recycling, organic, hazardous, general
let captchaGridItems = [];      // 16 items currently in the grid
let captchaSelectedIndices = new Set();
let captchaEvaluating = false;
let captchaRoundNumber = 0;
let captchaSessionScore = 0;
let captchaStats = (typeof appState !== "undefined" && appState.captchaStats) ? appState.captchaStats : { played: 0, highscore: 0, totalScore: 0 };

const CAT_INFO = {
  recycling: { thaiName: "ขยะรีไซเคิล", theme: "recycling", color: "#d97706" },
  organic: { thaiName: "ขยะอินทรีย์", theme: "organic", color: "#047857" },
  hazardous: { thaiName: "ขยะอันตราย", theme: "hazardous", color: "#b91c1c" },
  general: { thaiName: "ขยะทั่วไป", theme: "general", color: "#0284c7" }
};

// Item database
const CAPTCHA_ITEMS = [
  // RECYCLING
  { name: "Plastic Bottle", thaiName: "ขวดพลาสติก", type: "recycling", emoji: "🧴", image: "assets/captcha/plastic_bottles.jpg" },
  { name: "Soda Can", thaiName: "กระป๋องน้ำอัดลม", type: "recycling", emoji: "🥫", image: "assets/captcha/soda_can.jpg" },
  { name: "Cardboard Box", thaiName: "กล่องกระดาษ", type: "recycling", emoji: "📦", image: "assets/captcha/cardboard_box.jpg" },
  { name: "Glass Bottle", thaiName: "ขวดแก้ว", type: "recycling", emoji: "🍾", image: "assets/captcha/glass_bottles.jpg" },
  { name: "Newspapers", thaiName: "หนังสือพิมพ์", type: "recycling", emoji: "📰", image: "assets/captcha/newspapers.jpg" },
  
  // ORGANIC
  { name: "Banana Peel", thaiName: "เปลือกกล้วย", type: "organic", emoji: "🍌", image: "assets/captcha/banana_peel.jpg" },
  { name: "Eggshells", thaiName: "เปลือกไข่", type: "organic", emoji: "🥚", image: "assets/captcha/eggshells.jpg" },
  { name: "Autumn Leaves", thaiName: "ใบไม้แห้ง", type: "organic", emoji: "🍂", image: "assets/captcha/autumn_leaves.jpg" },
  { name: "Apple Core", thaiName: "เศษแอปเปิ้ล", type: "organic", emoji: "🍎", image: "assets/captcha/apple_core.jpg" },
  { name: "Rotten Fruit", thaiName: "เศษผลไม้เสีย", type: "organic", emoji: "🍊", image: "assets/captcha/rotten_fruit.jpg" },

  // HAZARDOUS
  { name: "Battery", thaiName: "แบตเตอรี่", type: "hazardous", emoji: "🔋", image: "assets/captcha/battery.jpg" },
  { name: "Lightbulb", thaiName: "หลอดไฟ", type: "hazardous", emoji: "💡", image: "assets/captcha/lightbulb.jpg" },
  { name: "Razor Blade", thaiName: "ใบมีดโกน", type: "hazardous", emoji: "🪒", image: "assets/captcha/razor_blade.jpg" },
  { name: "Chemical Spray", thaiName: "กระป๋องแก๊ส/สารเคมี", type: "hazardous", emoji: "💨", image: "assets/captcha/chemical_spray.png" },
  { name: "Old Mobile Phone", thaiName: "โทรศัพท์เก่า", type: "hazardous", emoji: "📱", image: "assets/captcha/mobile_phone.jpg" },

  // GENERAL
  { name: "Plastic Bag", thaiName: "ถุงพลาสติก", type: "general", emoji: "🛍️", image: "assets/captcha/plastic_bag.jpg" },
  { name: "Coffee Paper Cup", thaiName: "แก้วกระดาษเคลือบพลาสติก", type: "general", emoji: "🥤", image: "assets/captcha/paper_cup.jpg" },
  { name: "Snack Bag", thaiName: "ซองขนมฟอยล์", type: "general", emoji: "🍿", image: "assets/captcha/snack_bag.jpg" },
  { name: "Used Napkins", thaiName: "กระดาษชำระใช้แล้ว", type: "general", emoji: "🧻", image: "assets/captcha/toilet_paper.jpg" },
  { name: "Cotton Swabs", thaiName: "คอตตอนบัด", type: "general", emoji: "🧹", image: "assets/captcha/cotton_swabs.jpg" }
];

/**
 * Sets up event listeners for the game selection carousel and back links.
 */
function initLobbyAndCaptcha() {
  const leftArrow = document.getElementById("btn-carousel-left");
  const rightArrow = document.getElementById("btn-carousel-right");
  const dotsContainer = document.getElementById("carousel-dots-container");
  const playBtn = document.getElementById("btn-lobby-play");
  
  const sortBackBtn = document.getElementById("btn-sort-back");
  const captchaBackBtn = document.getElementById("btn-captcha-back");
  
  const captchaVerifyBtn = document.getElementById("btn-captcha-verify");
  const captchaInfoBtn = document.getElementById("btn-captcha-info");
  const captchaStatsBtn = document.getElementById("btn-captcha-stats");
  const captchaModalCloseBtn = document.getElementById("btn-captcha-modal-close");

  // Bind carousel navigation
  if (leftArrow) {
    leftArrow.onclick = () => {
      const numGames = CAROUSEL_GAMES.length;
      currentCarouselIndex = (currentCarouselIndex - 1 + numGames) % numGames;
      updateCarouselUI();
    };
  }
  if (rightArrow) {
    rightArrow.onclick = () => {
      const numGames = CAROUSEL_GAMES.length;
      currentCarouselIndex = (currentCarouselIndex + 1) % numGames;
      updateCarouselUI();
    };
  }

  // Bind dots
  if (dotsContainer) {
    dotsContainer.onclick = (e) => {
      const dot = e.target.closest(".dot");
      if (dot) {
        currentCarouselIndex = parseInt(dot.dataset.index);
        updateCarouselUI();
      }
    };
  }

  // Card click bindings directly
  const cards = document.querySelectorAll(".carousel-card");
  cards.forEach(card => {
    card.onclick = () => {
      const index = parseInt(card.dataset.index);
      if (currentCarouselIndex !== index) {
        currentCarouselIndex = index;
        updateCarouselUI();
      }
    };
  });

  // Lobby play action
  if (playBtn) {
    playBtn.onclick = () => {
      const game = CAROUSEL_GAMES[currentCarouselIndex];
      if (game.screenId === "game-sort-screen") {
        document.getElementById("game-lobby").classList.remove("active");
        document.getElementById("game-sort-screen").classList.remove("hidden");
        setTimeout(() => {
          resizeCanvas();
          startGame();
        }, 50);
      } else if (game.screenId === "game-captcha-screen") {
        document.getElementById("game-lobby").classList.remove("active");
        document.getElementById("game-captcha-screen").classList.remove("hidden");
        initCaptchaGameSession();
      } else if (game.screenId === "game-ocean-screen") {
        document.getElementById("game-lobby").classList.remove("active");
        document.getElementById("game-ocean-screen").classList.remove("hidden");
        setTimeout(() => {
          resizeOceanCanvas();
          startOceanGame();
        }, 50);
      }
    };
  }

  // Bind summary actions
  const summaryShareBtn = document.getElementById("btn-summary-share");
  const summaryReplayBtn = document.getElementById("btn-summary-replay");
  const summaryLobbyBtn = document.getElementById("btn-summary-lobby");

  if (summaryShareBtn) {
    summaryShareBtn.onclick = () => {
      let feedbackText = getFeedbackText(captchaSessionScore);
      if (navigator.share) {
        navigator.share({
          title: 'คะแนนคัดแยกขยะ WasteCaptcha',
          text: `ฉันแยกขยะได้คะแนน ${captchaSessionScore}/100! "${feedbackText}" มาร่วมปกป้องโลกกัน!`,
          url: window.location.href
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(`ฉันแยกขยะได้คะแนน ${captchaSessionScore}/100! "${feedbackText}" มาร่วมปกป้องโลกกัน!`);
        showToast("คัดลอกคะแนนลงคลิปบอร์ดแล้ว!", "success");
      }
    };
  }

  if (summaryReplayBtn) {
    summaryReplayBtn.onclick = () => {
      document.getElementById("game-captcha-summary").classList.add("hidden");
      document.getElementById("game-captcha-screen").classList.remove("hidden");
      initCaptchaGameSession();
    };
  }

  if (summaryLobbyBtn) {
    summaryLobbyBtn.onclick = () => {
      document.getElementById("game-captcha-summary").classList.add("hidden");
      document.getElementById("game-lobby").classList.add("active");
    };
  }

  // Back navigation buttons
  if (sortBackBtn) {
    sortBackBtn.onclick = () => {
      if (gameActive) endGame();
      document.getElementById("game-sort-screen").classList.add("hidden");
      document.getElementById("game-lobby").classList.add("active");
    };
  }
  if (captchaBackBtn) {
    captchaBackBtn.onclick = () => {
      document.getElementById("game-captcha-screen").classList.add("hidden");
      document.getElementById("game-lobby").classList.add("active");
    };
  }

  // CAPTCHA play controls
  if (captchaVerifyBtn) {
    captchaVerifyBtn.onclick = verifyCaptcha;
  }

  // Modal Popups (Info / Stats)
  if (captchaInfoBtn) {
    captchaInfoBtn.onclick = () => showCaptchaModal("info");
  }
  if (captchaStatsBtn) {
    captchaStatsBtn.onclick = () => showCaptchaModal("stats");
  }
  if (captchaModalCloseBtn) {
    captchaModalCloseBtn.onclick = closeCaptchaModal;
  }
  
  const modalOverlay = document.getElementById("captcha-modal");
  if (modalOverlay) {
    modalOverlay.onclick = (e) => {
      if (e.target === modalOverlay) closeCaptchaModal();
    };
  }

  // Initialize UI
  updateCarouselUI();
}

/**
 * Updates 3D CSS transforms and textual metadata of selected card.
 */
function updateCarouselUI() {
  const cards = document.querySelectorAll(".carousel-card");
  const dots = document.querySelectorAll(".carousel-dots .dot");
  
  const numGames = CAROUSEL_GAMES.length;
  // Set card states
  cards.forEach(card => {
    const idx = parseInt(card.dataset.index);
    if (idx === currentCarouselIndex) {
      card.setAttribute("data-state", "active");
    } else if (idx === (currentCarouselIndex - 1 + numGames) % numGames) {
      card.setAttribute("data-state", "prev");
    } else if (idx === (currentCarouselIndex + 1) % numGames) {
      card.setAttribute("data-state", "next");
    } else {
      card.setAttribute("data-state", "hidden");
    }
  });

  // Set dots
  dots.forEach(dot => {
    const idx = parseInt(dot.dataset.index);
    if (idx === currentCarouselIndex) {
      dot.classList.add("active");
    } else {
      dot.classList.remove("active");
    }
  });

  // Update lobby text details
  const activeGame = CAROUSEL_GAMES[currentCarouselIndex];
  if (activeGame) {
    const isEn = window.currentLang === "en";
    const titleText = typeof activeGame.title === "object" ? (isEn ? activeGame.title.en : activeGame.title.th) : activeGame.title;
    const descText = typeof activeGame.desc === "object" ? (isEn ? activeGame.desc.en : activeGame.desc.th) : activeGame.desc;

    const titleEl = document.getElementById("lobby-game-title");
    const descEl = document.getElementById("lobby-game-desc");
    if (titleEl) titleEl.textContent = titleText;
    if (descEl) descEl.textContent = descText;

    const playBtn = document.getElementById("btn-lobby-play");
    if (playBtn) {
      playBtn.textContent = isEn ? "Play Now" : "เล่นเลย";
      playBtn.style.opacity = "1";
    }
  }

  // Re-generate lucide icons inside details dynamically if needed
  if (window.lucide) window.lucide.createIcons();
}

window.addEventListener("languageChanged", () => {
  updateCarouselUI();
});

/**
 * Initializes a new 4-round WasteCaptcha game session.
 */
function initCaptchaGameSession() {
  captchaSessionScore = 0;
  captchaRoundNumber = 0;
  captchaTargetCategories = shuffleArray(["recycling", "organic", "hazardous", "general"]);
  startNewCaptchaRound();
}

/**
 * Starts a fresh WasteCaptcha round: shuffles a new target category and builds the grid.
 */
function startNewCaptchaRound() {
  captchaEvaluating = false;
  captchaSelectedIndices.clear();

  // Check if session has ended (4 rounds)
  if (captchaRoundNumber >= 4) {
    showCaptchaSummary();
    return;
  }

  // Get next target category from shuffled list
  captchaTargetCategory = captchaTargetCategories[captchaRoundNumber];
  captchaRoundNumber++; // Increment round number

  const cat = CAT_INFO[captchaTargetCategory];

  // Update Header styling
  const headerBanner = document.getElementById("captcha-header-banner");
  headerBanner.className = "captcha-header-banner";
  headerBanner.classList.add(`theme-${cat.theme}`);

  document.getElementById("captcha-target-label").textContent = cat.thaiName;
  
  // Show current session score
  document.getElementById("captcha-score-display").textContent = `${captchaSessionScore} คะแนน`;

  // Set verify button theme
  const verifyBtn = document.getElementById("btn-captcha-verify");
  verifyBtn.className = "btn btn-captcha-verify";
  verifyBtn.classList.add(`theme-${cat.theme}`);

  // Construct 16 grid items
  // 1. Correct matches (exactly 5 for max score of 100 across 4 rounds)
  const matchesCount = 5; 
  const matchingPool = CAPTCHA_ITEMS.filter(x => x.type === captchaTargetCategory);
  
  // Shuffle matching items pool and select matches
  const shuffledMatches = shuffleArray([...matchingPool]);
  const correctItems = shuffledMatches.slice(0, Math.min(matchesCount, matchingPool.length));

  // 2. Fillers (16 - correctItems)
  const nonMatchingPool = CAPTCHA_ITEMS.filter(x => x.type !== captchaTargetCategory);
  const shuffledFillers = shuffleArray([...nonMatchingPool]);
  const fillerItems = shuffledFillers.slice(0, 16 - correctItems.length);

  // Combine and shuffle grid list
  captchaGridItems = shuffleArray([...correctItems, ...fillerItems]);

  // Render Grid
  const gridBoard = document.getElementById("captcha-grid-board");
  gridBoard.innerHTML = "";
  
  captchaGridItems.forEach((item, index) => {
    const cell = document.createElement("div");
    cell.className = "captcha-cell";
    cell.dataset.index = index;

    // Image element
    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.thaiName;

    // Fallback emoji element
    const fallback = document.createElement("div");
    fallback.className = "captcha-emoji-fallback";
    fallback.innerHTML = `
      <div class="fallback-emoji">${item.emoji}</div>
      <div class="fallback-text">${item.thaiName}</div>
    `;

    cell.appendChild(fallback);
    cell.appendChild(img);

    img.onerror = () => {
      img.style.display = "none";
    };

    cell.onclick = () => {
      if (captchaEvaluating) return;
      if (captchaSelectedIndices.has(index)) {
        captchaSelectedIndices.delete(index);
        cell.classList.remove("selected");
      } else {
        captchaSelectedIndices.add(index);
        cell.classList.add("selected");
      }
    };

    gridBoard.appendChild(cell);
  });
}

/**
 * Validates player selections box-by-box:
 * - Correct selection: +5 points/XP
 * - Incorrect selection: -5 points/XP (penalty)
 * The player does not have to get everything right to submit.
 */
function verifyCaptcha() {
  if (captchaEvaluating) return;
  captchaEvaluating = true;

  const gridBoard = document.getElementById("captcha-grid-board");
  let correctSelectedCount = 0;
  let incorrectSelectedCount = 0;

  // First round of visual highlights
  captchaGridItems.forEach((item, index) => {
    const cell = gridBoard.children[index];
    const isSelected = captchaSelectedIndices.has(index);
    const isCorrectType = (item.type === captchaTargetCategory);

    if (isSelected) {
      if (isCorrectType) {
        correctSelectedCount++;
        cell.style.boxShadow = "0 0 0 4px #10b981"; // Green border
      } else {
        incorrectSelectedCount++;
        cell.style.boxShadow = "0 0 0 4px #ef4444"; // Red border
      }
      cell.style.borderRadius = "6px";
    }
  });

  // Compute net score gained/lost
  const gained = correctSelectedCount * 5;
  const penalty = incorrectSelectedCount * 5;
  const netScore = gained - penalty;

  // Accumulate session score (clamped between 0 and 100)
  captchaSessionScore = Math.max(0, Math.min(100, captchaSessionScore + netScore));

  // Apply adjustments to global state
  if (netScore > 0) {
    if (typeof window.addXP === "function") {
      window.addXP(netScore);
    } else if (typeof addXP === "function") {
      addXP(netScore);
    }
    showToast(`ยอดเยี่ยม! ได้รับ +${netScore} คะแนน (ถูก ${correctSelectedCount}, ผิด ${incorrectSelectedCount})`, "success");
    playCaptchaSuccessAnimation();
  } else if (netScore < 0) {
    // Safe points deduction limit (avoiding going below zero total points)
    const currentPoints = (window.appState && window.appState.points) || 0;
    const deduction = Math.min(Math.abs(netScore), currentPoints);
    if (deduction > 0) {
      if (typeof window.addXP === "function") {
        window.addXP(-deduction);
      } else if (typeof addXP === "function") {
        addXP(-deduction);
      }
    }
    gridBoard.classList.add("shake");
    setTimeout(() => gridBoard.classList.remove("shake"), 400);
    showToast(`หักคะแนน -${deduction} คะแนน (ถูก ${correctSelectedCount}, ผิด ${incorrectSelectedCount})`, "error");
  } else {
    showToast(`ได้ 0 คะแนน (ถูก ${correctSelectedCount}, ผิด ${incorrectSelectedCount})`, "error");
  }

  // Refresh session score
  document.getElementById("captcha-score-display").textContent = `${captchaSessionScore} คะแนน`;

  // Wait a brief period for highlights then load next round
  setTimeout(() => {
    captchaEvaluating = false;
    startNewCaptchaRound();
  }, 1500);
}

/**
 * Simple array shuffler helper
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Creates 40 absolute positioned falling color DOM pieces inside Captcha view.
 */
function playCaptchaSuccessAnimation() {
  const container = document.getElementById("game-captcha-screen");
  if (!container) return;
  const colors = ["#ff007f", "#ffdd00", "#00e5ff", "#73ff00", "#ff6c00", "#ab00ff"];
  
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div");
    p.className = "confetti-piece";
    p.style.position = "absolute";
    p.style.width = Math.random() * 8 + 6 + "px";
    p.style.height = Math.random() * 12 + 6 + "px";
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.top = "10%";
    p.style.left = Math.random() * 80 + 10 + "%";
    p.style.opacity = "0.9";
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    p.style.zIndex = "100";
    p.style.borderRadius = "2px";
    
    p.style.transition = "transform 1.5s cubic-bezier(0.1, 0.8, 0.3, 1), top 1.5s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 1.5s ease";
    container.appendChild(p);
    
    setTimeout(() => {
      p.style.top = "80%";
      p.style.transform = `translate(${(Math.random() - 0.5) * 120}px, ${(Math.random() - 0.5) * 60}px) rotate(${Math.random() * 720}deg)`;
      p.style.opacity = "0";
    }, 50);
    
    setTimeout(() => p.remove(), 1600);
  }
}

/**
 * Dynamic toast notification banner creator.
 */
function showToast(message, type = "success") {
  let toast = document.getElementById("game-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "game-toast";
    toast.style.position = "fixed";
    toast.style.top = "70px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%) translateY(-20px)";
    toast.style.padding = "10px 24px";
    toast.style.borderRadius = "30px";
    toast.style.fontSize = "1.05rem";
    toast.style.fontWeight = "bold";
    toast.style.zIndex = "1000";
    toast.style.transition = "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease";
    toast.style.opacity = "0";
    toast.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)";
    toast.style.pointerEvents = "none";
    document.body.appendChild(toast);
  }
  
  if (type === "success") {
    toast.style.background = "rgba(4, 120, 87, 0.96)";
    toast.style.color = "#ffffff";
    toast.style.border = "1px solid rgba(255,255,255,0.15)";
  } else {
    toast.style.background = "rgba(185, 28, 28, 0.96)";
    toast.style.color = "#ffffff";
    toast.style.border = "1px solid rgba(255,255,255,0.15)";
  }
  
  toast.textContent = message;
  toast.style.transform = "translateX(-50%) translateY(0)";
  toast.style.opacity = "1";
  
  setTimeout(() => {
    toast.style.transform = "translateX(-50%) translateY(-20px)";
    toast.style.opacity = "0";
  }, 2000);
}

/**
 * Controls CAPTCHA educational overlays.
 */
function showCaptchaModal(mode) {
  const modal = document.getElementById("captcha-modal");
  const title = document.getElementById("captcha-modal-title");
  const body = document.getElementById("captcha-modal-body");
  
  if (!modal || !title || !body) return;

  if (mode === "info") {
    title.textContent = "วิธีเล่นเกม WasteCaptcha";
    body.innerHTML = `
      <p style="margin-bottom: 12px;">เกมคัดแยกขยะในรูปแบบ <strong>CAPTCHA</strong> ที่ทุกคนคุ้นเคย!</p>
      <ul style="padding-left: 20px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;">
        <li>ดูหัวข้อในแถบสีด้านบนเพื่อตรวจสอบประเภทขยะที่ต้องค้นหา</li>
        <li>แตะ/คลิกเลือกรูปภาพในตาราง 4x4 ที่คิดว่าเป็นขยะประเภทนั้นๆ</li>
        <li>เมื่อเลือกครบแล้ว ให้กดปุ่ม <strong>"ยืนยัน"</strong> สีสดใสเพื่อตรวจความถูกต้อง</li>
        <li>คัดแยกได้ถูกต้องครบถ้วน รับทันที <strong>+10 XP</strong> เพื่อนำไปเลี้ยงน้องต้นไม้!</li>
      </ul>
      <p style="font-size: 0.9rem; color: #64748b;">*หากเลือกผิด ระบบจะเตือนและลบส่วนที่เลือกผิดเพื่อให้คุณลองเลือกใหม่อีกครั้ง</p>
    `;
  } else {
    title.textContent = "คู่มือแยกขยะ 4 ประเภท";
    body.innerHTML = `
      <div class="modal-info-row">
        <span class="modal-type-badge recycling">ขยะรีไซเคิล</span>
        <strong>ขยะนำกลับมาใช้ใหม่ได้:</strong>
        <div style="font-size: 0.9rem; margin-top: 2px;">ขวดน้ำพลาสติก, กระป๋องน้ำอัดลม, กล่องกระดาษลัง, ขวดแก้ว, กระดาษหนังสือพิมพ์</div>
      </div>
      <div class="modal-info-row">
        <span class="modal-type-badge organic">ขยะอินทรีย์</span>
        <strong>ขยะย่อยสลายได้ง่าย:</strong>
        <div style="font-size: 0.9rem; margin-top: 2px;">เปลือกผลไม้, เศษอาหารชำรุด, เปลือกไข่, ใบไม้แห้ง, เศษเศษผัก</div>
      </div>
      <div class="modal-info-row">
        <span class="modal-type-badge hazardous">ขยะอันตราย</span>
        <strong>ขยะมีสารพิษ/อันตราย:</strong>
        <div style="font-size: 0.9rem; margin-top: 2px;">ถ่านไฟฉาย/แบตเตอรี่, หลอดไฟเสีย, เครื่องใช้ไฟฟ้าเก่า, ขวดสารเคมี, มีดโกน/ของมีคม</div>
      </div>
      <div class="modal-info-row" style="border: none; padding: 0; margin: 0;">
        <span class="modal-type-badge general">ขยะทั่วไป</span>
        <strong>ขยะย่อยยาก/ไม่คุ้มรีไซเคิล:</strong>
        <div style="font-size: 0.9rem; margin-top: 2px;">ถุงพลาสติกใส่อาหาร, แก้วกระดาษเคลือบ, ซองขนมฟอยล์, กระดาษชำระเปื้อน, คอตตอนบัด</div>
      </div>
    `;
  }
  
  modal.classList.remove("hidden");
}

function closeCaptchaModal() {
  const modal = document.getElementById("captcha-modal");
  if (modal) modal.classList.add("hidden");
}

/**
 * Helper to map score to feedback text.
 */
function getFeedbackText(score) {
  if (score >= 0 && score <= 25) return "อาจจะยังแยกไม่ได้";
  if (score >= 26 && score <= 50) return "พอแยกได้อยู่";
  if (score >= 51 && score <= 75) return "เก่งแล้วอีกนิดนึง";
  return "ไม่มีใครเก่งเท่าแล้ว";
}

/**
 * Computes final results, updates local storage stats, and displays the summary screen.
 */
function showCaptchaSummary() {
  // Hide game screen, show summary
  document.getElementById("game-captcha-screen").classList.add("hidden");
  document.getElementById("game-captcha-summary").classList.remove("hidden");

  // Save session stats in appState and local storage
  if (typeof appState !== "undefined") {
    if (!appState.captchaStats) {
      appState.captchaStats = { played: 0, highscore: 0, totalScore: 0 };
    }
    appState.captchaStats.played += 1;
    appState.captchaStats.totalScore += captchaSessionScore;
    if (captchaSessionScore > appState.captchaStats.highscore) {
      appState.captchaStats.highscore = captchaSessionScore;
    }
    captchaStats = appState.captchaStats;
  } else {
    captchaStats.played += 1;
    captchaStats.totalScore += captchaSessionScore;
    if (captchaSessionScore > captchaStats.highscore) {
      captchaStats.highscore = captchaSessionScore;
    }
  }

  if (typeof safeLocalStorage !== "undefined") {
    safeLocalStorage.setItem("captcha_stats", JSON.stringify(captchaStats));
  }
  if (typeof syncStateImmediate === "function") {
    syncStateImmediate();
  }

  // Calculate average
  const averageScore = captchaStats.played > 0 ? (captchaStats.totalScore / captchaStats.played).toFixed(2) : "0.00";

  // Render score and feedback text
  document.getElementById("captcha-summary-score").textContent = captchaSessionScore;
  document.getElementById("captcha-summary-title").textContent = getFeedbackText(captchaSessionScore);

  // Render stats grid details
  document.getElementById("captcha-stat-played").textContent = captchaStats.played.toLocaleString();
  document.getElementById("captcha-stat-highscore").textContent = captchaStats.highscore;
  document.getElementById("captcha-stat-average").textContent = averageScore;

  // Refresh icons inside details if needed
  if (window.lucide) window.lucide.createIcons();
}

/* ==========================================================================
   ECO OCEAN RESCUE MINI-GAME ENGINE
   ========================================================================== */
let oceanCanvas, oceanCtx;
let isOceanGameActive = false;
let oceanScore = 0;
let oceanTimeRemaining = 45;
let oceanTimerInterval = null;
let oceanTrashCount = 0;
let oceanSeaLifeSaved = 0;

// Vessel (Submarine / Rescue Boat) State
let oceanPlayer = {
  x: 200,
  y: 350,
  width: 70,
  height: 50,
  emoji: "🚤",
  shieldActive: false,
  shieldTimer: 0
};

// Ocean floating entities
let oceanEntities = [];
let oceanBubbles = [];
let lastOceanSpawn = 0;

const OCEAN_TRASH_TYPES = [
  { emoji: "🧴", name: "ขวดพลาสติก", points: 10, type: "trash" },
  { emoji: "🛍️", name: "ถุงพลาสติก", points: 10, type: "trash" },
  { emoji: "⭕", name: "ห่วงพลาสติก", points: 15, type: "trash" },
  { emoji: "🕸️", name: "ตาข่ายดักจับ", points: 20, type: "trash" },
  { emoji: "🥫", name: "กระป๋องโลหะ", points: 10, type: "trash" }
];

const OCEAN_SEALIFE_TYPES = [
  { emoji: "🐢", name: "เต่าทะเล", penalty: -15, type: "sealife" },
  { emoji: "🐠", name: "ปลาการ์ตูน", penalty: -10, type: "sealife" },
  { emoji: "🐋", name: "วาฬน้ำเงิน", penalty: -20, type: "sealife" },
  { emoji: "🪼", name: "แมงกะพรุน", penalty: -10, type: "sealife" }
];

const OCEAN_BONUS_TYPES = [
  { emoji: "🫧", name: "ฟองอากาศป้องกัน", shield: true, type: "bonus" }
];

function initOceanGame() {
  oceanCanvas = document.getElementById("ocean-canvas");
  if (oceanCanvas) oceanCtx = oceanCanvas.getContext("2d");

  const btnStart = document.getElementById("btn-start-ocean-game");
  const btnRestart = document.getElementById("btn-restart-ocean-game");
  const btnBack = document.getElementById("btn-ocean-back");

  if (btnStart) btnStart.onclick = startOceanGame;
  if (btnRestart) btnRestart.onclick = startOceanGame;
  if (btnBack) {
    btnBack.onclick = () => {
      endOceanGame();
      document.getElementById("game-ocean-screen").classList.add("hidden");
      document.getElementById("game-lobby").classList.add("active");
    };
  }

  // Bind mouse and touch controls for vessel steering
  if (oceanCanvas) {
    const handleMove = (e) => {
      if (!isOceanGameActive || !oceanCanvas) return;
      const rect = oceanCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const targetX = clientX - rect.left - oceanPlayer.width / 2;
      const targetY = clientY - rect.top - oceanPlayer.height / 2;

      // Restrict vessel to canvas bounds
      oceanPlayer.x = Math.max(0, Math.min(oceanCanvas.width - oceanPlayer.width, targetX));
      oceanPlayer.y = Math.max(50, Math.min(oceanCanvas.height - oceanPlayer.height - 10, targetY));
    };

    oceanCanvas.addEventListener("mousemove", handleMove);
    oceanCanvas.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("resize", resizeOceanCanvas);
  }
}

function resizeOceanCanvas() {
  if (!oceanCanvas) return;
  const parent = oceanCanvas.parentElement;
  oceanCanvas.width = parent.clientWidth || 360;
  oceanCanvas.height = parent.clientHeight || 450;

  oceanPlayer.x = oceanCanvas.width / 2 - oceanPlayer.width / 2;
  oceanPlayer.y = oceanCanvas.height - 80;
}

function startOceanGame() {
  document.getElementById("ocean-start-overlay").classList.add("hidden");
  document.getElementById("ocean-over-overlay").classList.add("hidden");

  resizeOceanCanvas();

  isOceanGameActive = true;
  oceanScore = 0;
  oceanTimeRemaining = 45;
  oceanTrashCount = 0;
  oceanSeaLifeSaved = 0;
  oceanEntities = [];
  oceanPlayer.shieldActive = false;
  oceanPlayer.shieldTimer = 0;

  // Background bubbles
  oceanBubbles = [];
  for (let i = 0; i < 15; i++) {
    oceanBubbles.push({
      x: Math.random() * oceanCanvas.width,
      y: Math.random() * oceanCanvas.height,
      radius: Math.random() * 4 + 2,
      speed: Math.random() * 0.8 + 0.3
    });
  }

  updateOceanHUD();

  if (oceanTimerInterval) clearInterval(oceanTimerInterval);
  oceanTimerInterval = setInterval(() => {
    oceanTimeRemaining--;
    updateOceanHUD();

    if (oceanPlayer.shieldTimer > 0) {
      oceanPlayer.shieldTimer--;
      if (oceanPlayer.shieldTimer <= 0) oceanPlayer.shieldActive = false;
    }

    if (oceanTimeRemaining <= 0) {
      endOceanGame();
    }
  }, 1000);

  requestAnimationFrame(oceanGameLoop);
}

function updateOceanHUD() {
  const scoreEl = document.getElementById("ocean-score");
  const timerEl = document.getElementById("ocean-timer");
  const countEl = document.getElementById("ocean-trash-count");

  const isEn = window.currentLang === "en";
  if (scoreEl) scoreEl.textContent = oceanScore.toString().padStart(4, "0");
  if (timerEl) timerEl.textContent = `${oceanTimeRemaining} ${isEn ? "s" : "วิ"}`;
  if (countEl) countEl.textContent = oceanTrashCount.toString();
}

function oceanGameLoop(timestamp) {
  if (!isOceanGameActive || !oceanCanvas || !oceanCtx) return;

  const w = oceanCanvas.width;
  const h = oceanCanvas.height;

  // Clear canvas with underwater ambient gradient
  const grad = oceanCtx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0284c7");
  grad.addColorStop(0.5, "#0369a1");
  grad.addColorStop(1, "#0f172a");
  oceanCtx.fillStyle = grad;
  oceanCtx.fillRect(0, 0, w, h);

  // Render ambient floating sea bubbles
  oceanCtx.fillStyle = "rgba(255, 255, 255, 0.25)";
  oceanBubbles.forEach(b => {
    b.y -= b.speed;
    if (b.y < -10) b.y = h + 10;
    oceanCtx.beginPath();
    oceanCtx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    oceanCtx.fill();
  });

  // Spawn new ocean items every 0.75s
  if (timestamp - lastOceanSpawn > 750) {
    lastOceanSpawn = timestamp;
    const rand = Math.random();
    let item;
    if (rand < 0.65) {
      item = { ...OCEAN_TRASH_TYPES[Math.floor(Math.random() * OCEAN_TRASH_TYPES.length)] };
    } else if (rand < 0.90) {
      item = { ...OCEAN_SEALIFE_TYPES[Math.floor(Math.random() * OCEAN_SEALIFE_TYPES.length)] };
    } else {
      item = { ...OCEAN_BONUS_TYPES[0] };
    }

    item.x = Math.random() * (w - 40) + 20;
    item.y = -40;
    item.speed = Math.random() * 1.8 + 1.2;
    item.radius = 22;

    oceanEntities.push(item);
  }

  // Update & Draw ocean items - 100% Solid White Badges
  for (let i = oceanEntities.length - 1; i >= 0; i--) {
    const item = oceanEntities[i];
    item.y += item.speed;

    // Draw 100% Solid White Background Badge with crisp outline
    oceanCtx.save();
    oceanCtx.shadowColor = "rgba(0, 0, 0, 0.4)";
    oceanCtx.shadowBlur = 8;
    oceanCtx.shadowOffsetY = 2;
    oceanCtx.fillStyle = "#ffffff";
    oceanCtx.strokeStyle = item.type === "trash" ? "#0284c7" : (item.type === "sealife" ? "#16a34a" : "#059669");
    oceanCtx.lineWidth = 2.5;
    oceanCtx.beginPath();
    oceanCtx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    oceanCtx.fill();
    oceanCtx.stroke();
    oceanCtx.restore();

    // Draw item emoji - crisp & 100% opaque
    oceanCtx.font = "bold 30px sans-serif";
    oceanCtx.textAlign = "center";
    oceanCtx.textBaseline = "middle";
    oceanCtx.fillText(item.emoji, item.x, item.y + 1);

    // Collision detection with player vessel net
    const dx = item.x - (oceanPlayer.x + oceanPlayer.width / 2);
    const dy = item.y - (oceanPlayer.y + oceanPlayer.height / 2);
    const distance = Math.hypot(dx, dy);

    if (distance < item.radius + 28) {
      if (item.type === "trash") {
        oceanScore += item.points;
        oceanTrashCount++;
      } else if (item.type === "sealife") {
        if (!oceanPlayer.shieldActive) {
          oceanScore = Math.max(0, oceanScore + item.penalty);
        } else {
          oceanSeaLifeSaved++;
        }
      } else if (item.type === "bonus") {
        oceanPlayer.shieldActive = true;
        oceanPlayer.shieldTimer = 5; // 5 sec shield
      }

      oceanEntities.splice(i, 1);
      updateOceanHUD();
      continue;
    }

    // Remove if floated past bottom
    if (item.y > h + 50) {
      if (item.type === "sealife") oceanSeaLifeSaved++;
      oceanEntities.splice(i, 1);
    }
  }

  // Draw Player Vessel / Submarine
  oceanCtx.font = "46px sans-serif";
  oceanCtx.textAlign = "center";
  oceanCtx.textBaseline = "middle";
  const playerCenterX = oceanPlayer.x + oceanPlayer.width / 2;
  const playerCenterY = oceanPlayer.y + oceanPlayer.height / 2;

  oceanCtx.fillText(oceanPlayer.emoji, playerCenterX, playerCenterY);

  // Draw Shield Glow if active
  if (oceanPlayer.shieldActive) {
    oceanCtx.strokeStyle = "#38bdf8";
    oceanCtx.lineWidth = 3;
    oceanCtx.beginPath();
    oceanCtx.arc(playerCenterX, playerCenterY, 36, 0, Math.PI * 2);
    oceanCtx.stroke();

    oceanCtx.fillStyle = "rgba(56, 189, 248, 0.2)";
    oceanCtx.fill();
  }

  requestAnimationFrame(oceanGameLoop);
}

function endOceanGame() {
  isOceanGameActive = false;
  if (oceanTimerInterval) {
    clearInterval(oceanTimerInterval);
    oceanTimerInterval = null;
  }

  // Update summary stats & add XP
  const xpEarned = Math.floor(oceanScore / 2);
  if (typeof addXP === "function") addXP(xpEarned);

  const isEn = window.currentLang === "en";
  const trashSummary = document.getElementById("ocean-summary-trash");
  const savedSummary = document.getElementById("ocean-summary-saved");
  const scoreSummary = document.getElementById("ocean-summary-score");
  const xpSummary = document.getElementById("ocean-summary-xp");

  if (trashSummary) trashSummary.textContent = `${oceanTrashCount} ${isEn ? "items" : "ชิ้น"}`;
  if (savedSummary) savedSummary.textContent = `${oceanSeaLifeSaved} ${isEn ? "creatures" : "ตัว"}`;
  if (scoreSummary) scoreSummary.textContent = oceanScore.toString();
  if (xpSummary) xpSummary.textContent = `+${xpEarned} XP`;

  const overOverlay = document.getElementById("ocean-over-overlay");
  if (overOverlay) overOverlay.classList.remove("hidden");

  if (window.confetti) {
    window.confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#0284c7', '#38bdf8', '#39ef7d']
    });
  }
}

