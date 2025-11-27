// ========== MACHINE LEARNING MODULE ==========
// Optimized for automatic start & smoother performance using only images

const CONFIG = {
  WEBCAM_SIZE: 160, // smaller size for faster inference
  POSE_INTERVAL: 400, // ms between pose detections
  COLOR_THRESHOLD: 0.7,
  HAIR_THRESHOLD: 0.75,
  TRANSITION_SPEED: 0.05
};

let colorModel, hairModel, webcam, poseDetector;
let poses = [];
let maxColorPredictions = 0,
  maxHairPredictions = 0;

let currentColorCheese = "red";
let targetColorCheese = "red";
let currentHairCheese = "kinky";
let targetHairCheese = "kinky";

let colorTransition = 1.0;
let hairTransition = 1.0;
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

const hairToCheese = {
  kinky: "kinky",
  dreadlocks: "dreadlocks",
  curly: "curly",
  wavy: "wavy",
  straight: "straight"
};

// ========== INITIALIZATION ==========

async function initTeachableMachine() {
  if (isRunning) return;

  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "Loading models...";

  try {
    const colorURL =
      "https://teachablemachine.withgoogle.com/models/QQgaNNlJ1/";
    const hairURL =
      "https://teachablemachine.withgoogle.com/models/NkPL0V_Tj/";

    // Load both models
    const [cModel, hModel] = await Promise.all([
      tmImage.load(colorURL + "model.json", colorURL + "metadata.json"),
      tmImage.load(hairURL + "model.json", hairURL + "metadata.json")
    ]);

    colorModel = cModel;
    hairModel = hModel;
    maxColorPredictions = colorModel.getTotalClasses();
    maxHairPredictions = hairModel.getTotalClasses();

    // Setup webcam (hidden)
    const flip = false;
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

    // Hide debug info
    const labelContainer = document.getElementById("label-container");
    if (labelContainer) labelContainer.style.display = "none";

    // Initialize pose detection with brief delay
    setTimeout(initPoseDetection, 500);

    isRunning = true;
    if (statusEl)
      statusEl.textContent =
        "Models loaded! Detecting shirt color & hairstyle...";
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
    await predictBoth();
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

async function predictBoth() {
  if (!colorModel || !hairModel || !isRunning) return;

  const [colorPreds, hairPreds] = await Promise.all([
    colorModel.predict(webcam.canvas),
    hairModel.predict(webcam.canvas)
  ]);

  const bestColor = topClass(colorPreds);
  const bestHair = topClass(hairPreds);

  const detectedColor = normalizeKey(bestColor.className);
  const detectedHair = normalizeKey(bestHair.className);

  if (
    bestColor.probability >= CONFIG.COLOR_THRESHOLD &&
    colorCheeses[detectedColor] &&
    targetColorCheese !== detectedColor
  ) {
    targetColorCheese = detectedColor;
    colorTransition = 0.0;
  }

  let mappedHair = null;
  if (bestHair.probability >= CONFIG.HAIR_THRESHOLD) {
    const hk = normalizeKey(detectedHair);
    if (hairToCheese[hk]) mappedHair = hairToCheese[hk];
  }

  if (mappedHair && hairCheeses[mappedHair]) {
    targetHairCheese = mappedHair;
    hairTransition = 0.0;
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
    console.log("Pose detection ready");
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
  if (colorTransition < 1.0) {
    colorTransition = Math.min(1.0, colorTransition + CONFIG.TRANSITION_SPEED);
    if (colorTransition >= 1.0) {
      currentColorCheese = targetColorCheese;
      updateCheeseDisplay();
    }
  }
  if (hairTransition < 1.0) {
    hairTransition = Math.min(1.0, hairTransition + CONFIG.TRANSITION_SPEED);
    if (hairTransition >= 1.0) {
      currentHairCheese = targetHairCheese;
      updateCheeseDisplay();
    }
  }
}

function getTransitionCheese(fromKey, toKey, table, t) {
  const nk = (k) => (k || "").trim().toLowerCase();
  const safeKey = Object.keys(table)[0];
  const to = table[nk(toKey)] || table[nk(fromKey)] || table[safeKey];
  return {
    name: to.name || "cheddar"
  };
}

// ========== EXPORTS ==========
Object.assign(window, {
  colorCheeses,
  hairCheeses,
  hairToCheese,
  getTransitionCheese,
  updateTransitions,
  initTeachableMachine,
  detectPose,
  poses,
  currentColorCheese,
  targetColorCheese,
  currentHairCheese,
  targetHairCheese,
  colorTransition,
  hairTransition,
  poseModelLoaded,
  isRunning,
  CONFIG
});