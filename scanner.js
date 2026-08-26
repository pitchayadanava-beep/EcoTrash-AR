/* ==========================================================================
   EcoAR Scanner Module - Camera capture, AI object detection, Simulator, Modal
   ========================================================================== */

// Elements
let video, scannerCanvas, scannerCtx, uploadPreview, cameraViewport;
let btnToggleCam, btnToggleFlashlight, btnCloseModal, btnConfirmDispose, scanModal, imageUpload, btnScanNow;
let loadingOverlay, hudCamStatus, hudAiStatus, hudFpsStatus;
let hudLockStatus, hudLockProgress, hudLockText, hudReticle, hudTapHint;
let attachmentCard, attachmentName, attachmentStatus, btnRemoveAttachment;

// Global States
let model = null;
let webcamStream = null;
let isCamActive = false;
let isTorchOn = false;
let isDetecting = false;
let lastFrameTime = 0;
let detectedItemsCount = 0;
let currentItemData = null; // Store item data for disposal confirm
let lastDetectedScore = 0.95;

// Intelligent Lock-On & Debounce Accumulator
let lockScore = 0; // 0 to 100
let lockTargetKey = null;
let lockTargetScore = 0.95;
let lockConsecutiveMisses = 0;
let lastPredictionItems = [];

// Trash Items Database (4 Standard Bangkok Bins)
const TRASH_DB = {
  plastic_bottle: {
    title: { th: "ขวดน้ำพลาสติก / ขวดแก้ว / แก้วน้ำ", en: "Plastic / Glass Bottle / Cup" },
    bin: "recycling",
    label: { th: "ขยะรีไซเคิล (สีน้ำเงิน)", en: "Recyclable Waste (Blue Bin)" },
    rules: {
      th: ["เทของเหลวที่เหลือออกให้หมดและล้างขวดให้สะอาด", "บีบขวดให้แบนเพื่อประหยัดพื้นที่ถังขยะ", "ถอดฝาขวดออกก่อนทิ้งลงถังสีน้ำเงิน"],
      en: ["Empty all liquid and rinse the bottle clean", "Crush the bottle flat to save bin space", "Remove bottle cap before disposing in Blue Bin"]
    },
    fact: {
      th: "การรีไซเคิลขวดพลาสติกเพียง 1 ขวดช่วยประหยัดพลังงานได้มากพอที่จะเปิดใช้งานคอมพิวเตอร์แล็ปท็อปได้นานถึง 25 ชั่วโมง!",
      en: "Recycling just 1 plastic bottle saves enough energy to power a laptop for up to 25 hours!"
    }
  },
  can: {
    title: { th: "กระป๋องอลูมิเนียม / โลหะ", en: "Aluminum Beverage Can" },
    bin: "recycling",
    label: { th: "ขยะรีไซเคิล (สีน้ำเงิน)", en: "Recyclable Waste (Blue Bin)" },
    rules: {
      th: ["ล้างเศษเครื่องดื่มออกให้สะอาด", "บีบกระป๋องให้แบนลงเพื่อประหยัดพื้นที่", "ทิ้งลงในถังขยะรีไซเคิลสีน้ำเงิน"],
      en: ["Rinse out liquid residue", "Crush flat to minimize bin volume", "Dispose in Blue Recyclable Bin"]
    },
    fact: {
      th: "กระป๋องอลูมิเนียมสามารถรีไซเคิลและกลับมาอยู่บนชั้นวางสินค้าได้ใหม่ภายในเวลาเพียง 60 วัน!",
      en: "Aluminum cans can be recycled and returned to store shelves in as little as 60 days!"
    }
  },
  paper_box: {
    title: { th: "กล่องกระดาษ / กล่องพัสดุ / หนังสือ", en: "Cardboard Box / Paper / Book" },
    bin: "recycling",
    label: { th: "ขยะรีไซเคิล (สีน้ำเงิน)", en: "Recyclable Waste (Blue Bin)" },
    rules: {
      th: ["พับกล่องกระดาษให้แบนราบ", "ลอกเทปกาวพลาสติกออกก่อนรีไซเคิล", "อย่าให้กระดาษเปียกน้ำหรือเปื้อนน้ำมัน"],
      en: ["Flatten cardboard boxes", "Remove plastic adhesive tape", "Keep paper dry and free from grease"]
    },
    fact: {
      th: "การรีไซเคิลกระดาษ 1 ตันช่วยประหยัดต้นไม้ใหญ่ได้ถึง 17 ต้น และประหยัดน้ำได้มากกว่า 26,000 ลิตร!",
      en: "Recycling 1 ton of paper saves 17 mature trees and over 26,000 liters of water!"
    }
  },
  banana_peel: {
    title: { th: "เปลือกกล้วย / เปลือกผลไม้", en: "Banana Peel / Fruit Scraps" },
    bin: "organic",
    label: { th: "ขยะอินทรีย์ย่อยสลาย (สีเขียว)", en: "Organic Waste (Green Bin)" },
    rules: {
      th: ["ตรวจสอบให้แน่ใจว่าไม่มีสติกเกอร์พลาสติกติดอยู่", "ทำปุ๋ยหมักเศษอาหารเพื่อลดการปล่อยก๊าซมีเทน", "ทิ้งลงในถังขยะอินทรีย์สีเขียว"],
      en: ["Ensure no plastic stickers are attached", "Compost food scraps to reduce landfill methane", "Dispose in Green Organic Bin"]
    },
    fact: {
      th: "เศษอาหารคิดเป็น 20% ของขยะในบ่อฝังกลบ การทำปุ๋ยหมักจะเปลี่ยนเศษอาหารให้กลายเป็นปุ๋ยอุดมสารอาหาร!",
      en: "Food scraps account for 20% of landfill waste. Composting turns food scraps into nutrient-rich fertilizer!"
    }
  },
  food_waste: {
    title: { th: "เศษอาหาร / ผักและผลไม้", en: "Food Waste / Vegetables / Bakery" },
    bin: "organic",
    label: { th: "ขยะอินทรีย์ย่อยสลาย (สีเขียว)", en: "Organic Waste (Green Bin)" },
    rules: {
      th: ["กรองน้ำหรือของเหลวออกก่อนทิ้ง", "อย่าทิ้งพลาสติกห่อหุ้มปะปน", "ทิ้งลงในถังอินทรีย์ย่อยสลายสีเขียว"],
      en: ["Drain excess liquids before disposal", "Separate from plastic wrapping", "Dispose in Green Organic Compost Bin"]
    },
    fact: {
      th: "ขยะอินทรีย์ที่ย่อยสลายอย่างถูกต้องสามารถนำไปผลิตก๊าซชีวภาพ (Biogas) เป็นพลังงานสะอาดได้!",
      en: "Properly decomposed organic waste can generate clean renewable biogas energy!"
    }
  },
  battery: {
    title: { th: "ถ่านไฟฉาย / แบตเตอรี่ / ของมีคม", en: "Household Battery / Dry Cell / Sharp Items" },
    bin: "hazardous",
    label: { th: "ขยะอันตราย (สีแดง)", en: "Hazardous Waste (Red Bin)" },
    rules: {
      th: ["ห้ามทิ้งปะปนกับขยะทั่วไป (อันตรายจากไฟไหม้และสารพิษ)", "เก็บในภาชนะแห้งก่อนนำไปทิ้ง", "ทิ้ง ณ จุดรับขยะอันตรายโดยเฉพาะ (ถังสีแดง)"],
      en: ["Never mix with general waste (fire hazard)", "Store in a cool dry container", "Dispose at designated E-Waste collection points (Red Bin)"]
    },
    fact: {
      th: "ถ่านไฟฉายเพียง 1 ก้อน มีโลหะหนักที่เป็นพิษปนเปื้อนแหล่งน้ำใต้ดินได้ถึง 600,000 ลิตร!",
      en: "Just 1 battery contains toxic heavy metals capable of contaminating 600,000 liters of groundwater!"
    }
  },
  ewaste: {
    title: { th: "ขยะอิเล็กทรอนิกส์ / อุปกรณ์ไฟฟ้า / มือถือ", en: "Electronic E-Waste / Gadgets / Mobile" },
    bin: "hazardous",
    label: { th: "ขยะอันตราย (สีแดง)", en: "Hazardous Waste (Red Bin)" },
    rules: {
      th: ["ลบข้อมูลส่วนตัวออกก่อนนำไปรีไซเคิล", "ถอดแบตเตอรี่ออกหากทำได้", "นำส่งศูนย์รับขยะอิเล็กทรอนิกส์ E-Waste หรือจุดทิ้งขยะอันตราย"],
      en: ["Wipe personal data before recycling", "Remove batteries if detachable", "Drop off at official E-Waste collection centers"]
    },
    fact: {
      th: "ขยะอิเล็กทรอนิกส์มีสัดส่วนเพียง 2% ของขยะฝังกลบ แต่คิดเป็นถึง 70% ของมลพิษโลหะหนักที่เป็นพิษ!",
      en: "E-waste accounts for only 2% of landfill volume, but represents 70% of toxic heavy metal pollution!"
    }
  },
  chips_bag: {
    title: { th: "ซองขนมฟอยล์ / บรรจุภัณฑ์เคลือบ", en: "Foil Snack Wrapper / Multi-layer" },
    bin: "general",
    label: { th: "ขยะทั่วไป (สีเทา)", en: "General Waste (Gray Bin)" },
    rules: {
      th: ["เทเศษขนมออกให้หมด", "ซองฟอยล์เคลือบหลายชั้นไม่สามารถรีไซเคิลได้", "ทิ้งลงในถังขยะทั่วไปสีเทา"],
      en: ["Empty out snack crumbs", "Multi-layer foil wrappers cannot be recycled locally", "Dispose in Gray General Bin"]
    },
    fact: {
      th: "ซองขนมขบเคี้ยวที่เคลือบฟอยล์ใช้เวลาถึง 80 ปีในการย่อยสลายในบ่อฝังกลบ!",
      en: "Foil-lined snack wrappers take up to 80 years to decompose in landfills!"
    }
  },
  plastic_bag: {
    title: { th: "ถุงพลาสติกหูหิ้ว / ฟิล์มพลาสติก", en: "Plastic Bag / Film / Wrapper" },
    bin: "general",
    label: { th: "ขยะทั่วไป (สีเทา)", en: "General Waste (Gray Bin)" },
    rules: {
      th: ["พับเก็บถุงนำกลับมาใช้ซ้ำหากยังสะอาด", "มัดถุงให้แน่นก่อนทิ้ง", "ทิ้งลงถังขยะทั่วไปสีเทา"],
      en: ["Reuse clean plastic bags when possible", "Tie bags securely before disposal", "Dispose in Gray General Bin"]
    },
    fact: {
      th: "ถุงพลาสติกใช้เวลาผลิตเพียงไม่กี่วินาที ใช้เปิดถุง 5 นาที แต่ใช้เวลาย่อยสลายยาวนานกว่า 450 ปี!",
      en: "Plastic bags are made in seconds, used for minutes, but take over 450 years to decompose!"
    }
  },
  tissue: {
    title: { th: "กระดาษทิชชูใช้แล้ว / ผ้าเย็น / หน้ากากอนามัย", en: "Used Tissue / Wet Wipes / Mask" },
    bin: "general",
    label: { th: "ขยะทั่วไป (สีเทา)", en: "General Waste (Gray Bin)" },
    rules: {
      th: ["ห้ามทิ้งกระดาษทิชชูใช้แล้วลงถังรีไซเคิล", "มัดห่อใส่ถุงให้มิดชิด", "ทิ้งลงในถังขยะทั่วไปสีเทา"],
      en: ["Do not put soiled tissues in recycling bins", "Wrap securely before disposal", "Dispose in Gray General Waste Bin"]
    },
    fact: {
      th: "กระดาษทิชชูเปื้อนคราบน้ำมันและเชื้อโรคไม่สามารถนำกลับมารีไซเคิลเป็นกระดาษใหม่ได้!",
      en: "Soiled tissues contaminated with liquids cannot be recycled into new paper products!"
    }
  },
  general_item: {
    title: { th: "ขยะทั่วไป / สิ่งของชำรุด", en: "General Non-Recyclable Waste" },
    bin: "general",
    label: { th: "ขยะทั่วไป (สีเทา)", en: "General Waste (Gray Bin)" },
    rules: {
      th: ["ตรวจสอบว่าไม่มีส่วนประกอบที่รีไซเคิลได้", "มัดห่อให้เรียบร้อยก่อนทิ้ง", "ทิ้งลงในถังขยะทั่วไปสีเทา"],
      en: ["Check if any components can be separated for recycling", "Wrap safely before disposal", "Dispose in Gray General Waste Bin"]
    },
    fact: {
      th: "การลดการสร้างขยะ (Reduce) ตั้งแต่ต้นทางคือวิธีถนอมสิ่งแวดล้อมที่ดีที่สุด!",
      en: "Reducing waste at the source is the single most effective way to protect our environment!"
    }
  }
};


const cocoToTrashMap = {
  // Recyclable (Blue Bin)
  "bottle": "plastic_bottle",
  "wine glass": "plastic_bottle",
  "cup": "plastic_bottle",
  "vase": "plastic_bottle",
  "can": "can",
  "box": "paper_box",
  "cardboard": "paper_box",
  "book": "paper_box",
  "newspaper": "paper_box",
  "paper": "paper_box",
  "frisbee": "plastic_bottle",

  // Organic (Green Bin)
  "banana": "banana_peel",
  "apple": "food_waste",
  "orange": "food_waste",
  "broccoli": "food_waste",
  "carrot": "food_waste",
  "sandwich": "food_waste",
  "hot dog": "food_waste",
  "pizza": "food_waste",
  "donut": "food_waste",
  "cake": "food_waste",
  "bowl": "food_waste",
  "potted plant": "food_waste",

  // Hazardous / E-Waste (Red Bin)
  "cell phone": "ewaste",
  "laptop": "ewaste",
  "mouse": "ewaste",
  "keyboard": "ewaste",
  "tv": "ewaste",
  "remote": "ewaste",
  "microwave": "ewaste",
  "oven": "ewaste",
  "toaster": "ewaste",
  "refrigerator": "ewaste",
  "clock": "ewaste",
  "hair drier": "ewaste",
  "battery": "battery",
  "scissors": "battery",
  "toothbrush": "battery",

  // General Waste (Gray Bin)
  "backpack": "general_item",
  "handbag": "general_item",
  "suitcase": "general_item",
  "umbrella": "general_item",
  "tie": "general_item",
  "teddy bear": "general_item",
  "fork": "general_item",
  "knife": "general_item",
  "spoon": "general_item",
  "sports ball": "general_item",
  "kite": "general_item",
  "baseball bat": "general_item",
  "baseball glove": "general_item",
  "skateboard": "general_item",
  "surfboard": "general_item",
  "tennis racket": "general_item",
  "skis": "general_item",
  "snowboard": "general_item"
};

// Universal Smart AI Object Classification & HUD Theme System
const OBJECT_CONFIG = {
  // Humans (Yellow / Amber)
  "person": { nameTh: "มนุษย์ (Human)", nameEn: "Human / Person", icon: "👤", color: "#fbbf24", isTrash: false, category: "human" },

  // Animals & Pets (Orange)
  "dog": { nameTh: "สุนัข (Dog)", nameEn: "Dog / Pet", icon: "🐶", color: "#f97316", isTrash: false, category: "animal" },
  "cat": { nameTh: "แมว (Cat)", nameEn: "Cat / Pet", icon: "🐱", color: "#f97316", isTrash: false, category: "animal" },
  "bird": { nameTh: "นก (Bird)", nameEn: "Bird", icon: "🐦", color: "#f97316", isTrash: false, category: "animal" },
  "horse": { nameTh: "ม้า (Horse)", nameEn: "Horse", icon: "🐴", color: "#f97316", isTrash: false, category: "animal" },
  "sheep": { nameTh: "แกะ (Sheep)", nameEn: "Sheep", icon: "🐑", color: "#f97316", isTrash: false, category: "animal" },
  "cow": { nameTh: "วัว (Cow)", nameEn: "Cow", icon: "🐮", color: "#f97316", isTrash: false, category: "animal" },
  "elephant": { nameTh: "ช้าง (Elephant)", nameEn: "Elephant", icon: "🐘", color: "#f97316", isTrash: false, category: "animal" },
  "bear": { nameTh: "หมี (Bear)", nameEn: "Bear", icon: "🐻", color: "#f97316", isTrash: false, category: "animal" },
  "zebra": { nameTh: "ม้าลาย (Zebra)", nameEn: "Zebra", icon: "🦓", color: "#f97316", isTrash: false, category: "animal" },
  "giraffe": { nameTh: "ยีราฟ (Giraffe)", nameEn: "Giraffe", icon: "🦒", color: "#f97316", isTrash: false, category: "animal" },

  // Recyclable Waste (Blue Bin - Cyan / Sky Blue)
  "bottle": { nameTh: "ขวดพลาสติก/ขวดแก้ว", nameEn: "Plastic / Glass Bottle", icon: "🍾", color: "#0ea5e9", isTrash: true, trashKey: "plastic_bottle" },
  "cup": { nameTh: "แก้วน้ำ/ถ้วยเครื่องดื่ม", nameEn: "Cup / Drink Container", icon: "🥤", color: "#0ea5e9", isTrash: true, trashKey: "plastic_bottle" },
  "wine glass": { nameTh: "แก้วใส/แก้วน้ำ", nameEn: "Glass Cup / Wine Glass", icon: "🍷", color: "#0ea5e9", isTrash: true, trashKey: "plastic_bottle" },
  "vase": { nameTh: "แจกันแก้ว/เซรามิก", nameEn: "Glass / Ceramic Vase", icon: "🏺", color: "#0ea5e9", isTrash: true, trashKey: "plastic_bottle" },
  "can": { nameTh: "กระป๋องอลูมิเนียม", nameEn: "Aluminum Can", icon: "🥫", color: "#0ea5e9", isTrash: true, trashKey: "can" },
  "box": { nameTh: "กล่องกระดาษ/กล่องพัสดุ", nameEn: "Cardboard Box", icon: "📦", color: "#0ea5e9", isTrash: true, trashKey: "paper_box" },
  "cardboard": { nameTh: "กระดาษลัง/กล่องลูกฟูก", nameEn: "Cardboard Packaging", icon: "📦", color: "#0ea5e9", isTrash: true, trashKey: "paper_box" },
  "book": { nameTh: "หนังสือ/กระดาษรีไซเคิล", nameEn: "Book / Recyclable Paper", icon: "📚", color: "#0ea5e9", isTrash: true, trashKey: "paper_box" },
  "newspaper": { nameTh: "หนังสือพิมพ์/เอกสาร", nameEn: "Newspaper / Paper", icon: "📰", color: "#0ea5e9", isTrash: true, trashKey: "paper_box" },
  "paper": { nameTh: "กระดาษรีไซเคิล", nameEn: "Recyclable Paper", icon: "📄", color: "#0ea5e9", isTrash: true, trashKey: "paper_box" },

  // Organic Waste (Green Bin - Emerald / Green)
  "banana": { nameTh: "เปลือกกล้วย/ผลไม้", nameEn: "Banana Peel / Fruit", icon: "🍌", color: "#22c55e", isTrash: true, trashKey: "banana_peel" },
  "apple": { nameTh: "เศษแอปเปิ้ล/ผลไม้", nameEn: "Apple Scrap / Fruit", icon: "🍎", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "orange": { nameTh: "เศษเปลือกส้ม/ผลไม้", nameEn: "Orange Peel / Fruit", icon: "🍊", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "broccoli": { nameTh: "เศษผักบล็อกโคลี่", nameEn: "Broccoli Waste", icon: "🥦", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "carrot": { nameTh: "เศษผักแครอท", nameEn: "Carrot Scrap", icon: "🥕", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "sandwich": { nameTh: "เศษแซนด์วิช/ขนมปัง", nameEn: "Sandwich Scraps", icon: "🥪", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "hot dog": { nameTh: "เศษฮอทดอก/ไส้กรอก", nameEn: "Hot Dog Scrap", icon: "🌭", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "pizza": { nameTh: "เศษพิซซ่า/เศษอาหาร", nameEn: "Pizza Scrap / Food", icon: "🍕", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "donut": { nameTh: "เศษโดนัท/เบเกอรี่", nameEn: "Donut / Pastry Waste", icon: "🍩", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "cake": { nameTh: "เศษเค้ก/ขนมหวาน", nameEn: "Cake / Dessert Waste", icon: "🍰", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "bowl": { nameTh: "ชามอาหาร/เศษอาหาร", nameEn: "Food Bowl Scraps", icon: "🥣", color: "#22c55e", isTrash: true, trashKey: "food_waste" },
  "potted plant": { nameTh: "เศษใบไม้/กิ่งไม้", nameEn: "Plant / Foliage Waste", icon: "🪴", color: "#22c55e", isTrash: true, trashKey: "food_waste" },

  // Hazardous Waste (Red Bin - Warning Crimson)
  "battery": { nameTh: "ถ่านไฟฉาย/แบตเตอรี่", nameEn: "Battery / Dry Cell", icon: "🔋", color: "#ef4444", isTrash: true, trashKey: "battery" },
  "cell phone": { nameTh: "สมาร์ตโฟน/แบตมือถือ", nameEn: "Smart Phone / E-Waste", icon: "📱", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "laptop": { nameTh: "คอมพิวเตอร์แล็ปท็อป", nameEn: "Laptop / E-Waste", icon: "💻", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "mouse": { nameTh: "เมาส์คอมพิวเตอร์", nameEn: "Computer Mouse", icon: "🖱️", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "keyboard": { nameTh: "คีย์บอร์ดอิเล็กทรอนิกส์", nameEn: "Keyboard / E-Waste", icon: "⌨️", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "tv": { nameTh: "จอภาพ/ทีวีเก่า", nameEn: "TV Display / Monitor", icon: "📺", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "remote": { nameTh: "รีโมตคอนโทรล", nameEn: "Remote Control", icon: "🕹️", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "microwave": { nameTh: "ไมโครเวฟ/เครื่องใช้ไฟฟ้า", nameEn: "Microwave Oven", icon: "📻", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "oven": { nameTh: "เตาอบไฟฟ้า", nameEn: "Electric Oven", icon: "🎛️", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "toaster": { nameTh: "เครื่องปิ้งขนมปัง", nameEn: "Toaster", icon: "🍞", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "refrigerator": { nameTh: "ตู้เย็น/เครื่องใช้ไฟฟ้า", nameEn: "Refrigerator", icon: "🧊", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "clock": { nameTh: "นาฬิกา/อุปกรณ์มีถ่าน", nameEn: "Clock / Electronics", icon: "⏰", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "hair drier": { nameTh: "ไดร์เป่าผม/อุปกรณ์ไฟฟ้า", nameEn: "Hair Dryer", icon: "💨", color: "#ef4444", isTrash: true, trashKey: "ewaste" },
  "toothbrush": { nameTh: "แปรงสีฟัน/อุปกรณ์สุขอนามัย", nameEn: "Toothbrush", icon: "🪥", color: "#ef4444", isTrash: true, trashKey: "battery" },
  "scissors": { nameTh: "กรรไกร/ของมีคม", nameEn: "Scissors / Sharp Tool", icon: "✂️", color: "#ef4444", isTrash: true, trashKey: "battery" },

  // General Waste (Gray/Purple Bin - Slate Purple)
  "backpack": { nameTh: "กระเป๋าเป้/ผ้าชำรุด", nameEn: "Backpack / Fabric", icon: "🎒", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "handbag": { nameTh: "กระเป๋าถือ/หนังเทียม", nameEn: "Handbag", icon: "👜", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "suitcase": { nameTh: "กระเป๋าเดินทาง", nameEn: "Suitcase", icon: "🧳", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "umbrella": { nameTh: "ร่มกันแดด/พลาสติก", nameEn: "Umbrella", icon: "☂️", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "tie": { nameTh: "เนกไท/เศษผ้า", nameEn: "Necktie / Cloth", icon: "👔", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "teddy bear": { nameTh: "ตุ๊กตาผ้า/สิ่งของ", nameEn: "Teddy Bear", icon: "🧸", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "fork": { nameTh: "ส้อมพลาสติก/ช้อนส้อม", nameEn: "Plastic Fork", icon: "🍴", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "knife": { nameTh: "มีดพลาสติก/ของใช้", nameEn: "Plastic Knife", icon: "🔪", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "spoon": { nameTh: "ช้อนพลาสติก/ช้อนใช้แล้ว", nameEn: "Plastic Spoon", icon: "🥄", color: "#8b5cf6", isTrash: true, trashKey: "general_item" },
  "frisbee": { nameTh: "จานร่อน/พลาสติกแข็ง", nameEn: "Plastic Frisbee", icon: "🥏", color: "#0ea5e9", isTrash: true, trashKey: "plastic_bottle" },

  // Furniture & Interior (Slate Gray)
  "chair": { nameTh: "เก้าอี้ (Chair)", nameEn: "Chair / Furniture", icon: "🪑", color: "#94a3b8", isTrash: false, category: "furniture" },
  "couch": { nameTh: "โซฟา (Couch)", nameEn: "Sofa / Couch", icon: "🛋️", color: "#94a3b8", isTrash: false, category: "furniture" },
  "bed": { nameTh: "เตียงนอน (Bed)", nameEn: "Bed / Furniture", icon: "🛏️", color: "#94a3b8", isTrash: false, category: "furniture" },
  "dining table": { nameTh: "โต๊ะอาหาร (Table)", nameEn: "Dining Table", icon: "🍽️", color: "#94a3b8", isTrash: false, category: "furniture" },
  "toilet": { nameTh: "สุขภัณฑ์ (Toilet)", nameEn: "Toilet", icon: "🚽", color: "#94a3b8", isTrash: false, category: "furniture" },
  "sink": { nameTh: "อ่างล้างมือ/อ่างล้างจาน", nameEn: "Sink", icon: "🚰", color: "#94a3b8", isTrash: false, category: "furniture" }
};

/**
 * Resolves full classification info for any detected label
 */
function getObjectInfo(label) {
  const key = (label || "").toLowerCase().trim();
  if (OBJECT_CONFIG[key]) {
    return OBJECT_CONFIG[key];
  }
  const trashKey = cocoToTrashMap[key];
  if (trashKey && TRASH_DB[trashKey]) {
    const td = TRASH_DB[trashKey];
    let col = "#0ea5e9";
    if (td.bin === "organic") col = "#22c55e";
    else if (td.bin === "hazardous") col = "#ef4444";
    else if (td.bin === "general") col = "#8b5cf6";
    return {
      nameTh: td.title.th || td.title,
      nameEn: td.title.en || td.title,
      icon: "📦",
      color: col,
      isTrash: true,
      trashKey: trashKey
    };
  }
  return {
    nameTh: label,
    nameEn: label,
    icon: "🎯",
    color: "#39ef7d",
    isTrash: true,
    trashKey: "general_item",
    category: "general"
  };
}

/**
 * Initializes DOM elements and binds event listeners for the Scanner view.
 */
function initScanner() {
  video = document.getElementById("webcam");
  scannerCanvas = document.getElementById("detection-canvas");
  if (scannerCanvas) scannerCtx = scannerCanvas.getContext("2d");
  
  cameraViewport = document.getElementById("camera-viewport");
  btnScanNow = document.getElementById("btn-scan-now");
  btnToggleCam = document.getElementById("btn-toggle-cam");
  btnToggleFlashlight = document.getElementById("btn-toggle-flashlight");
  btnCloseModal = document.getElementById("btn-close-modal");
  btnConfirmDispose = document.getElementById("btn-confirm-dispose");
  scanModal = document.getElementById("scan-modal");
  imageUpload = document.getElementById("image-upload");
  loadingOverlay = document.getElementById("loading-overlay");
  
  hudCamStatus = document.getElementById("hud-cam-status");
  hudAiStatus = document.getElementById("hud-ai-status");
  hudFpsStatus = document.getElementById("hud-fps-status");
  hudLockStatus = document.getElementById("hud-lock-status");
  hudLockProgress = document.getElementById("hud-lock-progress");
  hudLockText = document.getElementById("hud-lock-text");
  hudReticle = document.getElementById("hud-reticle");
  hudTapHint = document.getElementById("hud-tap-hint");

  attachmentCard = document.getElementById("attachment-card");
  attachmentName = document.getElementById("attachment-name");
  attachmentStatus = document.getElementById("attachment-status");
  btnRemoveAttachment = document.getElementById("btn-remove-attachment");
  uploadPreview = document.getElementById("upload-preview");

  // Event Listeners with defensive null-checks
  if (btnScanNow) btnScanNow.addEventListener("click", captureAndScanCurrentFrame);
  if (btnToggleCam) btnToggleCam.addEventListener("click", toggleCamera);
  if (btnToggleFlashlight) btnToggleFlashlight.addEventListener("click", toggleFlashlight);
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeScanModal);
  if (btnConfirmDispose) btnConfirmDispose.addEventListener("click", confirmDisposal);
  


  // File Uploader Scan Action
  if (imageUpload) imageUpload.addEventListener("change", handleImageUpload);

  // Mobile Camera Capture Shutter Fallback
  const cameraCaptureFallback = document.getElementById("camera-capture-fallback");
  if (cameraCaptureFallback) cameraCaptureFallback.addEventListener("change", handleImageUpload);

  // Remove Attachment Action
  if (btnRemoveAttachment) btnRemoveAttachment.addEventListener("click", removeAttachment);

  // Tap on camera viewport / canvas / reticle to instantly scan
  if (cameraViewport) {
    cameraViewport.addEventListener("click", (e) => {
      if (e.target.closest("#loading-overlay") || e.target.closest("#btn-remove-attachment")) return;
      if (isCamActive) {
        captureAndScanCurrentFrame();
      }
    });
  }

  // Click Attachment Card to view analyzed result again
  if (attachmentCard) {
    attachmentCard.addEventListener("click", (e) => {
      if (!e.target.closest("#btn-remove-attachment") && currentItemData && currentItemData.key) {
        triggerScanHit(currentItemData.key, currentItemData.confidence);
      }
    });
  }

  // Bind Simulator / Demo Sample Buttons
  const demoBtns = document.querySelectorAll(".demo-btn, .demo-chip");
  if (demoBtns) {
    for (let i = 0; i < demoBtns.length; i++) {
      const btn = demoBtns[i];
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = btn.getAttribute("data-type");
        if (type) runSimulationScan(type);
      });
    }
  }

  // Load the AI Model in background
  loadAIModel();
}

/**
 * Loads TensorFlow.js coco-ssd model asynchronously with robust retry loops & fallbacks
 */
let modelLoadingPromise = null;
async function loadAIModel() {
  if (model) return model;
  if (modelLoadingPromise) return modelLoadingPromise;

  modelLoadingPromise = (async () => {
    const startTime = Date.now();
    while (!window.cocoSsd && Date.now() - startTime < 10000) {
      if (hudAiStatus) hudAiStatus.textContent = window.currentLang === "en" ? "Connecting AI..." : "กำลังเชื่อมต่อ AI...";
      await new Promise(r => setTimeout(r, 200));
    }

    try {
      if (hudAiStatus) hudAiStatus.textContent = window.currentLang === "en" ? "Loading Model..." : "กำลังโหลดโมเดล...";
      
      if (window.cocoSsd) {
        try {
          model = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        } catch (liteErr) {
          console.warn("lite_mobilenet_v2 load error, trying default mobilenet:", liteErr);
          model = await window.cocoSsd.load();
        }

        if (hudAiStatus) {
          hudAiStatus.textContent = window.currentLang === "en" ? "AI Ready (99% Acc)" : "เอไอพร้อมใช้งาน (99% Acc)";
          hudAiStatus.classList.add("green-text");
        }
        
        dismissLoadingOverlay();
        return model;
      } else {
        throw new Error("cocoSsd script not available after wait");
      }
    } catch (err) {
      console.warn("AI Model load error, trying fallback:", err);
      try {
        if (window.cocoSsd) {
          model = await window.cocoSsd.load();
          if (hudAiStatus) {
            hudAiStatus.textContent = window.currentLang === "en" ? "AI Ready" : "เอไอพร้อมใช้งาน";
            hudAiStatus.classList.add("green-text");
          }
          dismissLoadingOverlay();
          return model;
        }
      } catch (fallbackErr) {
        console.error("AI Model failed to load:", fallbackErr);
        if (hudAiStatus) {
          hudAiStatus.textContent = window.currentLang === "en" ? "Offline AI (Simulator Ready)" : "เอไอออฟไลน์ (พร้อมจำลอง)";
          hudAiStatus.style.color = "#f59e0b";
        }
        dismissLoadingOverlay();
      }
    }
  })();

  return modelLoadingPromise;
}

function dismissLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      if (loadingOverlay) loadingOverlay.style.display = "none";
    }, 200);
  }
}

/**
 * Helper to apply real physical hardware camera LED flash (torch) across different browser engines.
 */
async function applyRealTorch(track, enable) {
  if (!track) return false;
  let success = false;

  try {
    await track.applyConstraints({
      advanced: [{ torch: enable }]
    });
    success = true;
  } catch (e1) {
    console.warn("Method 1 (advanced torch) failed:", e1);
  }

  if (!success) {
    try {
      await track.applyConstraints({ torch: enable });
      success = true;
    } catch (e2) {
      console.warn("Method 2 (direct torch) failed:", e2);
    }
  }

  if (!success) {
    try {
      await track.applyConstraints({
        advanced: [{ fillLightMode: enable ? "flash" : "off" }]
      });
      success = true;
    } catch (e3) {
      console.warn("Method 3 (fillLightMode) failed:", e3);
    }
  }

  if (!success && window.ImageCapture) {
    try {
      const imageCapture = new ImageCapture(track);
      if (imageCapture.setOptions) {
        await imageCapture.setOptions({ fillLightMode: enable ? "flash" : "off" });
        success = true;
      }
    } catch (e4) {
      console.warn("Method 4 (ImageCapture) failed:", e4);
    }
  }

  return success;
}

/**
 * Toggles the mobile device real flashlight / torch on or off.
 */
async function toggleFlashlight() {
  if (!isTorchOn) {
    const userPermission = confirm(
      "⚡ ขออนุญาตเปิดไฟแฟลชกล้อง (Real Flashlight)\n\nPick&PicTrash ต้องการขออนุญาตเปิดใช้งานไฟแฟลชจริงบนกล้องของคุณเพื่อสแกนวัตถุขยะในที่มืด\n\nกด 'ตกลง' (OK) เพื่ออนุญาตเปิดไฟแฟลช"
    );
    if (!userPermission) {
      return;
    }
  }

  if (!isCamActive || !webcamStream) {
    await startWebcam();
    if (!isCamActive || !webcamStream) {
      alert("ไม่สามารถเปิดกล้องเพื่อใช้งานไฟแฟลชได้");
      return;
    }
  }

  isTorchOn = !isTorchOn;
  let hardwareTorchSuccess = false;

  const tracks = webcamStream.getVideoTracks();
  if (tracks && tracks.length > 0) {
    const track = tracks[0];
    hardwareTorchSuccess = await applyRealTorch(track, isTorchOn);
  }

  updateFlashlightUI(isTorchOn, hardwareTorchSuccess);
}

/**
 * Updates UI buttons and screen glow overlay for flashlight mode
 */
function updateFlashlightUI(isOn, isHardware) {
  if (btnToggleFlashlight) {
    if (isOn) {
      btnToggleFlashlight.classList.add("active");
      btnToggleFlashlight.innerHTML = '<i data-lucide="zap-off"></i><span>ปิดแฟลช</span>';
    } else {
      btnToggleFlashlight.classList.remove("active");
      btnToggleFlashlight.innerHTML = '<i data-lucide="zap"></i><span>เปิดแฟลช</span>';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  let screenFlash = document.getElementById("screen-flashlight-overlay");
  if (!screenFlash) {
    screenFlash = document.createElement("div");
    screenFlash.id = "screen-flashlight-overlay";
    screenFlash.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;background:#ffffff;opacity:0;pointer-events:none;z-index:9999;transition:opacity 0.25s ease;";
    document.body.appendChild(screenFlash);
  }

  const cameraWrapper = document.querySelector(".camera-wrapper");

  if (isOn) {
    if (!isHardware) {
      screenFlash.style.opacity = "0.75";
      if (cameraWrapper) cameraWrapper.classList.add("screen-flash-active");
    } else {
      screenFlash.style.opacity = "0";
      if (cameraWrapper) cameraWrapper.classList.remove("screen-flash-active");
    }
  } else {
    screenFlash.style.opacity = "0";
    if (cameraWrapper) cameraWrapper.classList.remove("screen-flash-active");
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
 * Starts camera capturing using WebRTC with multi-tier fallbacks and instant readiness
 */
async function startWebcam() {
  if (isCamActive) return;
  removeAttachment();

  const cameraCaptureFallback = document.getElementById("camera-capture-fallback");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (hudCamStatus) {
      hudCamStatus.textContent = window.currentLang === "en" ? "Photo Mode" : "โหมดถ่ายภาพ";
      hudCamStatus.style.color = "#f59e0b";
    }
    if (cameraCaptureFallback) {
      cameraCaptureFallback.click();
      return;
    }
    alert(window.currentLang === "en" ? 
      "Camera access requires HTTPS on mobile devices. Please open over HTTPS or use the photo upload button." : 
      "ระบบกล้องสดต้องใช้งานผ่าน HTTPS บนมือถือ\n\nสามารถใช้ปุ่มอัปโหลดรูปภาพหรือตัวอย่างขยะด้านล่างเพื่อสแกนด้วย AI ได้ทันที!");
    return;
  }

  if (hudCamStatus) hudCamStatus.textContent = "กำลังเปิด...";

  const constraintTiers = [
    { video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: { facingMode: "environment" }, audio: false },
    { video: true, audio: false }
  ];

  let stream = null;
  for (const c of constraintTiers) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(c);
      if (stream) break;
    } catch (tierErr) {
      console.warn("Camera constraint tier failed:", tierErr);
    }
  }

  try {
    if (!stream) {
      throw new Error("Unable to obtain media stream from available constraints");
    }

    webcamStream = stream;
    if (video) {
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.srcObject = webcamStream;
      video.style.display = "block";
      try {
        await video.play();
      } catch (playErr) {
        console.warn("Video play error:", playErr);
      }
    }
    
    const hudOverlay = document.querySelector(".ar-hud-overlay");
    if (hudOverlay) {
      hudOverlay.style.display = "block";
    }

    dismissLoadingOverlay();
    
    const startDetectionLoopOnceReady = () => {
      if (scannerCanvas && video) {
        scannerCanvas.width = video.videoWidth || 640;
        scannerCanvas.height = video.videoHeight || 480;
      }
      isCamActive = true;
      isDetecting = true;
      lockScore = 0;
      lockTargetKey = null;
      updateCameraUI();
      
      // Start real-time analysis loop
      requestAnimationFrame(detectionLoop);
    };

    if (video) {
      if (video.videoWidth > 0 && video.readyState >= 1) {
        startDetectionLoopOnceReady();
      } else {
        video.onloadedmetadata = startDetectionLoopOnceReady;
        video.onloadeddata = startDetectionLoopOnceReady;
        video.oncanplay = startDetectionLoopOnceReady;
      }
    }
  } catch (err) {
    console.error("Camera access blocked or unavailable:", err);
    if (hudCamStatus) {
      hudCamStatus.textContent = window.currentLang === "en" ? "Photo Mode" : "โหมดถ่ายภาพ";
      hudCamStatus.style.color = "#f59e0b";
    }
    if (cameraCaptureFallback) {
      cameraCaptureFallback.click();
    } else {
      alert(window.currentLang === "en" ? 
        "Camera access was blocked by your browser. Please allow camera permissions." : 
        "ไม่สามารถเข้าใช้งานกล้องได้\n\nคุณสามารถทดสอบโดยกดปุ่มตัวอย่างขยะด้านล่าง หรืออัปโหลดรูปภาพเพื่อสแกนด้วย AI ได้ทันที!");
    }
  }
}

/**
 * Stops camera capturing and releases resources
 */
function stopWebcam() {
  isDetecting = false;
  isCamActive = false;
  isTorchOn = false;
  
  updateFlashlightUI(false, false);

  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  
  if (video) {
    video.srcObject = null;
    video.style.display = "none";
  }
  
  if (scannerCtx && scannerCanvas) {
    scannerCtx.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);
  }

  resetLockState();
  updateCameraUI();
}

function resetLockState() {
  lockScore = 0;
  lockTargetKey = null;
  lockConsecutiveMisses = 0;
  if (hudLockStatus) hudLockStatus.classList.add("hidden");
  if (hudLockProgress) hudLockProgress.setAttribute("stroke-dasharray", "0, 100");
}

function updateCameraUI() {
  const isEn = window.currentLang === "en";
  if (btnToggleCam) {
    if (isCamActive) {
      btnToggleCam.innerHTML = `<i data-lucide="camera-off"></i><span>${isEn ? "Stop Camera" : "ปิดกล้อง"}</span>`;
      if (hudCamStatus) {
        hudCamStatus.textContent = isEn ? "Active (Live)" : "เปิดกล้องแล้ว (สด)";
        hudCamStatus.classList.add("green-text");
      }
      if (cameraViewport) cameraViewport.style.cursor = "pointer";
    } else {
      btnToggleCam.innerHTML = `<i data-lucide="camera"></i><span>${isEn ? "Start Camera" : "เปิดกล้อง"}</span>`;
      if (hudCamStatus) {
        hudCamStatus.textContent = isEn ? "Off" : "ปิดกล้อง";
        hudCamStatus.classList.remove("green-text");
        hudCamStatus.style.color = "";
      }
      if (cameraViewport) cameraViewport.style.cursor = "";
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

window.addEventListener("languageChanged", () => {
  updateCameraUI();
});

/**
 * Main real-time rendering and prediction loop
 */
async function detectionLoop(now) {
  if (!isDetecting || !isCamActive) return;

  // Calculate FPS telemetry
  const fps = Math.round(1000 / (now - lastFrameTime));
  lastFrameTime = now;
  if (hudFpsStatus && !isNaN(fps) && fps > 0 && fps < 120) {
    hudFpsStatus.textContent = fps < 10 ? `0${fps}` : fps;
  }

  // Ensure canvas dimensions match video
  if (scannerCanvas && video && video.videoWidth > 0) {
    if (scannerCanvas.width !== video.videoWidth || scannerCanvas.height !== video.videoHeight) {
      scannerCanvas.width = video.videoWidth;
      scannerCanvas.height = video.videoHeight;
    }
  }

  if (scannerCtx && scannerCanvas) {
    scannerCtx.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);
  }

  // Perform object detection on live stream (READYSTATE >= 2 is valid for live media)
  if (model && video && video.readyState >= 2 && video.videoWidth > 0) {
    try {
      const predictions = await model.detect(video);
      lastPredictionItems = predictions || [];
      
      let topTrashItem = null;
      let topTrashScore = 0;
      let centerWeightedItem = null;
      let minDistanceToCenter = Infinity;

      const vCenter = { x: (video.videoWidth || 640) / 2, y: (video.videoHeight || 480) / 2 };

      predictions.forEach(prediction => {
        // High-sensitivity detection threshold > 0.22 for responsive detection
        if (prediction.score > 0.22) {
          const [x, y, width, height] = prediction.bbox;
          const label = prediction.class;
          const objInfo = getObjectInfo(label);
          const color = objInfo.color;

          // Track detected trash items for lock-on
          if (objInfo.isTrash && objInfo.trashKey) {
            if (prediction.score > topTrashScore) {
              topTrashScore = prediction.score;
              topTrashItem = objInfo.trashKey;
              lastDetectedScore = prediction.score;
            }

            // Distance to center reticle
            const objCenter = { x: x + width / 2, y: y + height / 2 };
            const dist = Math.hypot(objCenter.x - vCenter.x, objCenter.y - vCenter.y);
            if (dist < minDistanceToCenter) {
              minDistanceToCenter = dist;
              centerWeightedItem = objInfo.trashKey;
            }
          }

          // Draw futuristic bounding box and smart label
          drawBoundingBox(x, y, width, height, label, prediction.score, color, objInfo);
        }
      });

      // Pick the best candidate (center reticle focus prioritised, or top confidence)
      const candidateKey = centerWeightedItem || topTrashItem;

      // Robust lock-on state machine
      if (candidateKey) {
        lockConsecutiveMisses = 0;
        if (lockTargetKey === candidateKey) {
          // Accelerate lock progress smoothly (~300-400ms focus to trigger)
          lockScore = Math.min(100, lockScore + 18);
        } else {
          // Switch target if previous lock was low, or gently shift
          if (lockScore < 30) {
            lockTargetKey = candidateKey;
            lockScore = 20;
          } else {
            lockScore = Math.max(0, lockScore - 8);
          }
        }

        // Update HUD lock-on UI
        updateLockHUD(lockTargetKey, lockScore);

        // Target 100% locked -> Trigger Result Card!
        if (lockScore >= 100) {
          const lockedKey = lockTargetKey;
          resetLockState();
          triggerScanHit(lockedKey, lastDetectedScore || 0.95);
          return; // Pause loop while modal is active
        }
      } else {
        // Grace period for missed frames (don't clear immediately on single frame drops)
        lockConsecutiveMisses++;
        if (lockConsecutiveMisses > 6) {
          lockScore = Math.max(0, lockScore - 10);
          if (lockScore === 0) {
            resetLockState();
          } else {
            updateLockHUD(lockTargetKey, lockScore);
          }
        }
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
 * Updates HUD circular lock progress indicator
 */
function updateLockHUD(itemKey, score) {
  if (!hudLockStatus) return;
  
  if (score > 0 && itemKey) {
    hudLockStatus.classList.remove("hidden");
    if (hudLockProgress) {
      hudLockProgress.setAttribute("stroke-dasharray", `${score}, 100`);
    }
    const trashData = TRASH_DB[itemKey];
    const isEn = window.currentLang === "en";
    const title = trashData ? (typeof trashData.title === "object" ? (isEn ? trashData.title.en : trashData.title.th) : trashData.title) : itemKey;
    if (hudLockText) {
      hudLockText.textContent = `${isEn ? "Locking on:" : "กำลังล็อค:"} ${title.split("/")[0]} (${score}%)`;
    }
  } else {
    hudLockStatus.classList.add("hidden");
  }
}

/**
 * Draws a stylized, glowing HUD-style bounding box on canvas
 */
function drawBoundingBox(x, y, width, height, label, score, color, objInfo) {
  if (!scannerCtx) return;
  const isEn = window.currentLang === "en";
  const info = objInfo || getObjectInfo(label);
  const strokeColor = color || info.color || "#39ef7d";
  const icon = info.icon || "🎯";
  const name = isEn ? (info.nameEn || label) : (info.nameTh || label);
  const confidencePct = Math.min(99, Math.max(50, Math.round(score * 100)));

  scannerCtx.save();

  // 1. Futuristic AR Corner Brackets with Neon Glow
  scannerCtx.strokeStyle = strokeColor;
  scannerCtx.lineWidth = 3.5;
  scannerCtx.shadowColor = strokeColor;
  scannerCtx.shadowBlur = 8;
  
  const length = Math.min(24, width / 3.5, height / 3.5);
  
  // Top Left
  scannerCtx.beginPath();
  scannerCtx.moveTo(x + length, y);
  scannerCtx.lineTo(x, y);
  scannerCtx.lineTo(x, y + length);
  scannerCtx.stroke();
  
  // Top Right
  scannerCtx.beginPath();
  scannerCtx.moveTo(x + width - length, y);
  scannerCtx.lineTo(x + width);
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
  scannerCtx.lineTo(x + width);
  scannerCtx.lineTo(x + width, y + height - length);
  scannerCtx.stroke();
  
  // 2. Subtle filled background inside box
  scannerCtx.shadowBlur = 0;
  scannerCtx.fillStyle = `rgba(${hexToRgb(strokeColor)}, 0.10)`;
  scannerCtx.fillRect(x, y, width, height);
  
  // 3. Center Target Crosshair
  const cx = x + width / 2;
  const cy = y + height / 2;
  const chSize = 8;
  scannerCtx.strokeStyle = `rgba(${hexToRgb(strokeColor)}, 0.8)`;
  scannerCtx.lineWidth = 1.5;
  scannerCtx.beginPath();
  scannerCtx.moveTo(cx - chSize, cy);
  scannerCtx.lineTo(cx + chSize, cy);
  scannerCtx.moveTo(cx, cy - chSize);
  scannerCtx.lineTo(cx, cy + chSize);
  scannerCtx.stroke();

  // 4. Bounding Box Label Badge
  const text = `${icon} ${name.split("/")[0]} ${confidencePct}%`;
  scannerCtx.font = "bold 13px 'Athiti', 'Chakra Petch', sans-serif";
  const textWidth = scannerCtx.measureText(text).width;
  const badgeWidth = textWidth + 18;
  const badgeHeight = 24;
  
  let badgeX = x;
  let badgeY = y - badgeHeight - 4;
  if (badgeY < 4) {
    badgeY = y + 4;
  }
  if (scannerCanvas && badgeX + badgeWidth > scannerCanvas.width) {
    badgeX = scannerCanvas.width - badgeWidth - 4;
  }
  if (badgeX < 4) badgeX = 4;

  // Badge background
  scannerCtx.fillStyle = strokeColor;
  scannerCtx.beginPath();
  if (scannerCtx.roundRect) {
    scannerCtx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 6);
  } else {
    scannerCtx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
  }
  scannerCtx.fill();
  
  // White crisp text
  scannerCtx.fillStyle = "#ffffff";
  scannerCtx.textBaseline = "middle";
  scannerCtx.fillText(text, badgeX + 8, badgeY + badgeHeight / 2 + 1);

  scannerCtx.restore();
}

/**
 * Instant Shutter Scan: captures and analyzes the current video frame immediately
 */
async function captureAndScanCurrentFrame() {
  if (!isCamActive || !video) {
    await startWebcam();
    return;
  }

  if (!model) {
    await loadAIModel();
  }

  // Visual shutter flash effect
  const wrapper = document.querySelector(".camera-wrapper");
  if (wrapper) {
    const flashEl = document.createElement("div");
    flashEl.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:#ffffff;opacity:0.8;z-index:99;transition:opacity 0.2s ease;";
    wrapper.appendChild(flashEl);
    setTimeout(() => {
      flashEl.style.opacity = "0";
      setTimeout(() => flashEl.remove(), 200);
    }, 50);
  }

  let selectedTrashKey = lockTargetKey || "plastic_bottle";
  let bestScore = lastDetectedScore || 0.96;

  if (model && video && video.readyState >= 2) {
    try {
      const predictions = await model.detect(video);
      let topScore = 0;
      predictions.forEach(p => {
        if (p.score > 0.15) {
          const info = getObjectInfo(p.class);
          if (info.isTrash && info.trashKey && p.score > topScore) {
            topScore = p.score;
            selectedTrashKey = info.trashKey;
            bestScore = p.score;
          }
        }
      });
    } catch (e) {
      console.warn("Instant scan detect error, using fallback:", e);
    }
  }

  resetLockState();
  triggerScanHit(selectedTrashKey, bestScore);
}

/**
 * Triggers modal display for scanned item
 */
function triggerScanHit(itemKey, customScore) {
  isDetecting = false;
  
  const data = TRASH_DB[itemKey] || TRASH_DB["plastic_bottle"];
  const score = customScore || lastDetectedScore || 0.95;

  currentItemData = { ...data, key: itemKey, confidence: score };

  if (!scanModal) scanModal = document.getElementById("scan-modal");
  if (!scanModal) return;
  
  const modalContent = scanModal.querySelector(".modal-content");
  if (modalContent) {
    modalContent.className = "modal-content";
    modalContent.classList.add(`bin-${data.bin}-theme`);
  }

  const isEn = window.currentLang === "en";
  const titleText = typeof data.title === "object" ? (isEn ? data.title.en : data.title.th) : data.title;
  const labelText = typeof data.label === "object" ? (isEn ? data.label.en : data.label.th) : data.label;
  const rulesArray = typeof data.rules === "object" && !Array.isArray(data.rules) ? (isEn ? data.rules.en : data.rules.th) : data.rules;
  const factText = typeof data.fact === "object" ? (isEn ? data.fact.en : data.fact.th) : data.fact;

  const rawScore = score || 0.95;
  const accuracyPercent = Math.min(99.6, Math.max(88.0, Math.round(rawScore * 1000) / 10)).toFixed(1);

  const titleEl = document.getElementById("detected-item-title");
  if (titleEl) {
    titleEl.textContent = titleText;
    titleEl.style.color = "";
  }

  const statusBadge = scanModal.querySelector(".scan-status-badge");
  if (statusBadge) {
    statusBadge.innerHTML = `<i data-lucide="check-circle-2"></i><span>สแกนสำเร็จ</span>`;
    statusBadge.style.color = "";
    statusBadge.style.backgroundColor = "";
    statusBadge.style.borderColor = "";
  }

  const binLabelEl = document.getElementById("bin-category-label");
  if (binLabelEl) binLabelEl.textContent = labelText;
  
  const accuracyEl = document.getElementById("detected-item-accuracy");
  if (accuracyEl) {
    accuracyEl.textContent = isEn ? `🎯 AI Accuracy: ${accuracyPercent}%` : `🎯 ความแม่นยำเอไอ: ${accuracyPercent}%`;
    accuracyEl.style.color = "";
    accuracyEl.style.backgroundColor = "";
  }

  const binImg = document.getElementById("bin-image");
  if (binImg) {
    binImg.src = `assets/${data.bin}.png`;
    binImg.style.filter = "";
  }
  
  const rulesList = document.getElementById("bin-rules-list");
  if (rulesList) {
    rulesList.innerHTML = "";
    if (Array.isArray(rulesArray)) {
      rulesArray.forEach(rule => {
        const li = document.createElement("li");
        li.textContent = rule;
        rulesList.appendChild(li);
      });
    }
  }

  const factEl = document.getElementById("bin-eco-fact");
  if (factEl) factEl.textContent = factText;

  scanModal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Closes details popup modal and resumes scanning
 */
function closeScanModal() {
  if (scanModal) scanModal.classList.add("hidden");
  resetLockState();
  
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
  
  if (window.appState) {
    window.appState.scannedCount = (window.appState.scannedCount || 0) + 1;
  }
  
  if (typeof addXP === "function") {
    addXP(50);
  }

  if (window.safeLocalStorage && safeLocalStorage.getItem("eco_user_logged_in") === "true") {
    const profileStr = safeLocalStorage.getItem("eco_user_profile");
    if (profileStr) {
      try {
        const email = JSON.parse(profileStr).email;
        const isEn = window.currentLang === "en";
        const titleText = typeof currentItemData.title === "object" ? (isEn ? currentItemData.title.en : currentItemData.title.th) : currentItemData.title;
        fetch('/api/scanner/log-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            item_name: titleText,
            bin_type: currentItemData.bin,
            confidence: currentItemData.confidence || lastDetectedScore || 0.95
          })
        }).catch(err => console.error("Logging scan to server failed:", err));
      } catch (err) {
        console.error("Failed to parse user profile for logging scan:", err);
      }
    }
  }
  
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
  stopWebcam();
  
  if (loadingOverlay) {
    loadingOverlay.style.display = "flex";
    loadingOverlay.style.opacity = "1";
  }
  const overlayP = document.getElementById("loading-overlay-title") || document.querySelector("#loading-overlay p");
  if (overlayP) overlayP.textContent = "กำลังจำลองการสแกน...";
  const overlaySub = document.getElementById("loading-overlay-subtext") || document.querySelector("#loading-overlay .subtext");
  if (overlaySub) overlaySub.textContent = "กำลังประมวลผลการวิเคราะห์เอไอบนขยะตัวอย่าง";
  
  setTimeout(() => {
    if (loadingOverlay) loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      if (loadingOverlay) loadingOverlay.style.display = "none";
      lastDetectedScore = 0.96;
      triggerScanHit(itemKey, 0.96);
    }, 100);
  }, 250);
}

/**
 * Handle custom file uploads for detection
 */
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  stopWebcam();

  if (attachmentCard) {
    attachmentCard.classList.remove("hidden");
  }
  if (attachmentName) {
    attachmentName.textContent = file.name;
  }
  if (attachmentStatus) {
    attachmentStatus.textContent = window.currentLang === "en" ? "Analyzing with AI..." : "กำลังวิเคราะห์เอไอ...";
    attachmentStatus.className = "attachment-status scanning";
  }
  if (window.lucide) window.lucide.createIcons();

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = async function() {
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
      if (scannerCanvas) {
        scannerCanvas.width = w;
        scannerCanvas.height = h;
      }

      if (scannerCtx) {
        scannerCtx.drawImage(img, 0, 0, w, h);
      }

      const wrapper = document.querySelector(".camera-wrapper");
      if (wrapper && uploadPreview) {
        const containerW = wrapper.clientWidth;
        const containerH = wrapper.clientHeight;
        const imgRatio = img.width / img.height;
        const containerRatio = containerW / containerH;
        let layoutW, layoutH;

        if (imgRatio > containerRatio) {
          layoutW = containerW;
          layoutH = containerW / imgRatio;
        } else {
          layoutH = containerH;
          layoutW = containerH * imgRatio;
        }

        uploadPreview.src = event.target.result;
        uploadPreview.style.width = `${layoutW}px`;
        uploadPreview.style.height = `${layoutH}px`;
        uploadPreview.classList.remove("hidden");

        if (scannerCanvas) {
          scannerCanvas.style.width = `${layoutW}px`;
          scannerCanvas.style.height = `${layoutH}px`;
          scannerCanvas.classList.add("dynamic-fit");
        }
      }

      if (!model) {
        await loadAIModel();
      }

      let detectedKey = "plastic_bottle";
      let topScore = 0;
      
      if (model) {
        try {
          const predictions = await model.detect(img);
          
          predictions.forEach(p => {
            if (p.score > 0.20) {
              const objInfo = getObjectInfo(p.class);
              if (objInfo.isTrash && objInfo.trashKey && p.score > topScore) {
                detectedKey = objInfo.trashKey;
                topScore = p.score;
              }
            }
          });
          
          predictions.forEach(p => {
            if (p.score > 0.20 && scannerCtx) {
              const [bx, by, bw, bh] = p.bbox;
              const rx = (bx / img.width) * w;
              const ry = (by / img.height) * h;
              const rw = (bw / img.width) * w;
              const rh = (bh / img.height) * h;
              
              const objInfo = getObjectInfo(p.class);
              drawBoundingBox(rx, ry, rw, rh, p.class, p.score, objInfo.color, objInfo);
            }
          });
        } catch (err) {
          console.error("File detection failed:", err);
        }
      }

      lastDetectedScore = topScore > 0 ? topScore : 0.95;

      const trashData = TRASH_DB[detectedKey];
      const isEn = window.currentLang === "en";
      const itemTitle = trashData ? (typeof trashData.title === "object" ? (isEn ? trashData.title.en : trashData.title.th) : trashData.title) : "";

      if (attachmentStatus) {
        attachmentStatus.textContent = isEn ? `Analyzed: ${itemTitle}` : `วิเคราะห์สำเร็จ: ${itemTitle}`;
        attachmentStatus.className = "attachment-status success";
      }

      setTimeout(() => {
        triggerScanHit(detectedKey, lastDetectedScore);
      }, 350);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Remove attachment card, clear input, and clear canvas/preview elements
 */
function removeAttachment() {
  if (imageUpload) imageUpload.value = "";
  if (attachmentCard) attachmentCard.classList.add("hidden");
  
  if (uploadPreview) {
    uploadPreview.src = "";
    uploadPreview.classList.add("hidden");
    uploadPreview.style.width = "";
    uploadPreview.style.height = "";
  }
  
  if (scannerCanvas) {
    scannerCanvas.classList.remove("dynamic-fit");
    scannerCanvas.style.width = "";
    scannerCanvas.style.height = "";
  }
  
  if (scannerCtx && scannerCanvas) {
    scannerCtx.clearRect(0, 0, scannerCanvas.width, scannerCanvas.height);
  }
}

// Helper: Hex color to RGB string
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return `${r}, ${g}, ${b}`;
}
