// ========== VISUAL MODULE ==========
// Requires ml.js loaded first.

let colorParticles = [];
let hairParticles = [];
let skinParticles = [];
let cheeseImages = {};

let lastLeftWrist = null;
let lastRightWrist = null;
let lastMotionTime = 0;




// ========== COMBO COMMENTARY ==========

const comboCommentary = {
  "red-curly-light":
    "Sharp, sweet, and salty, basically a walking emotional roller-grater.",
  "blue-straight-mid-dark":
    "Smells dramatic, acts mild, melts into chaos by 3pm.",
  "yellow-kinky-dark":
    "Holy, funky, and tangy, like a polite chaos demon.",
  "green-wavy-mid-light":
    "Soft, herby, and slightly feral. Might lecture you about houseplants.",
  "white-dreadlocks-mid-dark":
    "Stretchy, judgy, and secretly dramatic. Crying inside but it tastes great.",
  "red-straight-light":
    "Sharp but pretending to be chill while aggressively salty.",
  "yellow-curly-mid-light":
    "Sweet, smoky, and surprisingly funky, like a jazz musician made of dairy.",
  "green-straight-dark":
    "Looks fancy, acts mild, tastes like a forest with commitment issues.",
  "blue-wavy-light":
    "Soft, stinky, and salty like a gossiping pillow.",
  "white-curly-mid-light":
    "Stretchy, sweet, and melts into drama. A motivational speaker on meltdown mode.",
  "red-kinky-dark":
    "Sharp, chaotic, and full of holes like a villain with plot armor.",
  "yellow-dreadlocks-mid-dark":
    "Holy, crunchy, and melts into drama. A motivational speaker on meltdown mode.",
  "green-wavy-mid-dark":
    "Soft, herbal, and gets runnier the longer you look at them.",
  "white-straight-light":
    "Chill, mild, and suddenly salty. The friend who 'doesn't care' but absolutely cares.",
  "yellow-kinky-mid-light":
    "Mild face, feral interior. Smells like it’s planning something.",
  "red-dreadlocks-mid-dark":
    "Sharp, ancient, and melts under pressure. Literally anxiety cheese.",
  "blue-curly-dark":
    "Funky, sweet, and oddly wholesome like a grandparent who skateboards.",
  "red-dreadlocks-mid-light":
    "Old soul, sharp wit, and crumbly under pressure the snack philosopher combo.",
  "red-dreadlocks-light":
    "Salty optimism meets crunch-time wisdom. You make chaos taste aged and refined.",
  "red-parmesan-mid-light":
    "Aged flavor with a bite probably muttering something profound while melting.",
  "red-dreadlocks-dark":
    "Crunchy humor hiding existential salt. A classic vintage energy wrapped in chaos.",
  "red-wavy-light":
    "Soft‑hearted and spicy brings warmth and unfiltered gossip to any room.",
  "red-straight-mid-dark":
    "Looks stable, but harbors secret tangy turbulence beneath that calm melt.",
  "yellow-parmesan-light":
    "Sweet yet bitter when provoked probably the responsible friend in the fondue.",
  "yellow-dreadlocks-dark":
    "Rich, crumbly, and dramatic. Smells like confidence and late‑night decisions.",
  "yellow-straight-mid-dark":
    "Golden, balanced, but secretly plotting a flavor coup.",
  "green-kinky-mid-dark":
    "Herbal intensity meets funky rebellion. Aromatic chaos embodied.",
  "green-dreadlocks-mid-light":
    "Savory, free‑spirited, and slightly over‑fermented in the best way.",
  "blue-curly-mid-light":
    "Sweet mischief wrapped in dramatic aroma. You hug like a perfume explosion.",
  "blue-straight-light":
    "Polished exterior, creamy interior, and deeply sarcastic soul.",
  "white-kinky-mid-dark":
    "Soft exterior, unpredictable interior quietly scheming for world fondue domination.",
  "white-curly-dark":
    "Melty, emotional, and somehow both classy and sticky at once.",
  "white-dreadlocks-dark":
    "Stretchy resilience with a sharp outline the main character of dairycore.",
  default:
    "We don’t know what to say about you... Perhaps you’re a new kind of cheese entirely!"
};



function preload() {
  cheeseImages = {
    
    // Color shirts
    cheddar: loadImage("../images/cheddar.png"),
    gorgonzola: loadImage("../images/gorgonzola.png"),
    swiss: loadImage("../images/swiss.png"),
    pesto: loadImage("../images/pesto.png"),
    mozzarella: loadImage("../images/mozza.png"),
    
    // Hair Style
    roquefort: loadImage("../images/roquefort.png"),
    parmesan: loadImage("../images/parmesan.png"),
    gouda: loadImage("../images/gouda.png"),
    brie: loadImage("../images/brie.png"),
    provolone: loadImage("../images/provolone.png"),
    
    // Skin-tone
    feta: loadImage("../images/feta.png"),
    bluecheese: loadImage("../images/bluecheese.png"),
    camembert: loadImage("../images/camembert.png"),
    emmental: loadImage("../images/emmental.png")
  };
}

function setup() {
	const canvas = createCanvas(windowWidth * 0.9, windowHeight * 0.9);
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


// All of the particles start in the midde
function createInitialParticles() {
  for (let i = 0; i < 45; i++) {
    colorParticles.push(new CheeseParticle("color"));
    hairParticles.push(new CheeseParticle("hair"));
    skinParticles.push(new CheeseParticle("skin"));
  }
}

// Update and display particles in real time
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

  const scaleX = width / CONFIG.WEBCAM_SIZE;
  const scaleY = height / CONFIG.WEBCAM_SIZE;

  const body = {
    nose: kp.find((k) => k.name === "nose"),
    leftWrist: kp.find((k) => k.name === "left_wrist"),
    rightWrist: kp.find((k) => k.name === "right_wrist"),
    leftElbow: kp.find((k) => k.name === "left_elbow"),
    rightElbow: kp.find((k) => k.name === "right_elbow")
  };

  // Smooth assignment (with interpolation)
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

      if (t) {
        if (p.target) {
          // Interpolate for smoother motion
          p.target.x = lerp(p.target.x, t.x, 0.3);
          p.target.y = lerp(p.target.y, t.y, 0.3);
        } else {
          p.target = t.copy();
        }
      }
    });
  }

  assignTargets(colorParticles);
  assignTargets(hairParticles);
  assignTargets(skinParticles);

  detectHandMotion(body, scaleX, scaleY);
}
window.updateParticlesWithPose = updateParticlesWithPose;





function detectHandMotion(body, scaleX, scaleY) {
  const left = body.leftWrist;
  const right = body.rightWrist;
  const threshold = 25; // pixels per update

  // Skip if wrists aren't detected
  if (!left || !right || left.score < 0.3 || right.score < 0.3) return;

  const leftPos = createVector(left.x * scaleX, left.y * scaleY);
  const rightPos = createVector(right.x * scaleX, right.y * scaleY);

  // Calculate movement distance
  let leftSpeed = 0;
  let rightSpeed = 0;

  if (lastLeftWrist) leftSpeed = p5.Vector.dist(leftPos, lastLeftWrist);
  if (lastRightWrist) rightSpeed = p5.Vector.dist(rightPos, lastRightWrist);

  lastLeftWrist = leftPos.copy();
  lastRightWrist = rightPos.copy();

  // Trigger particle reaction if significant motion detected
  const now = millis();
  if (now - lastMotionTime > 800 && (leftSpeed > threshold || rightSpeed > threshold)) {
    lastMotionTime = now;
  }
}




// ========== CHEESE PARTICLE CLASS ==========

class CheeseParticle {
  constructor(kind) {
    this.kind = kind;
    this.pos = createVector(width / 2, height / 2);
    this.vel = createVector(random(-2, 2), random(-2, 2));
    this.size = random(50, 75);
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

  const comboKey = `${currentColorCheese}-${currentHairCheese}-${currentSkinCheese}`;
  const comboText = `You are ${colorObj.name} (shirt) + ${hairObj.name} (hair) + ${skinObj.name} (skin)!`;

  // Smart fallback generator
  let commentary = comboCommentary[comboKey.toLowerCase()];
  if (!commentary) {
    // make a randomized playful fallback
    const randomFallbacks = [
      "Mild yet unpredictable — we’d ferment art with you any day.",
      "A rare vintage blend of chaos and charm. Aged to perfection?",
      "Distinct, buttery, and a little untamed — definitely a limited-edition flavor.",
      "Somewhere between sweet cream and full meltdown… in a good way.",
      "Mysteriously cheesy. Possibly immortalized on a fancy charcuterie board.",
      "Complex notes of drama and delight swirl in your presence.",
      "Experimental dairy vibes detected — award-winning potential!",
      "Hard to categorize, impossible to ignore — you’re cheese avant-garde."
    ];
    commentary =
      randomFallbacks[Math.floor(Math.random() * randomFallbacks.length)];
  }

  display.innerHTML = `<strong>${comboText}</strong><br><em>${commentary}</em>`;
  display.style.color = "#ffd700";
}