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

  // 7. Draw Falling Trash Items (Cute Round Stickers with Outlines)
  fallingTrash.forEach(item => {
    // Draw outer white circle (sticker border)
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw emoji centered inside sticker
    ctx.font = "30px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.emoji, item.x, item.y + 1);
    
    // Draw dashed outline wrapper when actively dragging
    if (item.isDragging) {
      ctx.strokeStyle = "#3e6b53";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius + 6, 0, Math.PI * 2);
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
