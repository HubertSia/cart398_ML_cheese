// ========== VISUAL MODULE ==========
// Requires ml.js loaded first.

let colorParticles = [];
let hairParticles = [];
let skinParticles = [];
let cheeseImages = {};

function preload() {
  cheeseImages = {
    cheddar: loadImage("../images/cheddar.png"),
    gorgonzola: loadImage("../images/gorgonzola.png"),
    swiss: loadImage("../images/swiss.png"),
    pesto: loadImage("../images/pesto.png"),
    mozzarella: loadImage("../images/mozza.png"),
    roquefort: loadImage("../images/roquefort.png"),
    parmesan: loadImage("../images/parmesan.png"),
    gouda: loadImage("../images/gouda.png"),
    brie: loadImage("../images/brie.png"),
    provolone: loadImage("../images/provolone.png"),
    feta: loadImage("../images/feta.png"),
    bluecheese: loadImage("../images/bluecheese.png"),
    camembert: loadImage("../images/camembert.png"),
    emmental: loadImage("../images/emmental.png")
  };
}

function setup() {
  const canvas = createCanvas(900, 900);
  canvas.parent("container");
  createInitialParticles();
}

function draw() {
  background(0, 0, 0, 15);

  updateTransitions();

  if (isRunning && poseModelLoaded && millis() - lastPoseTime > CONFIG.POSE_INTERVAL) {
    detectPose();
    lastPoseTime = millis();
  }

  updateAndDisplayParticles(colorParticles, "color");
  updateAndDisplayParticles(hairParticles, "hair");
  updateAndDisplayParticles(skinParticles, "skin");
}

// ========== PARTICLE SYSTEM ==========

function createInitialParticles() {
  for (let i = 0; i < 45; i++) {
    colorParticles.push(new CheeseParticle("color"));
    hairParticles.push(new CheeseParticle("hair"));
    skinParticles.push(new CheeseParticle("skin"));
  }
}

function updateAndDisplayParticles(array, kind) {
  for (let i = array.length - 1; i >= 0; i--) {
    const p = array[i];
    p.update();
    p.display();
    if (p.isDead()) {
      array.splice(i, 1);
      array.push(new CheeseParticle(kind));
    }
  }
}

// ========== POSE CONTROL ==========

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
      if (g === 0 && body.nose?.score > 0.3)
        t = createVector(body.nose.x * scaleX, body.nose.y * scaleY);
      else if (g === 1 && body.leftWrist?.score > 0.3)
        t = createVector(body.leftWrist.x * scaleX, body.leftWrist.y * scaleY);
      else if (g === 2 && body.rightWrist?.score > 0.3)
        t = createVector(body.rightWrist.x * scaleX, body.rightWrist.y * scaleY);
      else if (g === 3 && body.leftElbow?.score > 0.3)
        t = createVector(body.leftElbow.x * scaleX, body.leftElbow.y * scaleY);
      else if (g === 4 && body.rightElbow?.score > 0.3)
        t = createVector(body.rightElbow.x * scaleX, body.rightElbow.y * scaleY);
      p.target = t;
    });
  }

  assignTargets(colorParticles);
  assignTargets(hairParticles);
  assignTargets(skinParticles);
}
window.updateParticlesWithPose = updateParticlesWithPose;

// ========== CHEESE PARTICLE CLASS ==========

class CheeseParticle {
  constructor(kind) {
    this.kind = kind;
    this.pos = createVector(width / 2, height / 2);
    this.vel = createVector(random(-2, 2), random(-2, 2));
    this.size = random(60, 100);
    this.life = 255;
    this.decay = random(0.3, 1);
    this.rotation = random(0, TWO_PI);
    this.rotationSpeed = random(-0.05, 0.05);
    this.followStrength = random(0.004, 0.01);
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
    let cheese;
    if (this.kind === "color")
      cheese = getTransitionCheese(
        currentColorCheese,
        targetColorCheese,
        colorCheeses,
        colorTransition
      );
    else if (this.kind === "hair")
      cheese = getTransitionCheese(
        currentHairCheese,
        targetHairCheese,
        hairCheeses,
        hairTransition
      );
    else if (this.kind === "skin")
      cheese = getTransitionCheese(
        currentSkinCheese,
        targetSkinCheese,
        skinCheeses,
        skinTransition
      );

    const img = cheeseImages[cheese.name.toLowerCase()];
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);
    imageMode(CENTER);

    if (img) {
      image(img, 0, 0, this.size, this.size);
    } else {
      fill(255);
      ellipse(0, 0, this.size * 0.6);
    }
    pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

// ========== UI DISPLAY ==========

function updateCheeseDisplay() {
  const display = document.getElementById("cheeseDisplay");
  if (!display) return;

  const colorObj = colorCheeses[currentColorCheese] || colorCheeses.red;
  const hairObj = hairCheeses[currentHairCheese] || hairCheeses.kinky;
  const skinObj = skinCheeses[currentSkinCheese] || skinCheeses.light;

  display.textContent = `You are ${colorObj.name} (shirt) + ${hairObj.name} (hair) + ${skinObj.name} (skin)!`;
  display.style.color = "#ffd700";
}