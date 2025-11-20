// ========== VISUAL MODULE ==========
// Requires ml.js loaded first.

let colorParticles = [];
let hairParticles = [];

function setup() {
  const canvas = createCanvas(800, 600);
  canvas.parent("container");
  createInitialParticles();
}

function draw() {
  background(0, 0, 0, 25);

  updateTransitions(); // from ml.js

  if (isRunning && poseModelLoaded && frameCount % 12 === 0) {
    detectPose();
  }

  updateAndDisplayParticles(colorParticles, "color");
  updateAndDisplayParticles(hairParticles, "hair");
}

function createInitialParticles() {
  for (let i = 0; i < 60; i++) {
    colorParticles.push(new CheeseParticle("color"));
    hairParticles.push(new CheeseParticle("hair"));
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

// ====== POSE SYNC ======
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
        t = createVector(body.rightWrist.x * scaleX, body.rightWrist.y * scaleY);
      else if (g === 3 && body.leftElbow && body.leftElbow.score > 0.3)
        t = createVector(body.leftElbow.x * scaleX, body.leftElbow.y * scaleY);
      else if (g === 4 && body.rightElbow && body.rightElbow.score > 0.3)
        t = createVector(body.rightElbow.x * scaleX, body.rightElbow.y * scaleY);
      p.target = t;
    });
  }

  assignTargets(colorParticles);
  assignTargets(hairParticles);
}
window.updateParticlesWithPose = updateParticlesWithPose;

// ====== PARTICLES ======

class CheeseParticle {
  constructor(kind) {
    this.kind = kind;
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
    let cheese;
    if (this.kind === "color") {
      cheese = getTransitionCheese(
        currentColorCheese,
        targetColorCheese,
        colorCheeses,
        colorTransition
      );
    } else {
      cheese = getTransitionCheese(
        currentHairCheese,
        targetHairCheese,
        hairCheeses,
        hairTransition
      );
    }

    if (!cheese) cheese = { color: [255, 255, 255], texture: "basic" };

    const [r, g, b] = cheese.color;

    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);
    fill(r, g, b, alpha * 200);
    stroke(r * 0.8, g * 0.8, b * 0.8, alpha * 255);
    strokeWeight(1);

    switch (cheese.texture) {
      case "holey":
        this.drawSwissParticle();
        break;
      case "veiny":
        this.drawBlueCheeseParticle();
        break;
      case "herby":
        this.drawPestoParticle();
        break;
      case "stretchy":
        this.drawMozzarellaParticle();
        break;
      case "granular":
        this.drawParmesanParticle();
        break;
      case "wedge":
        this.drawGoudaParticle();
        break;
      case "brie":
        this.drawBrieParticle();
        break;
      case "smoothslice":
        this.drawProvoloneParticle();
        break;
      default:
        this.drawBasicCheeseParticle();
    }

    pop();
  }

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
    line(-this.size / 3, -this.size / 3, this.size / 3, this.size / 3);
    line(this.size / 3, -this.size / 3, -this.size / 3, this.size / 3);
  }
  drawPestoParticle() {
    ellipse(0, 0, this.size);
    fill(50, 100, 50, this.life);
    ellipse(-this.size / 3, 0, this.size / 8);
    ellipse(this.size / 4, -this.size / 4, this.size / 10);
  }
  drawMozzarellaParticle() {
    ellipse(0, 0, this.size, this.size * 0.6);
    line(-this.size / 3, 0, this.size / 3, 0);
  }
  drawParmesanParticle() {
    push();
    const n = 3 + floor(random(0, 3));
    noStroke();
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
    const w = this.size;
    const h = this.size * 0.7;
    beginShape();
    vertex(-w * 0.5, -h * 0.2);
    vertex(w * 0.4, -h * 0.4);
    vertex(w * 0.5, 0);
    vertex(w * 0.4, h * 0.4);
    vertex(-w * 0.5, h * 0.2);
    endShape(CLOSE);
  }
  drawBrieParticle() {
    ellipse(0, 0, this.size * 1.1, this.size * 0.8);
  }
  drawProvoloneParticle() {
    ellipse(0, 0, this.size, this.size * 0.7);
  }

  isDead() {
    return this.life <= 0;
  }
}

// ========== UI HELPERS ==========
function updateCheeseDisplay() {
  const display = document.getElementById("cheeseDisplay");
  if (!display) return;

  const colorObj = colorCheeses[currentColorCheese] || colorCheeses.red;
  const hairObj = hairCheeses[currentHairCheese] || hairCheeses.kinky;

  display.textContent = `You are ${colorObj.name} (color) + ${hairObj.name} (hair)!`;

  const mix = 0.5;
  const c1 = colorObj.color || [255, 255, 255];
  const c2 = hairObj.color || [255, 255, 255];
  const blended = [
    Math.round(c1[0] * (1 - mix) + c2[0] * mix),
    Math.round(c1[1] * (1 - mix) + c2[1] * mix),
    Math.round(c1[2] * (1 - mix) + c2[2] * mix)
  ];
  display.style.color = `rgb(${blended.join(",")})`;
}