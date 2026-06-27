/* ==========================================================================
   EcoAR Scanner Module - Camera capture, AI object detection, Simulator, Modal
   ========================================================================== */



// Elements
let video, scannerCanvas, scannerCtx;
let btnToggleCam, btnCloseModal, btnConfirmDispose, scanModal, imageUpload;
let loadingOverlay, hudCamStatus, hudAiStatus, hudFpsStatus;
let attachmentCard, attachmentName, attachmentStatus, btnRemoveAttachment;

// Global States
let model = null;
let webcamStream = null;
let isCamActive = false;
let isDetecting = false;
let lastFrameTime = 0;
let detectedItemsCount = 0;
let scannerLockOnItem = null;
let scannerLockOnTimer = null;
let currentItemData = null; // Store item data for disposal confirm

// Trash Items Database
const TRASH_DB = {
  plastic_bottle: {
    title: "ขวดน้ำพลาสติก",
    bin: "recycling",
    label: "ขยะรีไซเคิล (สีน้ำเงิน)",
    rules: [
      "เทของเหลวที่เหลือออกให้หมดและล้างขวดให้สะอาด",
      "บีบขวดให้แบนเพื่อประหยัดพื้นที่ถังขยะ",
      "ถอดฝาขวดออกก่อนทิ้งลงถังสีน้ำเงิน"
    ],
    fact: "การรีไซเคิลขวดพลาสติกเพียง 1 ขวดช่วยประหยัดพลังงานได้มากพอที่จะเปิดใช้งานคอมพิวเตอร์แล็ปท็อปได้นานถึง 25 ชั่วโมง!"
  },
  banana_peel: {
    title: "เปลือกกล้วย / เศษอาหาร",
    bin: "organic",
    label: "ขยะอินทรีย์ย่อยสลาย (สีเขียว)",
    rules: [
      "ตรวจสอบให้แน่ใจว่าไม่มีสติกเกอร์พลาสติก ลวดมัด หรือพลาสติกห่อหุ้มติดอยู่",
      "ทำปุ๋ยหมักเศษอาหารเพื่อลดการปล่อยก๊าซมีเทนจากบ่อฝังกลบ",
      "ทิ้งลงในถังขยะอินทรีย์สีเขียว"
    ],
    fact: "เศษอาหารคิดเป็น 20% ของขยะในบ่อฝังกลบ การทำปุ๋ยหมักจะเปลี่ยนเศษอาหารให้กลายเป็นปุ๋ยที่อุดมไปด้วยสารอาหาร!"
  },
  battery: {
    title: "แบตเตอรี่ในครัวเรือน / ขยะอิเล็กทรอนิกส์",
    bin: "hazardous",
    label: "ขยะอันตราย (สีแดง)",
    rules: [
      "ห้ามทิ้งแบตเตอรี่ปะปนกับขยะทั่วไป (อันตรายจากไฟไหม้)",
      "เก็บในภาชนะที่แห้งและเย็นก่อนนำไปทิ้ง",
      "นำไปทิ้ง ณ จุดรับทิ้งขยะอิเล็กทรอนิกส์อันตรายโดยเฉพาะ"
    ],
    fact: "ขยะอิเล็กทรอนิกส์มีสัดส่วนเพียง 2% ของปริมาณขยะในบ่อฝังกลบ แต่คิดเป็นถึง 70% ของมลพิษโลหะหนักที่เป็นพิษ!"
  },
  chips_bag: {
    title: "ซองขนมขบเคี้ยว / ขยะทั่วไป",
    bin: "general",
    label: "ขยะทั่วไป (สีเทา)",
    rules: [
      "ตรวจสอบให้แน่ใจว่าไม่มีเศษขนมเหลืออยู่ในซอง",
      "ฟอยล์หรือพลาสติกเคลือบหลายชั้นไม่สามารถรีไซเคิลได้ในท้องถิ่น",
      "ทิ้งลงในถังขยะทั่วไปสีเทา"
    ],
    fact: "ซองขนมขบเคี้ยวที่เคลือบฟอยล์อาจใช้เวลาถึง 80 ปีในการย่อยสลายในบ่อฝังกลบ ลองเลือกซื้อแบบบรรจุภัณฑ์ขนาดใหญ่เพื่อลดขยะ!"
  }
};

// TensorFlow Object Detection mapping to Trash Categories
const cocoToTrashMap = {
  "bottle": "plastic_bottle",
  "cup": "plastic_bottle",
  "wine glass": "plastic_bottle",
  "banana": "banana_peel",
  "apple": "banana_peel",
  "orange": "banana_peel",
  "broccoli": "banana_peel",
  "carrot": "banana_peel",
  "sandwich": "banana_peel",
  "cell phone": "battery",
  "keyboard": "battery",
  "mouse": "battery",
  "laptop": "battery",
  "backpack": "chips_bag",
  "handbag": "chips_bag",
  "umbrella": "chips_bag",
  "tie": "chips_bag",
  "suitcase": "chips_bag"
};

// Map COCO-SSD class names to Thai
const thaiClassNames = {
  "bottle": "ขวดพลาสติก",
  "cup": "แก้วน้ำ",
  "wine glass": "แก้วไวน์",
  "banana": "เปลือกกล้วย",
  "apple": "เศษแอปเปิ้ล",
  "orange": "เศษส้ม",
  "broccoli": "เศษบล็อกโคลี่",
  "carrot": "เศษแครอท",
  "sandwich": "เศษแซนด์วิช",
  "cell phone": "แบตเตอรี่/มือถือ",
  "keyboard": "คีย์บอร์ด",
  "mouse": "เมาส์",
  "laptop": "แล็ปท็อป/อิเล็กทรอนิกส์",
  "backpack": "ถุงขยะทั่วไป",
  "handbag": "กระเป๋าถือ",
  "umbrella": "ร่ม",
  "tie": "เนกไท",
  "suitcase": "กระเป๋าเดินทาง"
};

/**
 * Initializes DOM elements and binds event listeners for the Scanner view.
 */
function initScanner() {
  video = document.getElementById("webcam");
  scannerCanvas = document.getElementById("detection-canvas");
  if (scannerCanvas) scannerCtx = scannerCanvas.getContext("2d");
  
  btnToggleCam = document.getElementById("btn-toggle-cam");
  btnCloseModal = document.getElementById("btn-close-modal");
  btnConfirmDispose = document.getElementById("btn-confirm-dispose");
  scanModal = document.getElementById("scan-modal");
  imageUpload = document.getElementById("image-upload");
  loadingOverlay = document.getElementById("loading-overlay");
  
  hudCamStatus = document.getElementById("hud-cam-status");
  hudAiStatus = document.getElementById("hud-ai-status");
  hudFpsStatus = document.getElementById("hud-fps-status");

  attachmentCard = document.getElementById("attachment-card");
  attachmentName = document.getElementById("attachment-name");
  attachmentStatus = document.getElementById("attachment-status");
  btnRemoveAttachment = document.getElementById("btn-remove-attachment");

  // Event Listeners with defensive null-checks
  if (btnToggleCam) btnToggleCam.addEventListener("click", toggleCamera);
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeScanModal);
  if (btnConfirmDispose) btnConfirmDispose.addEventListener("click", confirmDisposal);
  
  // File Uploader Scan Action
  if (imageUpload) imageUpload.addEventListener("change", handleImageUpload);

  // Remove Attachment Action
  if (btnRemoveAttachment) btnRemoveAttachment.addEventListener("click", removeAttachment);

  // Bind Simulator Buttons
  const demoBtns = document.querySelectorAll(".demo-btn");
  if (demoBtns) {
    for (let i = 0; i < demoBtns.length; i++) {
      const btn = demoBtns[i];
      btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-type");
        runSimulationScan(type);
      });
    }
  }

  // Load the AI Model in background
  loadAIModel();
}

/**
 * Loads TensorFlow.js coco-ssd model asynchronously
 */
async function loadAIModel() {
  try {
    if (hudAiStatus) hudAiStatus.textContent = "กำลังโหลด...";
    // cocoSsd is loaded via CDN, globally available
    if (window.cocoSsd) {
      model = await window.cocoSsd.load({
        base: 'lite_mobilenet_v2' // Lightweight version optimized for mobile browsers
      });
      if (hudAiStatus) {
        hudAiStatus.textContent = "ออนไลน์";
        hudAiStatus.classList.add("green-text");
      }
      if (loadingOverlay) {
        loadingOverlay.style.opacity = "0";
        setTimeout(() => {
          if (loadingOverlay) loadingOverlay.style.display = "none";
        }, 300);
      }
    } else {
      throw new Error("cocoSsd script not loaded from CDN");
    }
  } catch (err) {
    console.error("AI Model failed to load:", err);
    if (hudAiStatus) {
      hudAiStatus.textContent = "ออฟไลน์";
      hudAiStatus.style.color = "#ef4444";
    }
    const overlayTitle = document.querySelector("#loading-overlay p");
    const overlaySub = document.querySelector("#loading-overlay .subtext");
    if (overlayTitle) overlayTitle.textContent = "ระบบเอไอออฟไลน์";
    if (overlaySub) overlaySub.textContent = "โหลดเครือข่ายประสาทเทียมล้มเหลว แต่คุณยังคงสามารถใช้โหมดจำลองได้!";
  }
}

/**
 * Toggles the webcam stream on or off
 */
function toggleCamera() {
  if (isCamActive) {
    stopWebcam();
  } else {
    startWebcam();
  }
}

/**
 * Starts camera capturing using WebRTC
 */
async function startWebcam() {
  if (isCamActive) return;
  removeAttachment();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (hudCamStatus) {
      hudCamStatus.textContent = "ไม่รองรับ";
      hudCamStatus.style.color = "#ef4444";
    }
    alert("ระบบกล้องถูกปิดกั้นโดยเบราว์เซอร์ของคุณ\n\nสาเหตุหลัก:\n1. คุณอาจเคยเผลอกด 'บล็อก' (Block) กล้องสำหรับเว็บนี้ไปก่อนหน้า\n2. คุณอาจเปิดลิงก์นี้จากห้องแชทในแอปอื่น (เช่น LINE, Facebook, GitHub)\n\nวิธีแก้ไข:\n- สำหรับ Chrome: กดไอคอน 'แม่กุญแจ' ข้างชื่อเว็บในช่องใส่ลิงก์ -> รีเซ็ตสิทธิ์การใช้กล้อง\n- สำหรับ Safari: ไปที่ การตั้งค่าของ iPhone -> Safari -> กล้อง -> เลือกเป็น 'ถาม' หรือ 'อนุญาต'");
    return;
  }

  if (hudCamStatus) hudCamStatus.textContent = "กำลังเปิด...";
  
  const constraints = {
    video: {
      facingMode: "environment", // Request rear camera on mobile
      width: { ideal: 640 },
      height: { ideal: 800 }
    },
    audio: false
  };

  try {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (primaryErr) {
      console.warn("Primary camera constraints failed, trying basic video fallback...", primaryErr);
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    if (video) {
      video.srcObject = webcamStream;
      video.style.display = "block";
    }
    const hudOverlay = document.querySelector(".ar-hud-overlay");
    if (hudOverlay) {
      hudOverlay.style.display = "block";
    }
    
    // Set canvas sizes to match video dimension once loaded
    if (video) {
      video.onloadedmetadata = () => {
        if (scannerCanvas) {
          scannerCanvas.width = video.videoWidth;
          scannerCanvas.height = video.videoHeight;
        }
        isCamActive = true;
        isDetecting = true;
        if (hudCamStatus) {
          hudCamStatus.textContent = "เปิดกล้อง";
          hudCamStatus.classList.add("green-text");
        }
        
        if (btnToggleCam) btnToggleCam.innerHTML = '<i data-lucide="camera"></i><span>ปิดกล้อง</span>';
        if (window.lucide) window.lucide.createIcons();
        
        // Start real-time analysis loop
        requestAnimationFrame(detectionLoop);
      };
    }
  } catch (err) {
    console.error("Camera access blocked or unavailable:", err);
    if (hudCamStatus) {
      hudCamStatus.textContent = "ปิดกั้น";
      hudCamStatus.style.color = "#ef4444";
    }
    alert("การเข้าถึงกล้องถูกปฏิเสธหรือไม่สามารถใช้งานได้ โปรดใช้ปุ่มจำลองด้านล่างเพื่อทดสอบเครื่องสแกน AR");
  }
}

/**
 * Stops camera capturing and releases resources
 */
function stopWebcam() {
  isDetecting = false;
  isCamActive = false;
  
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  
  if (video) {
    video.srcObject = null;
    video.style.display = "none";
  }
  
  const hudOverlay = document.querySelector(".ar-hud-overlay");
  if (hudOverlay) {
    hudOverlay.style.display = "none";
  }
  
  if (scannerCtx && scannerCanvas) {
    scannerCtx.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);
  }

  clearLockOnTimer();

  if (hudCamStatus) {
    hudCamStatus.textContent = "ปิดกล้อง";
    hudCamStatus.classList.remove("green-text");
    hudCamStatus.style.color = "";
  }
  
  if (btnToggleCam) {
    btnToggleCam.innerHTML = '<i data-lucide="camera-off"></i><span>เปิดกล้อง</span>';
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * The main real-time rendering and prediction loop
 */
async function detectionLoop(now) {
  if (!isDetecting || !isCamActive) return;

  // Calculate FPS telemetry
  const fps = Math.round(1000 / (now - lastFrameTime));
  lastFrameTime = now;
  if (hudFpsStatus && !isNaN(fps)) {
    hudFpsStatus.textContent = fps < 10 ? `0${fps}` : fps;
  }

  scannerCtx.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);

  // Perform object detection
  if (model && video.readyState === 4) {
    try {
      const predictions = await model.detect(video);
      
      let trashDetectedThisFrame = false;

      predictions.forEach(prediction => {
        // Draw bounding box if score > 0.60
        if (prediction.score > 0.60) {
          const [x, y, width, height] = prediction.bbox;
          const label = prediction.class;
          
          // Check if detected item matches trash categories
          const trashDbKey = cocoToTrashMap[label.toLowerCase()];
          
          // Bounding box colors based on category
          let color = "#39ef7d"; // Neon green default
          if (trashDbKey) {
            const trashData = TRASH_DB[trashDbKey];
            if (trashData.bin === "recycling") color = "#38bdf8";
            else if (trashData.bin === "organic") color = "#4ade80";
            else if (trashData.bin === "hazardous") color = "#f87171";
            else color = "#94a3b8";
            
            trashDetectedThisFrame = true;
            
            // Handle scanning lock-on mechanism
            handleLockOn(trashDbKey);
          }

          drawBoundingBox(x, y, width, height, label, prediction.score, color);
        }
      });

      // Clear lock-on if no items mapped to trash are visible
      if (!trashDetectedThisFrame) {
        clearLockOnTimer();
      }

    } catch (e) {
      console.error("Prediction cycle error:", e);
    }
  }

  // Next frame
  if (isCamActive && isDetecting) {
    requestAnimationFrame(detectionLoop);
  }
}

/**
 * Draws a stylized, glowing HUD-style bounding box on canvas
 */
function drawBoundingBox(x, y, width, height, label, score, color) {
  scannerCtx.strokeStyle = color;
  scannerCtx.lineWidth = 3;
  scannerCtx.shadowColor = color;
  scannerCtx.shadowBlur = 8;
  
  // Draw corner brackets instead of solid boxes for a cool futuristic AR HUD look
  const length = Math.min(20, width / 4, height / 4);
  
  // Top Left
  scannerCtx.beginPath();
  scannerCtx.moveTo(x + length, y);
  scannerCtx.lineTo(x, y);
  scannerCtx.lineTo(x, y + length);
  scannerCtx.stroke();
  
  // Top Right
  scannerCtx.beginPath();
  scannerCtx.moveTo(x + width - length, y);
  scannerCtx.lineTo(x + width, y);
  scannerCtx.lineTo(x + width, y + length);
  scannerCtx.stroke();
  
  // Bottom Left
  scannerCtx.beginPath();
  scannerCtx.moveTo(x + length, y + height);
  scannerCtx.lineTo(x, y + height);
  scannerCtx.lineTo(x, y + height - length);
  scannerCtx.stroke();
  
  // Bottom Right
  scannerCtx.beginPath();
  scannerCtx.moveTo(x + width - length, y + height);
  scannerCtx.lineTo(x + width, y + height);
  scannerCtx.lineTo(x + width, y + height - length);
  scannerCtx.stroke();
  
  // Draw subtle filled background inside box
  scannerCtx.shadowBlur = 0;
  scannerCtx.fillStyle = `rgba(${hexToRgb(color)}, 0.08)`;
  scannerCtx.fillRect(x, y, width, height);
  
  // Bounding Box Label
  scannerCtx.fillStyle = color;
  scannerCtx.font = `bold 16px 'Athiti', 'Chakra Petch', sans-serif`;
  const textLabel = thaiClassNames[label.toLowerCase()] || label;
  const text = `${textLabel.toUpperCase()} (${Math.round(score * 100)}%)`;
  const textWidth = scannerCtx.measureText(text).width;
  
  scannerCtx.fillRect(x, y - 28, textWidth + 14, 28);
  
  scannerCtx.fillStyle = "#ffffff"; // White text inside green label bar
  scannerCtx.fillText(text, x + 7, y - 9);
}

/**
 * Handles lock-on timing. If trash is focused in reticle for 1.5s, trigger popup details modal.
 */
function handleLockOn(itemKey) {
  if (scannerLockOnItem === itemKey) return; // Already locking on
  
  clearLockOnTimer();
  
  scannerLockOnItem = itemKey;
  
  // 0.4 Seconds AR target lock animation delay (faster response)
  scannerLockOnTimer = setTimeout(() => {
    triggerScanHit(itemKey);
  }, 400);
}

function clearLockOnTimer() {
  if (scannerLockOnTimer) {
    clearTimeout(scannerLockOnTimer);
    scannerLockOnTimer = null;
  }
  scannerLockOnItem = null;
}

/**
 * Triggers modal display for scanned item
 */
function triggerScanHit(itemKey) {
  // If camera is running, pause detection loop during modal
  isDetecting = false;
  
  const data = TRASH_DB[itemKey];
  if (!data) return;

  currentItemData = { ...data, key: itemKey };

  // Setup Popup Modal styling and fields
  const modalContent = scanModal.querySelector(".modal-content");
  
  // Reset previous themes
  modalContent.className = "modal-content";
  modalContent.classList.add(`bin-${data.bin}-theme`);

  document.getElementById("detected-item-title").textContent = data.title;
  document.getElementById("bin-category-label").textContent = data.label;
  
  // Image element points to the generated minimalist asset folder
  document.getElementById("bin-image").src = `assets/${data.bin}.png`;
  
  // Set Guidelines list items
  const rulesList = document.getElementById("bin-rules-list");
  rulesList.innerHTML = "";
  data.rules.forEach(rule => {
    const li = document.createElement("li");
    li.textContent = rule;
    rulesList.appendChild(li);
  });

  // Set Eco Fact
  document.getElementById("bin-eco-fact").textContent = data.fact;

  // Show Modal
  scanModal.classList.remove("hidden");
}

/**
 * Closes details popup modal and resumes scanning
 */
function closeScanModal() {
  scanModal.classList.add("hidden");
  currentItemData = null;
  
  // Resume camera detection loop if cam is running
  if (isCamActive) {
    isDetecting = true;
    requestAnimationFrame(detectionLoop);
  }
}

/**
 * Adds XP, fires confetti, increments counts, and closes modal on confirm
 */
function confirmDisposal() {
  if (!currentItemData) return;
  
  // Update state counts
  appState.scannedCount++;
  
  // Add 50 XP
  addXP(50);
  
  // Celebrate!
  if (window.confetti) {
    window.confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#39ef7d', '#11998e', '#38bdf8']
    });
  }

  closeScanModal();
}

/**
 * Simulates a scan. Perfect fallback for any device.
 */
function runSimulationScan(itemKey) {
  removeAttachment();
  // Turn off real camera if running
  stopWebcam();
  
  // Show spinner to simulate scanning delay
  loadingOverlay.style.display = "flex";
  loadingOverlay.style.opacity = "1";
  document.querySelector("#loading-overlay p").textContent = "กำลังจำลองการสแกน...";
  document.querySelector("#loading-overlay .subtext").textContent = "กำลังรันการวิเคราะห์เอไอบนขยะจำลอง";
  
  setTimeout(() => {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      loadingOverlay.style.display = "none";
      triggerScanHit(itemKey);
    }, 100);
  }, 300);
}

/**
 * Handle custom file uploads for detection
 */
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  stopWebcam();

  // Show Google Classroom-style card immediately
  if (attachmentCard) {
    attachmentCard.classList.remove("hidden");
  }
  if (attachmentName) {
    attachmentName.textContent = file.name;
  }
  if (attachmentStatus) {
    attachmentStatus.textContent = "กำลังวิเคราะห์เอไอ...";
    attachmentStatus.className = "attachment-status scanning";
  }
  if (window.lucide) window.lucide.createIcons();

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = async function() {
      // Set canvas dimensions to fit image aspect ratio
      const maxDim = 500;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      scannerCanvas.width = w;
      scannerCanvas.height = h;

      // Draw uploaded image
      scannerCtx.drawImage(img, 0, 0, w, h);

      // Scan with TFjs if loaded
      let detectedKey = "chips_bag"; // Default fallback if nothing detected
      
      if (model) {
        try {
          const predictions = await model.detect(img);
          let topScore = 0;
          
          predictions.forEach(p => {
            if (p.score > 0.50 && p.score > topScore) {
              const mapped = cocoToTrashMap[p.class.toLowerCase()];
              if (mapped) {
                detectedKey = mapped;
                topScore = p.score;
              }
            }
          });
          
          // Draw bounding boxes on uploaded file canvas view
          predictions.forEach(p => {
            if (p.score > 0.50) {
              const [bx, by, bw, bh] = p.bbox;
              // Map bbox positions from raw image to fits-canvas size
              const rx = (bx / img.width) * w;
              const ry = (by / img.height) * h;
              const rw = (bw / img.width) * w;
              const rh = (bh / img.height) * h;
              
              const mapped = cocoToTrashMap[p.class.toLowerCase()];
              const color = mapped ? (mapped === "plastic_bottle" ? "#38bdf8" : mapped === "banana_peel" ? "#4ade80" : mapped === "battery" ? "#f87171" : "#94a3b8") : "#39ef7d";
              
              drawBoundingBox(rx, ry, rw, rh, p.class, p.score, color);
            }
          });
        } catch (err) {
          console.error("File detection failed:", err);
        }
      }

      // Update status to success
      if (attachmentStatus) {
        attachmentStatus.textContent = "วิเคราะห์สำเร็จ";
        attachmentStatus.className = "attachment-status success";
      }

      // Trigger modal popup after a short delay so user can see success state
      setTimeout(() => {
        triggerScanHit(detectedKey);
      }, 400);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Remove attachment card, clear input, and clear canvas
 */
function removeAttachment() {
  if (imageUpload) imageUpload.value = "";
  if (attachmentCard) attachmentCard.classList.add("hidden");
  if (scannerCtx && scannerCanvas) {
    scannerCtx.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);
  }
}


// Helper: Hex color to RGB string
function hexToRgb(hex) {
  // Remove hash
  hex = hex.replace("#", "");
  
  // Expand shorthand e.g. "03F" to "0033FF"
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `${r}, ${g}, ${b}`;
}
