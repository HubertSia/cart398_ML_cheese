// ========== MACHINE LEARNING MODULE ==========
// automatic start + color + hair + skin tone (image‑only version)

const CONFIG = {
  WEBCAM_SIZE: 160,
  POSE_INTERVAL: 150,
  COLOR_THRESHOLD: 0.7,
  HAIR_THRESHOLD: 0.75,
  SKIN_THRESHOLD: 0.7,
  TRANSITION_SPEED: 0.05
};

let colorModel, hairModel, skinModel, webcam, poseDetector;
let poses = [];
let maxColorPredictions = 0,
  maxHairPredictions = 0,
  maxSkinPredictions = 0;

let currentColorCheese = "red";
let targetColorCheese = "red";
let currentHairCheese = "kinky";
let targetHairCheese = "kinky";
let currentSkinCheese = "light";
let targetSkinCheese = "light";

let colorTransition = 1.0;
let hairTransition = 1.0;
let skinTransition = 1.0;

let isRunning = false;
let poseModelLoaded = false;
let poseBusy = false;
let lastPoseTime = 0;

// ========== CHEESE MAPPINGS (Images Only) ==========

const colorCheeses = {
  red: { name: "cheddar" },
  blue: { name: "gorgonzola" },
  yellow: { name: "swiss" },
  green: { name: "pesto" },
  white: { name: "mozzarella" }
};

const hairCheeses = {
  kinky: { name: "roquefort" },
  dreadlocks: { name: "parmesan" },
  curly: { name: "gouda" },
  wavy: { name: "brie" },
  straight: { name: "provolone" }
};

// you can point these to whichever cheese image you prefer
// ========== SKIN‑TONE CHEESES ==========
const skinCheeses = {
  light: { name: "feta" },
  "mid-light": { name: "bluecheese" },
  "mid-dark": { name: "camembert" },
  dark: { name: "emmental" }
};

// ========== INITIALIZATION ==========

async function initTeachableMachine() {
  if (isRunning) return;

  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "Loading models...";

  try {
    const colorURL =
      "https://teachablemachine.withgoogle.com/models/NkPL0V_Tj/";
    const hairURL =
      "https://teachablemachine.withgoogle.com/models/XMUVVCrXJ/";
    const skinURL =
      "https://teachablemachine.withgoogle.com/models/IQ7RA14cv/"; 

    const [cModel, hModel, sModel] = await Promise.all([
      tmImage.load(colorURL + "model.json", colorURL + "metadata.json"),
      tmImage.load(hairURL + "model.json", hairURL + "metadata.json"),
      tmImage.load(skinURL + "model.json", skinURL + "metadata.json")
    ]);

    colorModel = cModel;
    hairModel = hModel;
    skinModel = sModel;

    maxColorPredictions = colorModel.getTotalClasses();
    maxHairPredictions = hairModel.getTotalClasses();
    maxSkinPredictions = skinModel.getTotalClasses();

    // Webcam setup (hidden)
    const flip = true;
    webcam = new tmImage.Webcam(CONFIG.WEBCAM_SIZE, CONFIG.WEBCAM_SIZE, flip);
    await webcam.setup();
    await webcam.play();
    webcam.canvas.style.display = "none";

    const container = document.getElementById("webcam-container");
    if (container) {
      container.innerHTML = "";
      container.appendChild(webcam.canvas);
      container.style.display = "none";
    }

    // init pose later
    setTimeout(initPoseDetection, 500);

    isRunning = true;
    if (statusEl)
      statusEl.textContent =
        "Models loaded! Detecting shirt color, hairstyle, and skin tone...";
    predictionLoop();
  } catch (err) {
    console.error("Initialization error:", err);
    if (statusEl)
      statusEl.textContent = "Error loading models: " + err.message;
  }
}

// ========== PREDICTION LOOP ==========

async function predictionLoop() {
  if (!isRunning) return;
  try {
    webcam.update();
    await predictAll();
  } catch (e) {
    console.warn("Prediction loop error:", e);
  }
  setTimeout(predictionLoop, 100);
}

function normalizeKey(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "");
}
function topClass(preds) {
  return preds.reduce(
    (a, b) => (b.probability > a.probability ? b : a),
    { className: "", probability: 0 }
  );
}

// ========== PREDICTIONS ==========

async function predictAll() {
  if (!colorModel || !hairModel || !skinModel || !isRunning) return;

  const [colorPreds, hairPreds, skinPreds] = await Promise.all([
    colorModel.predict(webcam.canvas),
    hairModel.predict(webcam.canvas),
    skinModel.predict(webcam.canvas)
  ]);

  const bestColor = topClass(colorPreds);
  const bestHair = topClass(hairPreds);
  const bestSkin = topClass(skinPreds);

  const cKey = normalizeKey(bestColor.className);
  const hKey = normalizeKey(bestHair.className);
  const sKey = normalizeKey(bestSkin.className);

  // shirt color
  if (
    bestColor.probability >= CONFIG.COLOR_THRESHOLD &&
    colorCheeses[cKey] &&
    targetColorCheese !== cKey
  ) {
    targetColorCheese = cKey;
    colorTransition = 0.0;
  }

  // hair
  if (
    bestHair.probability >= CONFIG.HAIR_THRESHOLD &&
    hairCheeses[hKey] &&
    targetHairCheese !== hKey
  ) {
    targetHairCheese = hKey;
    hairTransition = 0.0;
  }

  // skin tone
  if (
    bestSkin.probability >= CONFIG.SKIN_THRESHOLD &&
    skinCheeses[sKey] &&
    targetSkinCheese !== sKey
  ) {
    targetSkinCheese = sKey;
    skinTransition = 0.0;
  }
}

// ========== POSE DETECTION ==========

async function initPoseDetection() {
  if (typeof tf === "undefined" || typeof poseDetection === "undefined") return;
  try {
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true
    };
    poseDetector = await poseDetection.createDetector(model, detectorConfig);
    poseModelLoaded = true;
  } catch (error) {
    console.error("Pose detection load error:", error);
  }
}

async function detectPose() {
  if (!poseModelLoaded || !poseDetector || !webcam || poseBusy) return;
  poseBusy = true;
  try {
    poses = await poseDetector.estimatePoses(webcam.canvas, {
      maxPoses: 1,
      flipHorizontal: false
    });
    if (typeof updateParticlesWithPose === "function")
      updateParticlesWithPose();
  } catch (e) {
    console.error("Pose error:", e);
  } finally {
    poseBusy = false;
  }
}

// ========== TRANSITIONS ==========

function updateTransitions() {
  const step = CONFIG.TRANSITION_SPEED;
  if (colorTransition < 1.0) {
    colorTransition = Math.min(1.0, colorTransition + step);
    if (colorTransition >= 1.0) {
      currentColorCheese = targetColorCheese;
      updateCheeseDisplay();
    }
  }
  if (hairTransition < 1.0) {
    hairTransition = Math.min(1.0, hairTransition + step);
    if (hairTransition >= 1.0) {
      currentHairCheese = targetHairCheese;
      updateCheeseDisplay();
    }
  }
  if (skinTransition < 1.0) {
    skinTransition = Math.min(1.0, skinTransition + step);
    if (skinTransition >= 1.0) {
      currentSkinCheese = targetSkinCheese;
      updateCheeseDisplay();
    }
  }
}

function getTransitionCheese(fromKey, toKey, table, t) {
  const nk = (k) => (k || "").trim().toLowerCase();
  const safe = table[Object.keys(table)[0]];
  const to = table[nk(toKey)] || table[nk(fromKey)] || safe;
  return { name: to.name || "cheddar" };
}

// ========== EXPORTS ==========

Object.assign(window, {
  colorCheeses,
  hairCheeses,
  skinCheeses,
  getTransitionCheese,
  updateTransitions,
  initTeachableMachine,
  detectPose,
  poses,
  currentColorCheese,
  targetColorCheese,
  currentHairCheese,
  targetHairCheese,
  currentSkinCheese,
  targetSkinCheese,
  colorTransition,
  hairTransition,
  skinTransition,
  poseModelLoaded,
  isRunning,
  CONFIG
});

window.addEventListener("resize", () => {
  if (webcam && webcam.canvas) {
    webcam.canvas.width = CONFIG.WEBCAM_SIZE;
    webcam.canvas.height = CONFIG.WEBCAM_SIZE;
  }
});