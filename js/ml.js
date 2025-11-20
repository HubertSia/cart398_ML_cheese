// ========== MACHINE LEARNING MODULE ==========
// Handles loading Teachable Machine models, running predictions,
// and pose detection. Exports variables that particles.js can use.

let colorModel, hairModel, webcam, poseDetector;
let poses = [];
let maxColorPredictions = 0,
  maxHairPredictions = 0;

let currentColorCheese = "red";
let targetColorCheese = "red";
let currentHairCheese = "kinky";
let targetHairCheese = "kinky";

const COLOR_CONFIDENCE_THRESHOLD = 0.7;
const HAIR_CONFIDENCE_THRESHOLD = 0.75;
const transitionSpeed = 0.05;

let colorTransition = 1.0;
let hairTransition = 1.0;
let isRunning = false;
let poseModelLoaded = false;
let poseBusy = false;

// ========== CHEESE MAPPINGS ==========

const colorCheeses = {
  red: { name: "Cheddar", color: [255, 150, 0], texture: "sharp" },
  blue: { name: "Gorgonzola", color: [200, 220, 255], texture: "veiny" },
  yellow: { name: "Swiss", color: [255, 255, 150], texture: "holey" },
  green: { name: "Pesto", color: [150, 255, 150], texture: "herby" },
  white: { name: "Mozzarella", color: [255, 255, 255], texture: "stretchy" }
};

const hairCheeses = {
  kinky: { name: "Roquefort", color: [185, 210, 230], texture: "veiny" },
  dreadlocks: { name: "Parmesan", color: [250, 240, 200], texture: "granular" },
  curly: { name: "Gouda", color: [255, 210, 120], texture: "wedge" },
  wavy: { name: "Brie", color: [255, 255, 240], texture: "brie" },
  straight: { name: "Provolone", color: [255, 245, 180], texture: "smoothslice" }
};

// Hair class -> hair cheese key
const hairToCheese = { kinky: "kinky", dreadlocks: "dreadlocks", curly: "curly", wavy: "wavy", straight: "straight" };

// ========== INITIALIZATION ==========

async function initTeachableMachine() {
  if (isRunning) return;

  console.log("Initializing models...");
  const statusEl = document.getElementById("status");
  const startBtn = document.getElementById("startButton");
  if (statusEl) statusEl.textContent = "Loading models...";
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = "Loading...";
  }

  try {
    const colorURL =
      "https://teachablemachine.withgoogle.com/models/QQgaNNlJ1/";
    const hairURL =
      "https://teachablemachine.withgoogle.com/models/NkPL0V_Tj/";

    const [cModel, hModel] = await Promise.all([
      tmImage.load(colorURL + "model.json", colorURL + "metadata.json"),
      tmImage.load(hairURL + "model.json", hairURL + "metadata.json")
    ]);

    colorModel = cModel;
    hairModel = hModel;

    maxColorPredictions = colorModel.getTotalClasses();
    maxHairPredictions = hairModel.getTotalClasses();

    // Webcam
    const flip = false;
    webcam = new tmImage.Webcam(200, 200, flip);
    await webcam.setup();
    await webcam.play();

    const webcamContainer = document.getElementById("webcam-container");
    if (webcamContainer) {
      webcamContainer.innerHTML = "";
      webcamContainer.appendChild(webcam.canvas);
      webcamContainer.style.display = "block";
    }

    // Prediction labels UI setup
    const labelContainer = document.getElementById("label-container");
    if (labelContainer) {
      labelContainer.innerHTML = "";

      const colorHeader = document.createElement("div");
      colorHeader.textContent = "Shirt Color Predictions:";
      colorHeader.style.marginTop = "8px";
      colorHeader.style.color = "#ffd700";
      labelContainer.appendChild(colorHeader);

      for (let i = 0; i < maxColorPredictions; i++) {
        const div = document.createElement("div");
        div.className = "prediction-label";
        labelContainer.appendChild(div);
      }

      const hairHeader = document.createElement("div");
      hairHeader.textContent = "Hair Style Predictions:";
      hairHeader.style.marginTop = "12px";
      hairHeader.style.color = "#ffd700";
      labelContainer.appendChild(hairHeader);

      for (let i = 0; i < maxHairPredictions; i++) {
        const div = document.createElement("div");
        div.className = "prediction-label";
        labelContainer.appendChild(div);
      }

      labelContainer.style.display = "block";
    }

    // Initialize pose detection
    await initPoseDetection();

    isRunning = true;
    if (statusEl)
      statusEl.textContent = "Models ready! Show shirt color and hairstyle!";
    if (startBtn) startBtn.textContent = "Running...";

    predictionLoop();
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = "Error: " + err.message;
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "Start Camera & Model";
    }
  }
}

// ========== PREDICTION LOOP ==========

async function predictionLoop() {
  if (!isRunning) return;
  try {
    try {
      webcam.update();
    } catch (e) {
      console.warn("webcam update error:", e);
    }

    try {
      await predictBoth();
    } catch (e) {
      console.warn("predictBoth error (continuing):", e);
    }
  } catch (e) {
    console.warn("prediction loop outer error:", e);
  }

  setTimeout(predictionLoop, 100);
}

function normalizeKey(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "");
}
function topClass(preds) {
  let best = { className: null, probability: 0 };
  for (const p of preds)
    if (p.probability > best.probability) best = p;
  return best;
}

// ========== PREDICTION HANDLER ==========

async function predictBoth() {
  if (!colorModel || !hairModel || !isRunning) return;

  const [colorPreds, hairPreds] = await Promise.all([
    colorModel.predict(webcam.canvas),
    hairModel.predict(webcam.canvas)
  ]);

  // Display predictions
  const labelContainer = document.getElementById("label-container");
  if (labelContainer) {
    const kids = Array.from(labelContainer.children);
    const colorStart = 1;
    const hairHeaderIndex = colorStart + maxColorPredictions;
    const hairStart = hairHeaderIndex + 1;

    for (
      let i = 0;
      i <
      Math.min(maxColorPredictions, colorPreds.length, kids.length - colorStart);
      i++
    ) {
      const el = kids[colorStart + i];
      const p = colorPreds[i];
      if (el && p)
        el.innerHTML =
          p.className + ": " + (p.probability * 100).toFixed(1) + "%";
    }

    for (
      let i = 0;
      i <
      Math.min(maxHairPredictions, hairPreds.length, kids.length - hairStart);
      i++
    ) {
      const el = kids[hairStart + i];
      const p = hairPreds[i];
      if (el && p)
        el.innerHTML =
          p.className + ": " + (p.probability * 100).toFixed(1) + "%";
    }
  }

  // Handle color selection
  const bestColor = colorPreds.length
    ? topClass(colorPreds)
    : { className: "", probability: 0 };
  const bestHair = hairPreds.length
    ? topClass(hairPreds)
    : { className: "", probability: 0 };

  const detectedColor = normalizeKey(bestColor.className);
  const detectedHair = normalizeKey(bestHair.className);

  if (
    bestColor.probability >= COLOR_CONFIDENCE_THRESHOLD &&
    colorCheeses[detectedColor] &&
    targetColorCheese !== detectedColor
  ) {
    targetColorCheese = detectedColor;
    colorTransition = 0.0;
    console.log("Color →", detectedColor);
  }

  let mappedHair = null;
  if (bestHair.probability >= HAIR_CONFIDENCE_THRESHOLD) {
    const hk = normalizeKey(detectedHair);
    if (hairToCheese[hk]) mappedHair = hairToCheese[hk];
  }
  if (mappedHair && hairCheeses[mappedHair]) {
    targetHairCheese = mappedHair;
    hairTransition = 0.0;
    console.log("Hair →", mappedHair);
  }
}

// ========== POSE DETECTION ==========

async function initPoseDetection() {
  console.log("Initializing pose detection...");
  if (typeof tf === "undefined" || typeof poseDetection === "undefined") {
    console.warn("Pose not available - particles won’t follow body");
    return;
  }
  try {
    const model = poseDetection.SupportedModels.MoveNet;
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      enableSmoothing: true
    };
    poseDetector = await poseDetection.createDetector(model, detectorConfig);
    poseModelLoaded = true;
    console.log("MoveNet pose detector created");
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
    // This is defined in particles.js
    if (typeof updateParticlesWithPose === "function") {
      updateParticlesWithPose();
    }
  } catch (e) {
    console.error("Pose error:", e);
  } finally {
    poseBusy = false;
  }
}

// ========== TRANSITIONS ==========

function updateTransitions() {
  if (colorTransition < 1.0) {
    colorTransition = Math.min(1.0, colorTransition + transitionSpeed);
    if (colorTransition >= 1.0) {
      currentColorCheese = targetColorCheese || currentColorCheese;
      updateCheeseDisplay();
    }
  }
  if (hairTransition < 1.0) {
    hairTransition = Math.min(1.0, hairTransition + transitionSpeed);
    if (hairTransition >= 1.0) {
      currentHairCheese = targetHairCheese || currentHairCheese;
      updateCheeseDisplay();
    }
  }
}

function getTransitionCheese(fromKey, toKey, table, t) {
  const nk = (k) => (k || "").trim().toLowerCase();
  const safe = table[Object.keys(table)[0]];
  const to = table[nk(toKey)] || table[nk(fromKey)] || safe;
  return {
    name: typeof to.name === "string" ? to.name : "Unknown",
    color: Array.isArray(to.color) ? to.color : [255, 255, 255],
    texture: typeof to.texture === "string" ? to.texture : "basic"
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
  transitionSpeed,
  currentColorCheese,
  targetColorCheese,
  currentHairCheese,
  targetHairCheese,
  colorTransition,
  hairTransition,
  poseModelLoaded,
  isRunning,
  poses
});