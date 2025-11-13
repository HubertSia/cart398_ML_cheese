// ========== GLOBAL VARIABLES ==========
let colorModel; // shirt color model
let hairModel; // hair style model
let webcam;
let poseDetector;

let colorParticles = [];
let hairParticles = [];

let currentColorCheese = "red";
let targetColorCheese = "red";
let currentHairCheese = "kinky"; // default hairstyle cheese key
let targetHairCheese = "kinky";

let poseModelLoaded = false;
let poses = [];
let isRunning = false;

let maxColorPredictions = 0;
let maxHairPredictions = 0;

let colorTransition = 1.0; // 0..1
let hairTransition = 1.0; // 0..1

const transitionSpeed = 0.05;
let poseBusy = false; // prevents overlapping pose inferences

// thresholds
const COLOR_CONFIDENCE_THRESHOLD = 0.7;
const HAIR_CONFIDENCE_THRESHOLD = 0.75;

// ========== CHEESE MAPPINGS ==========
// Color-cheese set (from your original)
const colorCheeses = {
  red: { name: "Cheddar", color: [255, 150, 0], texture: "sharp" },
  blue: { name: "Gorgonzola", color: [200, 220, 255], texture: "veiny" },
  yellow: { name: "Swiss", color: [255, 255, 150], texture: "holey" },
  green: { name: "Pesto", color: [150, 255, 150], texture: "herby" },
  white: { name: "Mozzarella", color: [255, 255, 255], texture: "stretchy" }
};

// Hair-cheese set (each hairstyle distinct cheese/texture)
const hairCheeses = {
  kinky: { name: "Roquefort", color: [185, 210, 230], texture: "veiny" },
  dreadlocks: { name: "Parmesan", color: [250, 240, 200], texture: "granular" },
  curly: { name: "Gouda", color: [255, 210, 120], texture: "wedge" },
  wavy: { name: "Brie", color: [255, 255, 240], texture: "brie" },
  straight: { name: "Provolone", color: [255, 245, 180], texture: "smoothslice"
  }
};

// Hair class -> hair cheese key (same key names)
const hairToCheese = {
  kinky: "kinky",
  dreadlocks: "dreadlocks",
  curly: "curly",
  wavy: "wavy",
  straight: "straight"
};

// ========== P5.JS SETUP ==========
function setup() {
  console.log("P5.js Setup started");

  const canvas = createCanvas(800, 600);
  canvas.parent("container");

  createInitialParticles();

  console.log("P5.js Setup complete - waiting for init");
}

// ========== INIT ==========
// Called by Start button
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
    // URLs
    const colorURL =
      "https://teachablemachine.withgoogle.com/models/QQgaNNlJ1/";
    const hairURL = "https://teachablemachine.withgoogle.com/models/NkPL0V_Tj/";

    const [cModel, hModel] = await Promise.all([
      tmImage.load(colorURL + "model.json", colorURL + "metadata.json"),
      tmImage.load(hairURL + "model.json", hairURL + "metadata.json")
    ]);

    colorModel = cModel;
    hairModel = hModel;

    maxColorPredictions = colorModel.getTotalClasses();
    maxHairPredictions = hairModel.getTotalClasses();

    // Webcam setup (single stream)
    const flip = false; // keep unflipped for pose detector mapping
    webcam = new tmImage.Webcam(200, 200, flip);
    await webcam.setup();
    await webcam.play();

    const webcamContainer = document.getElementById("webcam-container");
    if (webcamContainer) {
      webcamContainer.innerHTML = "";
      webcamContainer.appendChild(webcam.canvas);
      webcamContainer.style.display = "block";
    }

    // Label container: color then hair
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

    // Init pose
    await initPoseDetection();

    isRunning = true;
    if (statusEl)
      statusEl.textContent =
        "Models ready! Show shirt color and hairstyle!";
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

async function predictionLoop() {
  if (!isRunning) return;
  try {
    // Keep webcam update from breaking the loop
    try {
      webcam.update();
    } catch (e) {
      console.warn("webcam update error:", e);
    }

    // Keep prediction errors from breaking the loop
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

// ========== PREDICTION ==========
function normalizeKey(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "");
}

function topClass(preds) {
  let best = { className: null, probability: 0 };
  for (const p of preds) if (p.probability > best.probability) best = p;
  return best;
}

async function predictBoth() {
  if (!colorModel || !hairModel || !isRunning) return;

  const [colorPreds, hairPreds] = await Promise.all([
    colorModel.predict(webcam.canvas),
    hairModel.predict(webcam.canvas)
  ]);

  // Update labels (safe bounds)
  const labelContainer = document.getElementById("label-container");
  if (labelContainer) {
    const kids = Array.from(labelContainer.children);
    const colorStart = 1;
    const hairHeaderIndex = colorStart + maxColorPredictions;
    const hairStart = hairHeaderIndex + 1;

    const colorRows = Math.min(
      maxColorPredictions,
      colorPreds.length,
      Math.max(0, kids.length - colorStart)
    );
    for (let i = 0; i < colorRows; i++) {
      const el = kids[colorStart + i];
      const p = colorPreds[i];
      if (!el || !p) break;
      el.innerHTML =
        p.className + ": " + (p.probability * 100).toFixed(1) + "%";
    }

    const hairRows = Math.min(
      maxHairPredictions,
      hairPreds.length,
      Math.max(0, kids.length - hairStart)
    );
    for (let i = 0; i < hairRows; i++) {
      const el = kids[hairStart + i];
      const p = hairPreds[i];
      if (!el || !p) break;
      el.innerHTML =
        p.className + ": " + (p.probability * 100).toFixed(1) + "%";
    }
  }

  // Decide targets independently
  const bestColor = colorPreds.length
    ? topClass(colorPreds)
    : { className: "", probability: 0 };
  const bestHair = hairPreds.length
    ? topClass(hairPreds)
    : { className: "", probability: 0 };

  const detectedColor = normalizeKey(bestColor.className);
  const detectedHair = normalizeKey(bestHair.className);

  // Color system target
  if (
    bestColor.probability >= COLOR_CONFIDENCE_THRESHOLD &&
    colorCheeses[detectedColor] &&
    targetColorCheese !== detectedColor
  ) {
    targetColorCheese = detectedColor;
    colorTransition = 0.0;
    console.log(
      `Color-> ${detectedColor} (${(bestColor.probability * 100).toFixed(
        1
      )}%)`
    );
  }

  // Hair system target
  let mappedHair = null;
  if (bestHair.probability >= HAIR_CONFIDENCE_THRESHOLD) {
    const hk = normalizeKey(detectedHair);
    if (hairToCheese[hk]) mappedHair = hairToCheese[hk];
  }
  if (
    mappedHair &&
    hairCheeses[mappedHair] &&
    targetHairCheese !== mappedHair
  ) {
    targetHairCheese = mappedHair;
    hairTransition = 0.0;
    console.log(
      `Hair-> ${detectedHair} (${(bestHair.probability * 100).toFixed(
        1
      )}%) => ${targetHairCheese}`
    );
  }
}

// ========== TRANSITIONS ==========
function lerpColor(color1, color2, t) {
  const a = Array.isArray(color1) ? color1 : [255, 255, 255];
  const b = Array.isArray(color2) ? color2 : [255, 255, 255];
  const tt = Number.isFinite(t) ? t : 1;
  return [lerp(a[0], b[0], tt), lerp(a[1], b[1], tt), lerp(a[2], b[2], tt)];
}


function updateTransitions() {
  if (colorTransition < 1.0) {
    colorTransition = Math.min(1.0, colorTransition + transitionSpeed);
    if (colorTransition >= 1.0) {
      currentColorCheese = targetColorCheese || currentColorCheese;
      updateCheeseDisplay(); // reflect color cheese in UI line
    }
  }
  if (hairTransition < 1.0) {
    hairTransition = Math.min(1.0, hairTransition + transitionSpeed);
    if (hairTransition >= 1.0) {
      currentHairCheese = targetHairCheese || currentHairCheese;
      updateCheeseDisplay(); // show hair cheese too
    }
  }
}

function getTransitionCheese(fromKey, toKey, table, t) {
  const nk = (k) => (k || "").trim().toLowerCase();
  const keys = Object.keys(table || {});
  const safe = keys.length
    ? table[keys[0]]
    : { name: "Unknown", color: [255, 255, 255], texture: "basic" };

  const to = (table && table[nk(toKey)]) || (table && table[nk(fromKey)]) || safe;

  // TEMP: no lerp, just return 'to' safely
  const isColor = (c) =>
    Array.isArray(c) &&
    c.length >= 3 &&
    Number.isFinite(c[0]) &&
    Number.isFinite(c[1]) &&
    Number.isFinite(c[2]);

  return {
    name: typeof to.name === "string" ? to.name : "Unknown",
    color: isColor(to.color) ? to.color : [255, 255, 255],
    texture: typeof to.texture === "string" ? to.texture : "basic"
  };
}


// ========== POSE ==========
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
    updateParticlesWithPose();
  } catch (e) {
    console.error("Pose error:", e);
  } finally {
    poseBusy = false;
  }
}

function updateParticlesWithPose() {
  if (!poses.length || !poses[0].keypoints) return;

  const kp = poses[0].keypoints;
  const scaleX = width / 200;
  const scaleY = height / 200;

  const body = {
    nose: kp.find((k) => k.name === "nose"),
    leftWrist: kp.find((k) => k.name === "left_wrist"),
    rightWrist: kp.find((k) => k.name === "right_wrist"),
    leftElbow: kp.find((k) => k.name === "left_elbow"),
    rightElbow: kp.find((k) => k.name === "right_elbow")
  };

  function assignTargets(particles) {
    particles.forEach((p, i) => {
      let t = null;
      const g = i % 5;
      if (g === 0 && body.nose && body.nose.score > 0.3)
        t = createVector(body.nose.x * scaleX, body.nose.y * scaleY);
      else if (g === 1 && body.leftWrist && body.leftWrist.score > 0.3)
        t = createVector(body.leftWrist.x * scaleX, body.leftWrist.y * scaleY);
      else if (g === 2 && body.rightWrist && body.rightWrist.score > 0.3)
        t = createVector(
          body.rightWrist.x * scaleX,
          body.rightWrist.y * scaleY
        );
      else if (g === 3 && body.leftElbow && body.leftElbow.score > 0.3)
        t = createVector(body.leftElbow.x * scaleX, body.leftElbow.y * scaleY);
      else if (g === 4 && body.rightElbow && body.rightElbow.score > 0.3)
        t = createVector(
          body.rightElbow.x * scaleX,
          body.rightElbow.y * scaleY
        );
      p.target = t;
    });
  }

  assignTargets(colorParticles);
  assignTargets(hairParticles);
}

// ========== PARTICLE SYSTEMS ==========
function createInitialParticles() {
  colorParticles = [];
  hairParticles = [];

  for (let i = 0; i < 60; i++) {
    colorParticles.push(new CheeseParticle("color"));
  }
  for (let i = 0; i < 60; i++) {
    hairParticles.push(new CheeseParticle("hair"));
  }
}

class CheeseParticle {
  constructor(kind) {
    this.kind = kind; // "color" or "hair"
    this.pos = createVector(width / 2, height / 2);
    this.vel = createVector(random(-2, 2), random(-2, 2));
    this.size = random(10, 25);
    this.life = 255;
    this.decay = random(0.3, 1);
    this.rotation = random(0, TWO_PI);
    this.rotationSpeed = random(-0.05, 0.05);
    this.followStrength = random(0.005, 0.02);
    this.target = null;
  }

  update() {
    if (this.target) {
      const dir = p5.Vector.sub(this.target, this.pos);
      dir.mult(this.followStrength);
      this.vel.add(dir);
    }
    this.pos.add(this.vel);
    this.vel.mult(0.97);
    this.life -= this.decay;
    this.rotation += this.rotationSpeed;
    this.vel.x += random(-0.05, 0.05);
    this.vel.y += random(-0.05, 0.05);
    if (this.pos.x < 0 || this.pos.x > width) this.vel.x *= -0.5;
    if (this.pos.y < 0 || this.pos.y > height) this.vel.y *= -0.5;
  }

  display() {
    const alpha = this.life / 255;

    // Select cheese set and transition
    let cheese;
    if (this.kind === "color") {
      const from = currentColorCheese;
      const to = targetColorCheese;
      cheese = getTransitionCheese(from, to, colorCheeses, colorTransition);
    } else {
      const from = currentHairCheese;
      const to = targetHairCheese;
      cheese = getTransitionCheese(from, to, hairCheeses, hairTransition);
    }

    if (!cheese || !cheese.texture) {
      console.warn("Cheese fallback applied:", cheese);
      cheese = { texture: "basic", color: [255, 255, 255] };
    }

    const safeColor = (c) =>
      Array.isArray(c) &&
      c.length >= 3 &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]) &&
      Number.isFinite(c[2]);

    const col = safeColor(cheese.color) ? cheese.color : [255, 255, 255];
    const r = Number.isFinite(col[0]) ? col[0] : 255;
    const g = Number.isFinite(col[1]) ? col[1] : 255;
    const b = Number.isFinite(col[2]) ? col[2] : 255;

    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);

    fill(r, g, b, alpha * 200);
    stroke(r * 0.8, g * 0.8, b * 0.8, alpha * 255);
    strokeWeight(1);

    // Texture routes (shared + new)
    const tx = cheese.texture;
    if (tx === "holey") this.drawSwissParticle();
    else if (tx === "veiny") this.drawBlueCheeseParticle();
    else if (tx === "herby") this.drawPestoParticle();
    else if (tx === "stretchy") this.drawMozzarellaParticle();
    else if (tx === "granular") this.drawParmesanParticle();
    else if (tx === "wedge") this.drawGoudaParticle();
    else if (tx === "brie") this.drawBrieParticle();
    else if (tx === "smoothslice") this.drawProvoloneParticle();
    else this.drawBasicCheeseParticle();

    pop();
    
  }

  // Shapes
  drawBasicCheeseParticle() {
    beginShape();
    vertex(0, -this.size / 2);
    vertex(this.size / 2, this.size / 4);
    vertex(0, this.size / 2);
    vertex(-this.size / 2, this.size / 4);
    endShape(CLOSE);
  }

  drawSwissParticle() {
    ellipse(0, 0, this.size);
    fill(50, 50, 50, this.life);
    noStroke();
    ellipse(-this.size / 4, -this.size / 6, this.size / 5);
    ellipse(this.size / 4, this.size / 6, this.size / 6);
  }

  drawBlueCheeseParticle() {
    rect(0, 0, this.size, this.size, 5);
    stroke(100, 100, 200, this.life * 0.8);
    strokeWeight(2);
    line(-this.size / 3, -this.size / 3, this.size / 3, this.size / 3);
    line(this.size / 3, -this.size / 3, -this.size / 3, this.size / 3);
  }

  drawPestoParticle() {
    ellipse(0, 0, this.size);
    fill(50, 100, 50, this.life);
    noStroke();
    ellipse(-this.size / 3, 0, this.size / 8);
    ellipse(this.size / 4, -this.size / 4, this.size / 10);
  }

  drawMozzarellaParticle() {
    ellipse(0, 0, this.size, this.size * 0.6);
    stroke(255, 255, 255, this.life * 0.6);
    strokeWeight(1);
    line(-this.size / 3, 0, this.size / 3, 0);
  }

  drawParmesanParticle() {
    // granular shards: several small triangles
    push();
    noStroke();
    const n = 3 + floor(random(0, 3));
    for (let i = 0; i < n; i++) {
      const ang = random(TWO_PI);
      const r = this.size * random(0.2, 0.6);
      push();
      rotate(ang);
      beginShape();
      vertex(0, 0);
      vertex(r, -r * 0.5);
      vertex(r * 0.4, r * 0.6);
      endShape(CLOSE);
      pop();
    }
    pop();
  }

  drawGoudaParticle() {
    // wedge with rind
    push();
    const w = this.size;
    const h = this.size * 0.7;
    stroke(0, 0, 0, this.life * 0.8);
    strokeWeight(1.5);
    beginShape();
    vertex(-w * 0.5, -h * 0.2);
    vertex(w * 0.4, -h * 0.4);
    vertex(w * 0.5, 0);
    vertex(w * 0.4, h * 0.4);
    vertex(-w * 0.5, h * 0.2);
    endShape(CLOSE);
    noFill();
    arc(0, 0, w * 1.1, h * 1.1, -PI / 2, PI / 2);
    pop();
  }

  drawBrieParticle() {
    // soft wheel slice
    push();
    const w = this.size * 1.1;
    const h = this.size * 0.8;
    stroke(255, 255, 255, this.life);
    strokeWeight(2);
    fill(255, 255, 240, this.life * 0.8);
    ellipse(0, 0, w, h);
    stroke(230, 220, 200, this.life * 0.7);
    strokeWeight(1);
    line(-w * 0.35, 0, w * 0.35, 0);
    pop();
  }

  drawProvoloneParticle() {
    // smooth oval slice with subtle rim
    push();
    const w = this.size * 1.0;
    const h = this.size * 0.7;
    fill(255, 245, 180, this.life * 0.9);
    stroke(220, 210, 160, this.life * 0.8);
    strokeWeight(1);
    ellipse(0, 0, w, h);
    line(-w * 0.25, -h * 0.25, -w * 0.25, h * 0.25);
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

// ========== DRAW LOOP ==========
function draw() {
  background(0, 0, 0, 25);

  updateTransitions();

  // slightly lower cadence to avoid stalling on some devices
  if (isRunning && poseModelLoaded && frameCount % 12 === 0) {
    detectPose();
  }

  // Update + draw color particles
  for (let i = colorParticles.length - 1; i >= 0; i--) {
    const p = colorParticles[i];
    p.update();
    p.display();
    if (p.isDead()) {
      colorParticles.splice(i, 1);
      colorParticles.push(new CheeseParticle("color"));
    }
  }

  // Update + draw hair particles
  for (let i = hairParticles.length - 1; i >= 0; i--) {
    const p = hairParticles[i];
    p.update();
    p.display();
    if (p.isDead()) {
      hairParticles.splice(i, 1);
      hairParticles.push(new CheeseParticle("hair"));
    }
  }

  // Debug overlay
  fill(255);
  textSize(14);
  text(
    `TM: ${isRunning ? "Running" : "Stopped"} | Pose: ${
      poseModelLoaded ? "Ready" : "Off"
    }`,
    10,
    20
  );
  text(
    `Color: ${currentColorCheese} → ${targetColorCheese}  |  Hair: ${currentHairCheese} → ${targetHairCheese}`,
    10,
    40
  );
  text(
    `Transitions - Color: ${(colorTransition * 100).toFixed(
      0
    )}%  Hair: ${(hairTransition * 100).toFixed(0)}%`,
    10,
    60
  );

  // Progress bars
  if (colorTransition < 1.0 || hairTransition < 1.0) {
    drawTransitionBars();
  }

  // Status lines
  text(`Current Color Cheese: ${currentColorCheese}`, 10, 90);
  text(`Current Hair Cheese: ${currentHairCheese}`, 10, 110);
}

function drawTransitionBars() {
  const barWidth = 200;
  const barHeight = 10;
  const x = width - barWidth - 20;

  // Color bar
  const y1 = 20;
  fill(100);
  rect(x, y1, barWidth, barHeight);
  fill(255, 200, 0);
  rect(x, y1, barWidth * colorTransition, barHeight);
  fill(255);
  textSize(12);
  text("Color Transition", x, y1 - 5);

  // Hair bar
  const y2 = 40;
  fill(100);
  rect(x, y2, barWidth, barHeight);
  fill(200, 255, 0);
  rect(x, y2, barWidth * hairTransition, barHeight);
  fill(255);
  textSize(12);
  text("Hair Transition", x, y2 - 5);
}

// ========== UI HELPERS ==========
function updateCheeseDisplay() {
  const display = document.getElementById("cheeseDisplay");
  if (!display) return;

  const colorObj = colorCheeses[currentColorCheese] || colorCheeses.red;
  const hairObj = hairCheeses[currentHairCheese] || hairCheeses.kinky;

  const colorText = `${colorObj.name} (color)`;
  const hairText = `${hairObj.name} (hair)`;

  display.textContent = `You are ${colorText} + ${hairText}!`;

  // Blend the two colors for the text color
  const mix = 0.5;
  const c1 = Array.isArray(colorObj.color) ? colorObj.color : [255, 255, 255];
  const c2 = Array.isArray(hairObj.color) ? hairObj.color : [255, 255, 255];
  const blended = [
    Math.round(c1[0] * (1 - mix) + c2[0] * mix),
    Math.round(c1[1] * (1 - mix) + c2[1] * mix),
    Math.round(c1[2] * (1 - mix) + c2[2] * mix)
  ];
  display.style.color = `rgb(${blended.join(",")})`;
  display.style.transition = "color 0.5s ease";
}

// ========== INTERACTION ==========
function keyPressed() {
  // 1-5 changes color system, Q-T changes hair system
  const colorKeys = ["red", "blue", "yellow", "green", "white"];
  if (key >= "1" && key <= "5") {
    targetColorCheese = colorKeys[key - 1];
    colorTransition = 0.0;
    console.log("Manual color ->", targetColorCheese);
  }

  const hairKeys = ["kinky", "dreadlocks", "curly", "wavy", "straight"];
  const mapKeys = { q: 0, w: 1, e: 2, r: 3, t: 4 };
  const k = key.toLowerCase();
  if (k in mapKeys) {
    targetHairCheese = hairKeys[mapKeys[k]];
    hairTransition = 0.0;
    console.log("Manual hair ->", targetHairCheese);
  }
}

function mouseMoved() {
  for (let i = 0; i < Math.min(3, colorParticles.length); i++) {
    colorParticles[i].target = createVector(mouseX, mouseY);
  }
  for (let i = 0; i < Math.min(3, hairParticles.length); i++) {
    hairParticles[i].target = createVector(mouseX, mouseY);
  }
}