// ========== GLOBAL VARIABLES ==========
let teachableMachineModel;
let webcam;
let poseDetector;
let particles = [];
let currentCheeseType = 'Red';
let targetCheeseType = 'Red';
let poseModelLoaded = false;
let poses = [];
let isRunning = false;
let maxPredictions;
let transitionProgress = 1.0; // 0-1, 1 means transition complete
const TRANSITION_SPEED = 0.05; // How fast transitions happen

// Cheese color mappings
const cheeseColors = {
    red: { name: 'Cheddar', color: [255, 150, 0], texture: 'sharp' },
    blue: { name: 'Gorgonzola', color: [200, 220, 255], texture: 'veiny' },
    yellow: { name: 'Swiss', color: [255, 255, 150], texture: 'holey' },
    green: { name: 'Pesto', color: [150, 255, 150], texture: 'herby' },
    white: { name: 'Mozzarella', color: [255, 255, 255], texture: 'stretchy' }
};

// ========== P5.JS SETUP ==========
function setup() {
    console.log("P5.js Setup started");
    
    // Create canvas
    let canvas = createCanvas(800, 600);
    canvas.parent('container');
    
    // Create initial particles
    createInitialParticles();
    
    console.log("P5.js Setup complete - waiting for Teachable Machine init");
}

// ========== TEACHABLE MACHINE SETUP ==========
async function initTeachableMachine() {
    if (isRunning) return;
    
    console.log("Initializing Teachable Machine...");
    document.getElementById('status').textContent = 'Loading Teachable Machine model...';
    document.getElementById('startButton').disabled = true;
    document.getElementById('startButton').textContent = 'Loading...';
    
    try {
        // Your Teachable Machine model URL
        const URL = 'https://teachablemachine.withgoogle.com/models/QQgaNNlJ1/';
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        // Load the model and metadata
        teachableMachineModel = await tmImage.load(modelURL, metadataURL);
        maxPredictions = teachableMachineModel.getTotalClasses();
        
        console.log("Teachable Machine model loaded with", maxPredictions, "classes");

        // Setup webcam
        const flip = true;
        webcam = new tmImage.Webcam(200, 200, flip);
        await webcam.setup();
        await webcam.play();
        
        // Append webcam to container
        const webcamContainer = document.getElementById('webcam-container');
        webcamContainer.innerHTML = '';
        webcamContainer.appendChild(webcam.canvas);
        webcamContainer.style.display = 'block';

        // Setup label container
        const labelContainer = document.getElementById('label-container');
        labelContainer.innerHTML = '';
        for (let i = 0; i < maxPredictions; i++) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'prediction-label';
            labelContainer.appendChild(labelDiv);
        }
        labelContainer.style.display = 'block';

        // Initialize pose detection
        await initPoseDetection();

        // Start the prediction loop
        isRunning = true;
        document.getElementById('status').textContent = 'Model ready! Show me your shirt color!';
        document.getElementById('startButton').textContent = 'Running...';
        
        // Start prediction loop
        predictionLoop();
        
    } catch (error) {
        console.error("Error initializing Teachable Machine:", error);
        document.getElementById('status').textContent = 'Error: ' + error.message;
        document.getElementById('startButton').disabled = false;
        document.getElementById('startButton').textContent = 'Start Camera & Model';
    }
}

async function predictionLoop() {
    if (!isRunning) return;
    
    try {
        webcam.update();
        await predict();
        
        // Continue the loop
        setTimeout(predictionLoop, 100);
    } catch (error) {
        console.error("Error in prediction loop:", error);
    }
}

// ========== PREDICTION ==========
async function predict() {
    if (!teachableMachineModel || !isRunning) return;
    
    const prediction = await teachableMachineModel.predict(webcam.canvas);
    
    // Update label container
    const labelContainer = document.getElementById('label-container');
    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction = prediction[i].className + ": " + (prediction[i].probability * 100).toFixed(1) + "%";
        labelContainer.childNodes[i].innerHTML = classPrediction;
    }

    // Find the highest confidence prediction
    let highestConfidence = 0;
    let detectedClass = null;

    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > highestConfidence) {
            highestConfidence = prediction[i].probability;
            detectedClass = prediction[i].className;
        }
    }

    // Normalize the detected class name
    if (detectedClass) {
        detectedClass = detectedClass.trim().toLowerCase().replace(/\s+/g, '');
    }

    // Also normalize cheeseColors keys so we can match regardless of format
    const normalizedCheeseColors = {};
    for (const key in cheeseColors) {
        normalizedCheeseColors[key.toLowerCase()] = cheeseColors[key];
    }

    // Start transition if confidence is high enough and it's a new type
    if (highestConfidence > 0.7 && normalizedCheeseColors[detectedClass] && targetCheeseType !== detectedClass) {
        targetCheeseType = detectedClass;
        transitionProgress = 0.0; // Start new transition
        console.log(` Transitioning to: ${detectedClass} (${(highestConfidence * 100).toFixed(1)}%)`);
    }
}


function interpolateColor(color1, color2, progress) {
    return [
        lerp(color1[0], color2[0], progress),
        lerp(color1[1], color2[1], progress),
        lerp(color1[2], color2[2], progress)
    ];
}

function updateTransition() {
    if (transitionProgress < 1.0) {
        transitionProgress += TRANSITION_SPEED;
        
        if (transitionProgress >= 1.0) {
            // Ensure valid lowercase key
            currentCheeseType = targetCheeseType.toLowerCase();

            // Fallback if the detected key doesn’t exist
            if (!cheeseColors[currentCheeseType]) {
                console.warn("⚠ Unknown cheese type:", currentCheeseType, "- defaulting to red");
                currentCheeseType = 'red';
            }

            updateCheeseDisplay();
        }
    }
}

function getTransitionCheeseType() {
    const fromKey = currentCheeseType?.toLowerCase() || 'red';
    const toKey = targetCheeseType?.toLowerCase() || fromKey;

    const fromCheese = cheeseColors[fromKey] || cheeseColors['red'];
    const toCheese = cheeseColors[toKey] || fromCheese;

    if (transitionProgress >= 1.0) return toCheese;

    return {
        name: toCheese.name,
        color: interpolateColor(fromCheese.color, toCheese.color, transitionProgress),
        texture: transitionProgress > 0.5 ? toCheese.texture : fromCheese.texture
    };
}

// ========== TENSORFLOW.JS POSE DETECTION ==========
async function initPoseDetection() {
    console.log("Initializing TensorFlow.js pose detection...");
    
    if (typeof tf === 'undefined' || typeof poseDetection === 'undefined') {
        console.warn("TensorFlow.js or Pose Detection not available - particles will not follow body");
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
        console.error("Error loading pose detection model:", error);
    }
}

async function detectPose() {
    if (!poseModelLoaded || !poseDetector || !webcam) return;
    
    try {
        poses = await poseDetector.estimatePoses(webcam.canvas, {
            maxPoses: 1,
            flipHorizontal: false
        });
        
        updateParticlesWithPose();
        
    } catch (error) {
        console.error("Error detecting pose:", error);
    }
}

// ========== PARTICLE SYSTEM ==========
function createInitialParticles() {
    particles = [];
    for (let i = 0; i < 80; i++) {
        particles.push(new CheeseParticle(width/2, height/2));
    }
}

function createParticleBurst(x, y, count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push(new CheeseParticle(x, y));
    }
}

class CheeseParticle {
    constructor(x, y) {
        this.cheeseType = cheeseColors[currentCheeseType];
        this.pos = createVector(x, y);
        this.vel = createVector(random(-2, 2), random(-2, 2));
        this.size = random(10, 25);
        this.life = 255;
        this.decay = random(0.3, 1);
        this.rotation = random(0, TWO_PI);
        this.rotationSpeed = random(-0.05, 0.05);
        this.followStrength = random(0.005, 0.02);
        this.target = null;
        this.transitionProgress = 1.0;
    }
    
    update() {
        // Update particle's transition progress to match global transition
        this.transitionProgress = transitionProgress;
        
        if (this.target) {
            const direction = p5.Vector.sub(this.target, this.pos);
            direction.mult(this.followStrength);
            this.vel.add(direction);
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
        
        // Get the current cheese type for this particle (with transition)
        const currentCheese = getTransitionCheeseType();
        const [r, g, b] = currentCheese.color;
        
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.rotation);
        
        fill(r, g, b, alpha * 200);
        stroke(r * 0.8, g * 0.8, b * 0.8, alpha * 255);
        strokeWeight(1);
        
        // Use texture based on transition progress
        const texture = currentCheese.texture;
        
        if (texture === 'holey') {
            this.drawSwissParticle();
        } else if (texture === 'veiny') {
            this.drawBlueCheeseParticle();
        } else if (texture === 'herby') {
            this.drawPestoParticle();
        } else if (texture === 'stretchy') {
            this.drawMozzarellaParticle();
        } else {
            this.drawBasicCheeseParticle();
        }
        
        pop();
    }
    
    drawBasicCheeseParticle() {
        beginShape();
        vertex(0, -this.size/2);
        vertex(this.size/2, this.size/4);
        vertex(0, this.size/2);
        vertex(-this.size/2, this.size/4);
        endShape(CLOSE);
    }
    
    drawSwissParticle() {
        ellipse(0, 0, this.size);
        fill(50, 50, 50, this.life);
        noStroke();
        ellipse(-this.size/4, -this.size/6, this.size/5);
        ellipse(this.size/4, this.size/6, this.size/6);
    }
    
    drawBlueCheeseParticle() {
        rect(0, 0, this.size, this.size, 5);
        stroke(100, 100, 200, this.life * 0.8);
        strokeWeight(2);
        line(-this.size/3, -this.size/3, this.size/3, this.size/3);
        line(this.size/3, -this.size/3, -this.size/3, this.size/3);
    }
    
    drawPestoParticle() {
        ellipse(0, 0, this.size);
        fill(50, 100, 50, this.life);
        noStroke();
        ellipse(-this.size/3, 0, this.size/8);
        ellipse(this.size/4, -this.size/4, this.size/10);
    }
    
    drawMozzarellaParticle() {
        ellipse(0, 0, this.size, this.size * 0.6);
        stroke(255, 255, 255, this.life * 0.6);
        strokeWeight(1);
        line(-this.size/3, 0, this.size/3, 0);
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// ========== UPDATE PARTICLES WITH POSE DATA ==========
function updateParticlesWithPose() {
    if (poses.length === 0 || !poses[0].keypoints) return;
    
    const pose = poses[0];
    const keypoints = pose.keypoints;
    const scaleX = width / 200;
    const scaleY = height / 200;
    
    const bodyPoints = {
        nose: keypoints.find(kp => kp.name === 'nose'),
        leftWrist: keypoints.find(kp => kp.name === 'left_wrist'),
        rightWrist: keypoints.find(kp => kp.name === 'right_wrist'),
        leftElbow: keypoints.find(kp => kp.name === 'left_elbow'),
        rightElbow: keypoints.find(kp => kp.name === 'right_elbow')
    };
    
    particles.forEach((particle, index) => {
        let targetPoint = null;
        const group = index % 5;
        
        if (group === 0 && bodyPoints.nose && bodyPoints.nose.score > 0.3) {
            targetPoint = createVector(bodyPoints.nose.x * scaleX, bodyPoints.nose.y * scaleY);
        } else if (group === 1 && bodyPoints.leftWrist && bodyPoints.leftWrist.score > 0.3) {
            targetPoint = createVector(bodyPoints.leftWrist.x * scaleX, bodyPoints.leftWrist.y * scaleY);
        } else if (group === 2 && bodyPoints.rightWrist && bodyPoints.rightWrist.score > 0.3) {
            targetPoint = createVector(bodyPoints.rightWrist.x * scaleX, bodyPoints.rightWrist.y * scaleY);
        } else if (group === 3 && bodyPoints.leftElbow && bodyPoints.leftElbow.score > 0.3) {
            targetPoint = createVector(bodyPoints.leftElbow.x * scaleX, bodyPoints.leftElbow.y * scaleY);
        } else if (group === 4 && bodyPoints.rightElbow && bodyPoints.rightElbow.score > 0.3) {
            targetPoint = createVector(bodyPoints.rightElbow.x * scaleX, bodyPoints.rightElbow.y * scaleY);
        }
        
        particle.target = targetPoint;
    });
}

// ========== P5.JS DRAW LOOP ==========
function draw() {
    background(0, 0, 0, 25);
    
    // Update transition
    updateTransition();
    
    // Detect pose periodically
    if (isRunning && poseModelLoaded && frameCount % 8 === 0) {
        detectPose();
    }
    
    // Update and display particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].display();
        
        if (particles[i].isDead()) {
            particles.splice(i, 1);
            particles.push(new CheeseParticle(random(width), random(height)));
        }
    }
    
    // Display debug info
    fill(255);
    textSize(14);
    text(`Teachable Machine: ${isRunning ? 'Running' : 'Stopped'} | Pose: ${poseModelLoaded ? 'Ready' : 'Off'}`, 10, 20);
    text(`Particles: ${particles.length} | Current: ${currentCheeseType} | Target: ${targetCheeseType}`, 10, 40);
    text(`Transition: ${(transitionProgress * 100).toFixed(1)}%`, 10, 60);
    
    // Display transition bar
    if (transitionProgress < 1.0) {
        drawTransitionBar();
    }
    
    
    text(`Current: ${currentCheeseType}`, 10, 80);
    text(`Target: ${targetCheeseType}`, 10, 100);

    
}

function drawTransitionBar() {
    const barWidth = 200;
    const barHeight = 10;
    const x = width - barWidth - 20;
    const y = 20;
    
    // Background
    fill(100);
    rect(x, y, barWidth, barHeight);
    
    // Progress
    fill(255, 200, 0);
    rect(x, y, barWidth * transitionProgress, barHeight);
    
    // Text
    fill(255);
    textSize(12);
    text("Transition", x, y - 5);
}

// ========== HELPER FUNCTIONS ==========
function updateCheeseDisplay() {
    const display = document.getElementById('cheeseDisplay');
    if (currentCheeseType && cheeseColors[currentCheeseType]) {
        const cheese = cheeseColors[currentCheeseType];
        display.textContent = `You are ${cheese.name} Cheese!`;
        display.style.color = `rgb(${cheese.color.join(',')})`;
        display.style.transition = 'color 0.5s ease'; // Smooth text color transition
    }
}

// ========== INTERACTION ==========
function keyPressed() {
    const testCheeses = ['Red', 'Blue', 'Yellow', 'Green', 'White'];
    if (key >= '1' && key <= '5') {
        targetCheeseType = testCheeses[key - 1];
        transitionProgress = 0.0;
        console.log("Manual transition to:", targetCheeseType);
    }
}

function mouseMoved() {
    for (let i = 0; i < Math.min(3, particles.length); i++) {
        particles[i].target = createVector(mouseX, mouseY);
    }
}