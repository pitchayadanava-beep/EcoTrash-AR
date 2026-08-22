/**
 * ==========================================================================
 * EcoTree Module - Handles dynamic tree growing, styling, and sky cycles
 * ==========================================================================
 */

// Cache DOM elements
let treePointsDisplay;
let treeStageBadge;
let waterCountDisplay;
let growthProgressFill;
let growthInstructionText;
let btnWaterTree;
let fruitSelectorContainer;
let fruitSelect;
let treeSvg;
let skyBg;
let celestialBody;
let starsLayer;
let wateringCanOverlay;
let wateringCanIcon;
let dropletsContainer;

/**
 * Initializes the tree tab components and events.
 */
function initTree() {
  treePointsDisplay = document.getElementById("tree-points-display");
  treeStageBadge = document.getElementById("tree-stage-badge");
  waterCountDisplay = document.getElementById("water-count-display");
  growthProgressFill = document.getElementById("growth-progress-fill");
  growthInstructionText = document.getElementById("growth-instruction-text");
  btnWaterTree = document.getElementById("btn-water-tree");
  fruitSelectorContainer = document.getElementById("fruit-selector-container");
  fruitSelect = document.getElementById("fruit-select");
  treeSvg = document.getElementById("tree-svg");
  skyBg = document.getElementById("sky-bg");
  celestialBody = document.getElementById("celestial-body");
  starsLayer = document.getElementById("stars-layer");
  wateringCanOverlay = document.getElementById("watering-can-overlay");
  wateringCanIcon = document.getElementById("watering-can-icon");
  dropletsContainer = document.getElementById("droplets-container");

  // Bind event listeners
  if (btnWaterTree) {
    btnWaterTree.addEventListener("click", waterTree);
  }

  if (fruitSelect) {
    fruitSelect.addEventListener("change", (e) => {
      if (appState.treeState) {
        appState.treeState.selectedFruit = e.target.value;
        saveState();
        renderTree();
      }
    });
  }

  // Initial draw
  updateSkyBackground();
  renderTree();
}

/**
 * Checks the local system time and matches the sky background, Sun, Moon, and stars.
 */
function updateSkyBackground() {
  if (!skyBg || !celestialBody || !starsLayer) return;

  const currentHour = new Date().getHours();
  const isDaytime = currentHour >= 6 && currentHour < 18; // Day is 6:00 AM to 5:59 PM

  if (isDaytime) {
    // Set Day Theme
    skyBg.className = "sky-background sky-day";
    celestialBody.className = "celestial-body sun";
    starsLayer.innerHTML = ""; // Clear stars
  } else {
    // Set Night Theme
    skyBg.className = "sky-background sky-night";
    celestialBody.className = "celestial-body moon";

    // Generate stars if empty
    if (starsLayer.children.length === 0) {
      starsLayer.innerHTML = "";
      const starCount = 35;
      for (let i = 0; i < starCount; i++) {
        const star = document.createElement("div");
        star.className = "star";
        star.style.top = `${Math.random() * 80}%`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 2.5}s`;
        starsLayer.appendChild(star);
      }
    }
  }
}

/**
 * Renders the SVG tree and updates growth state parameters on the dashboard.
 */
function renderTree() {
  if (!appState || !treeSvg) return;

  // Make sure treeState structure exists
  if (!appState.treeState) {
    appState.treeState = { waterCount: 0, selectedFruit: "apple" };
  }

  const waterCount = appState.treeState.waterCount;
  const username = appState.username || "ผู้พิทักษ์";

  // Update Points Display
  if (treePointsDisplay) {
    treePointsDisplay.textContent = (appState.points || 0).toLocaleString();
  }

  const isEn = window.currentLang === "en";

  // Update Water Count Display
  if (waterCountDisplay) {
    waterCountDisplay.textContent = isEn ? `Watered ${waterCount} times` : `รดน้ำไปแล้ว ${waterCount} ครั้ง`;
  }

  let stage = 1;
  let stageName = isEn ? "Sprout (Stage 1)" : "ต้นกล้า (Sapling)";
  let badgeColor = "var(--color-green-neon)";
  let progressPercent = 0;
  let instruction = "";

  // Compute growth properties based on waterings
  if (waterCount < 5) {
    stage = 1;
    stageName = isEn ? "Sprout (Stage 1)" : "ต้นกล้า (Sapling)";
    badgeColor = "#86efac"; // Light green
    progressPercent = (waterCount / 5) * 100;
    instruction = isEn ? `Water ${5 - waterCount} more times to grow into Young Tree` : `รดน้ำอีก ${5 - waterCount} ครั้ง เพื่อเติบโตเป็นต้นไม้เล็ก`;
    if (fruitSelectorContainer) fruitSelectorContainer.classList.add("hidden");
  } else if (waterCount < 15) {
    stage = 2;
    stageName = isEn ? "Young Tree (Stage 2)" : "ต้นไม้เล็ก (Baby Tree)";
    badgeColor = "#4ade80"; // Medium green
    progressPercent = ((waterCount - 5) / 10) * 100;
    instruction = isEn ? `Water ${15 - waterCount} more times to grow lush leaves` : `รดน้ำอีก ${15 - waterCount} ครั้ง เพื่อให้ใบไม้หนาขึ้น`;
    if (fruitSelectorContainer) fruitSelectorContainer.classList.add("hidden");
  } else if (waterCount < 30) {
    stage = 3;
    stageName = isEn ? "Growing Tree (Stage 3)" : "ต้นไม้สมบูรณ์ (Green Tree)";
    badgeColor = "#15803d"; // Dark green
    progressPercent = ((waterCount - 15) / 15) * 100;
    instruction = isEn ? `Water ${30 - waterCount} more times to bear fruits` : `รดน้ำอีก ${30 - waterCount} ครั้ง เพื่อออกผลไม้ผลิตผล`;
    if (fruitSelectorContainer) fruitSelectorContainer.classList.add("hidden");
  } else if (waterCount < 50) {
    stage = 4;
    stageName = isEn ? "Fruit Tree (Stage 4)" : "ต้นไม้ออกผล (Fruit Tree)";
    badgeColor = "#ef4444"; // Fruit red
    progressPercent = ((waterCount - 30) / 20) * 100;
    instruction = isEn ? `Water ${50 - waterCount} more times to unlock Golden Tree!` : `รดน้ำอีก ${50 - waterCount} ครั้ง เพื่อปลุกพลังต้นไม้สีทอง!`;
    
    // Unlock fruit selector dropdown
    if (fruitSelectorContainer) {
      fruitSelectorContainer.classList.remove("hidden");
      if (fruitSelect) {
        fruitSelect.value = appState.treeState.selectedFruit || "apple";
      }
    }
  } else {
    stage = 5;
    stageName = isEn ? "Golden Tree 🌟 (Stage 5)" : "ต้นไม้ทองคำ (Golden Tree) 🌟";
    badgeColor = "#eab308"; // Golden yellow
    progressPercent = 100;
    instruction = isEn ? "Your Golden Tree is fully grown! Thank you for protecting the planet 🌟" : "ต้นไม้สีทองของคุณเติบโตเต็มที่แล้ว! ขอบคุณที่รักษ์โลก 🌟";
    
    // Keep fruit selector available
    if (fruitSelectorContainer) {
      fruitSelectorContainer.classList.remove("hidden");
      if (fruitSelect) {
        fruitSelect.value = appState.treeState.selectedFruit || "apple";
      }
    }
  }

  // Update Status UI Cards
  if (treeStageBadge) {
    treeStageBadge.textContent = stageName;
    treeStageBadge.style.backgroundColor = badgeColor;
  }
  if (growthProgressFill) {
    growthProgressFill.style.width = `${progressPercent}%`;
  }
  if (growthInstructionText) {
    growthInstructionText.textContent = instruction;
  }

  // Disable button if not enough points
  if (btnWaterTree) {
    if ((appState.points || 0) < 50) {
      btnWaterTree.disabled = true;
      btnWaterTree.innerHTML = `<i data-lucide="lock" style="width: 18px; height: 18px;"></i><span>คะแนนไม่เพียงพอ (ต้องการ 50 คะแนน)</span>`;
    } else {
      btnWaterTree.disabled = false;
      btnWaterTree.innerHTML = `<i data-lucide="droplet" style="width: 18px; height: 18px;"></i><span>รดน้ำต้นไม้ (ใช้ 50 คะแนน)</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
  }

  // Generate dynamic SVG tree graphics based on current stage
  let svgContent = "";

  // 1. Defs for radial gradients (Metallic Gold Leaf styling)
  svgContent += `
    <defs>
      <radialGradient id="gold-leaf-1" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#fffbeb" />
        <stop offset="35%" stop-color="#fef08a" />
        <stop offset="80%" stop-color="#eab308" />
        <stop offset="100%" stop-color="#a16207" />
      </radialGradient>
      <radialGradient id="gold-leaf-2" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="60%" stop-color="#d97706" />
        <stop offset="100%" stop-color="#78350f" />
      </radialGradient>
    </defs>
  `;

  // Draw Soil/Pot base
  svgContent += `<ellipse cx="100" cy="180" rx="35" ry="8" fill="#7c2d12" opacity="0.3" />`;

  // Stage 1: Sapling
  if (stage === 1) {
    svgContent += `
      <!-- Trunk/Stem -->
      <path d="M97 180 C 97 165, 98 152, 100 138 C 102 152, 103 165, 103 180 Z" fill="#78350f" />
      <!-- Left Leaf -->
      <path d="M100 138 C 88 128, 82 142, 100 138 Z" fill="#86efac" class="sway-leaf-left" />
      <!-- Right Leaf -->
      <path d="M100 138 C 112 128, 118 142, 100 138 Z" fill="#4ade80" class="sway-leaf-right" />
      <circle cx="100" cy="138" r="1.5" fill="#facc15" />
    `;
  }
  // Stage 2: Baby Tree
  else if (stage === 2) {
    svgContent += `
      <!-- Trunk -->
      <path d="M95 180 C 96 155, 97 140, 97 122 L103 122 C 103 140, 104 155, 105 180 Z" fill="#78350f" />
      <!-- Left Branch -->
      <path d="M97 145 C 93 140, 88 135, 84 130 L87 127 C 91 132, 95 137, 98 140 Z" fill="#78350f" />
      <!-- Right Branch -->
      <path d="M103 145 C 107 140, 112 135, 116 130 L113 127 C 109 132, 105 137, 102 140 Z" fill="#78350f" />
      
      <!-- Leaf Canopy (Baby sized) -->
      <g class="sway-element">
        <circle cx="82" cy="128" r="12" fill="#4ade80" opacity="0.9" />
        <circle cx="118" cy="128" r="12" fill="#4ade80" opacity="0.9" />
        <circle cx="100" cy="116" r="16" fill="#15803d" />
        <circle cx="100" cy="106" r="13" fill="#86efac" opacity="0.95" />
      </g>

      <!-- User's Baby Tree Text Tag Banner -->
      <g>
        <rect x="25" y="65" width="150" height="24" rx="12" fill="rgba(62,107,83,0.85)" stroke="#ffffff" stroke-width="1.2" />
        <text x="100" y="81" font-family="'Athiti', sans-serif" font-size="9.5" font-weight="700" fill="#ffffff" text-anchor="middle">
          ต้นไม้ของ ${username}
        </text>
      </g>
    `;
  }
  // Stage 3: Green Tree
  else if (stage === 3) {
    svgContent += `
      <!-- Trunk -->
      <path d="M91 180 C 93 145, 94 125, 96 95 L104 95 C 106 125, 107 145, 109 180 Z" fill="#78350f" />
      <!-- Branches -->
      <path d="M95 135 Q 85 125 74 110 L79 106 Q 89 120 97 127 Z" fill="#78350f" />
      <path d="M105 135 Q 115 125 126 110 L121 106 Q 111 120 103 127 Z" fill="#78350f" />

      <!-- Full Lush Canopy -->
      <g class="sway-element">
        <!-- Back layer (Dark) -->
        <circle cx="70" cy="98" r="26" fill="#14532d" />
        <circle cx="130" cy="98" r="26" fill="#14532d" />
        <circle cx="100" cy="72" r="30" fill="#166534" />
        <!-- Mid layer (Medium) -->
        <circle cx="68" cy="102" r="20" fill="#15803d" />
        <circle cx="132" cy="102" r="20" fill="#15803d" />
        <circle cx="86" cy="86" r="26" fill="#16a34a" />
        <circle cx="114" cy="86" r="26" fill="#16a34a" />
        <!-- Top layer (Light) -->
        <circle cx="100" cy="65" r="22" fill="#22c55e" />
        <circle cx="82" cy="75" r="16" fill="#4ade80" />
        <circle cx="118" cy="75" r="16" fill="#4ade80" />
        <circle cx="100" cy="82" r="15" fill="#86efac" />
      </g>
    `;
  }
  // Stage 4: Fruiting Tree
  else if (stage === 4) {
    svgContent += `
      <!-- Trunk -->
      <path d="M91 180 C 93 145, 94 125, 96 95 L104 95 C 106 125, 107 145, 109 180 Z" fill="#78350f" />
      <!-- Branches -->
      <path d="M95 135 Q 85 125 74 110 L79 106 Q 89 120 97 127 Z" fill="#78350f" />
      <path d="M105 135 Q 115 125 126 110 L121 106 Q 111 120 103 127 Z" fill="#78350f" />

      <!-- Full Canopy -->
      <g class="sway-element">
        <circle cx="70" cy="98" r="26" fill="#14532d" />
        <circle cx="130" cy="98" r="26" fill="#14532d" />
        <circle cx="100" cy="72" r="30" fill="#166534" />
        <circle cx="68" cy="102" r="20" fill="#15803d" />
        <circle cx="132" cy="102" r="20" fill="#15803d" />
        <circle cx="86" cy="86" r="26" fill="#16a34a" />
        <circle cx="114" cy="86" r="26" fill="#16a34a" />
        <circle cx="100" cy="65" r="22" fill="#22c55e" />
        <circle cx="82" cy="75" r="16" fill="#4ade80" />
        <circle cx="118" cy="75" r="16" fill="#4ade80" />
        <circle cx="100" cy="82" r="15" fill="#86efac" />
        
        <!-- Render Fruits inside the swaying canopy group! -->
        ${renderFruitsHTML()}
      </g>
    `;
  }
  // Stage 5: Golden Tree
  else if (stage === 5) {
    svgContent += `
      <!-- Trunk (Gilded Brown) -->
      <path d="M91 180 C 93 145, 94 125, 96 95 L104 95 C 106 125, 107 145, 109 180 Z" fill="#a16207" />
      <!-- Branches -->
      <path d="M95 135 Q 85 125 74 110 L79 106 Q 89 120 97 127 Z" fill="#a16207" />
      <path d="M105 135 Q 115 125 126 110 L121 106 Q 111 120 103 127 Z" fill="#a16207" />

      <!-- Full Golden Canopy -->
      <g class="sway-element">
        <!-- Back canopy layer (Radial grad dark) -->
        <circle cx="70" cy="98" r="26" fill="url(#gold-leaf-2)" />
        <circle cx="130" cy="98" r="26" fill="url(#gold-leaf-2)" />
        <circle cx="100" cy="72" r="30" fill="url(#gold-leaf-2)" />
        
        <!-- Mid canopy layer (Radial grad light) -->
        <circle cx="68" cy="102" r="20" fill="url(#gold-leaf-1)" />
        <circle cx="132" cy="102" r="20" fill="url(#gold-leaf-1)" />
        <circle cx="86" cy="86" r="26" fill="url(#gold-leaf-1)" />
        <circle cx="114" cy="86" r="26" fill="url(#gold-leaf-1)" />
        
        <!-- Top highlights -->
        <circle cx="100" cy="65" r="22" fill="url(#gold-leaf-1)" />
        <circle cx="82" cy="75" r="16" fill="url(#gold-leaf-1)" />
        <circle cx="118" cy="75" r="16" fill="url(#gold-leaf-1)" />
        <circle cx="100" cy="82" r="15" fill="#fef08a" opacity="0.9" />
        
        <!-- Gilded Fruits (Shimmering Golden Fruits!) -->
        ${renderFruitsHTML(true)}
      </g>
    `;
  }

  // Update SVG content
  treeSvg.innerHTML = svgContent;
}

/**
 * Returns HTML strings representing fruits rendered at strategic points on the tree canopy.
 * Can render normal colors or gilded golden versions.
 */
function renderFruitsHTML(isGilded = false) {
  const selectedFruit = appState.treeState.selectedFruit || "apple";
  
  // Coordinates where fruits sit on the tree canopy
  const positions = [
    { x: 74, y: 82 },
    { x: 126, y: 82 },
    { x: 100, y: 55 },
    { x: 60, y: 104 },
    { x: 140, y: 104 },
    { x: 100, y: 88 },
    { x: 80, y: 108 },
    { x: 120, y: 108 }
  ];

  let fruitsHTML = "";

  positions.forEach(pos => {
    switch (selectedFruit) {
      case "apple":
        // Red Apple or Gold Apple
        const appleColor = isGilded ? "url(#gold-leaf-1)" : "#ef4444";
        const appleLeafColor = isGilded ? "#eab308" : "#22c55e";
        fruitsHTML += `
          <!-- Apple Shape -->
          <circle cx="${pos.x}" cy="${pos.y}" r="5.5" fill="${appleColor}" />
          <!-- Apple Stem -->
          <path d="M${pos.x} ${pos.y - 5.5} Q${pos.x + 2} ${pos.y - 8.5} ${pos.x + 3} ${pos.y - 8}" stroke="#78350f" stroke-width="0.8" fill="none" />
          <!-- Apple Leaf -->
          <path d="M${pos.x + 2} ${pos.y - 8} C${pos.x + 4} ${pos.y - 9.5} ${pos.x + 5} ${pos.y - 7} ${pos.x + 2} ${pos.y - 8} Z" fill="${appleLeafColor}" />
        `;
        break;
      
      case "orange":
        // Orange Orange or Gold Orange
        const orangeColor = isGilded ? "url(#gold-leaf-1)" : "#f97316";
        const orangeLeafColor = isGilded ? "#eab308" : "#15803d";
        fruitsHTML += `
          <!-- Orange Shape -->
          <circle cx="${pos.x}" cy="${pos.y}" r="5.5" fill="${orangeColor}" />
          <!-- Orange center dot -->
          <circle cx="${pos.x}" cy="${pos.y}" r="0.7" fill="#ea580c" />
          <!-- Orange Leaf -->
          <path d="M${pos.x} ${pos.y - 5.5} Q${pos.x + 1} ${pos.y - 7.5} ${pos.x + 2} ${pos.y - 7.5}" stroke="${orangeLeafColor}" stroke-width="0.8" fill="none" />
        `;
        break;

      case "banana":
        // Yellow Banana or Gold Banana
        const bananaColor = isGilded ? "url(#gold-leaf-1)" : "#eab308";
        const bananaStroke = isGilded ? "#ca8a04" : "#854d0e";
        fruitsHTML += `
          <!-- Banana Crescent Path -->
          <path d="M${pos.x - 4} ${pos.y - 2} Q${pos.x} ${pos.y + 4} ${pos.x + 4} ${pos.y - 2} Q${pos.x} ${pos.y + 1} ${pos.x - 4} ${pos.y - 2}" fill="${bananaColor}" stroke="${bananaStroke}" stroke-width="0.5" />
        `;
        break;

      case "peach":
        // Pinkish Peach or Gold Peach
        const peachColor = isGilded ? "url(#gold-leaf-1)" : "#fecdd3";
        const peachBaseColor = isGilded ? "#d97706" : "#fda4af";
        const peachSeamColor = isGilded ? "#a16207" : "#f43f5e";
        fruitsHTML += `
          <!-- Peach Shape -->
          <circle cx="${pos.x}" cy="${pos.y}" r="6" fill="${peachBaseColor}" />
          <path d="M${pos.x} ${pos.y - 6} Q${pos.x + 1.5} ${pos.y} ${pos.x} ${pos.y + 6}" stroke="${peachSeamColor}" stroke-width="0.6" fill="none" opacity="0.6" />
          <circle cx="${pos.x - 1}" cy="${pos.y - 1}" r="4.5" fill="${peachColor}" opacity="0.6" />
        `;
        break;

      case "cherry":
        // Red Cherries or Gold Cherries
        const cherryColor = isGilded ? "url(#gold-leaf-1)" : "#be123c";
        const cherryStemColor = isGilded ? "#ca8a04" : "#16a34a";
        fruitsHTML += `
          <!-- Left cherry -->
          <circle cx="${pos.x - 2.5}" cy="${pos.y + 2}" r="3" fill="${cherryColor}" />
          <!-- Right cherry -->
          <circle cx="${pos.x + 2.5}" cy="${pos.y + 2.5}" r="3" fill="${cherryColor}" />
          <!-- Stems -->
          <path d="M${pos.x - 2.5} ${pos.y + 2} Q${pos.x} ${pos.y - 3.5} ${pos.x} ${pos.y - 3.5}" stroke="${cherryStemColor}" stroke-width="0.8" fill="none" />
          <path d="M${pos.x + 2.5} ${pos.y + 2.5} Q${pos.x} ${pos.y - 3.5} ${pos.x} ${pos.y - 3.5}" stroke="${cherryStemColor}" stroke-width="0.8" fill="none" />
        `;
        break;
    }
  });

  return fruitsHTML;
}

/**
 * Triggers the watering process. Deducts points, rotates can, spawns droplets, and updates growth.
 */
function waterTree() {
  if (!appState || (appState.points || 0) < 50) return;

  // Deduct Points
  appState.points = Math.max(0, (appState.points || 0) - 50);
  
  // Track previous stage boundary
  const prevWaterCount = appState.treeState.waterCount || 0;
  
  // Increment Waterings
  appState.treeState.waterCount = prevWaterCount + 1;
  const newWaterCount = appState.treeState.waterCount;
  
  // Save State and push to cloud/local store
  if (typeof saveState === "function") saveState();
  if (typeof pushLocalStatsToServer === "function") pushLocalStatsToServer();

  
  // 1. Play Watering Can Animation
  if (wateringCanIcon) {
    wateringCanIcon.classList.remove("watering-can-active");
    // Trigger DOM reflow to restart CSS animation
    void wateringCanIcon.offsetWidth; 
    wateringCanIcon.classList.add("watering-can-active");
  }

  // 2. Spawn water droplets particles
  if (dropletsContainer) {
    dropletsContainer.innerHTML = "";
    
    // Animate falling droplets with random positions and cascading delays
    const dropletCount = 28;
    for (let i = 0; i < dropletCount; i++) {
      const drop = document.createElement("div");
      drop.className = "droplet-particle";
      
      // Position droplets falling down on the canopy center
      drop.style.left = `${20 + Math.random() * 45}px`;
      drop.style.top = `${-10 + Math.random() * 20}px`;
      drop.style.animationDelay = `${0.3 + Math.random() * 1.0}s`;
      
      dropletsContainer.appendChild(drop);
    }
  }

  // Disable button during watering sequence to prevent double tap/points loss
  if (btnWaterTree) {
    btnWaterTree.disabled = true;
  }

  // Update Points UI immediately so user sees deductions
  if (treePointsDisplay) {
    treePointsDisplay.textContent = appState.points.toLocaleString();
  }
  if (typeof updateUI === "function") {
    updateUI(); // Refreshes top nav bar XP & Points details if shared
  }

  // Delay re-drawing tree until water droplets are hitting the tree canopy (about 1.2s)
  setTimeout(() => {
    renderTree();
    
    // Check if user crossed a growth milestone boundary
    let crossedMilestone = false;
    let milestoneMessage = "";
    
    if (prevWaterCount < 5 && newWaterCount >= 5) {
      crossedMilestone = true;
      milestoneMessage = "ต้นไม้กลายเป็นต้นไม้เล็กแล้ว! 🌱";
    } else if (prevWaterCount < 15 && newWaterCount >= 15) {
      crossedMilestone = true;
      milestoneMessage = "ต้นไม้เติบโตแข็งแรง มีใบไม้สีเขียวขจีแล้ว! 🌿";
    } else if (prevWaterCount < 30 && newWaterCount >= 30) {
      crossedMilestone = true;
      milestoneMessage = "ต้นไม้เริ่มผลิดอกออกผลแล้ว! สามารถเปลี่ยนชนิดผลไม้ได้แล้วนะ 🍎";
    } else if (prevWaterCount < 50 && newWaterCount >= 50) {
      crossedMilestone = true;
      milestoneMessage = "พลังรักษ์โลกพวยพุ่ง! ต้นไม้ของคุณกลายเป็นต้นไม้ทองคำเรืองแสง! 🌟";
    }

    if (crossedMilestone) {
      // Fire confetti celebration
      if (window.confetti) {
        window.confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.55 },
          colors: ['#eab308', '#22c55e', '#a8e6cf']
        });
      }
      setTimeout(() => alert(`ยินดีด้วย!\n\n${milestoneMessage}`), 300);
    }
  }, 1200);

  // Fully re-enable controls once animation completes (2.2s total can animation time)
  setTimeout(() => {
    // Clear droplets and can animation state
    if (wateringCanIcon) {
      wateringCanIcon.classList.remove("watering-can-active");
    }
    if (dropletsContainer) {
      dropletsContainer.innerHTML = "";
    }
    
    // Re-render final button disabled/enabled states based on leftover points
    renderTree();
  }, 2200);
}

window.addEventListener("languageChanged", () => {
  renderTree();
});
