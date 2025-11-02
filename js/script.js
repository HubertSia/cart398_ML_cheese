// ========== GLOBAL VARIABLES ==========
let classifier;
let video;
let label = "Waiting...";
let particles = [];
let currentCheeseType = null;

// Cheese color mappings
const cheeseColors = {
    'Red': { name: '🧀 Cheddar', color: [255, 150, 0], texture: 'sharp' },
    'Blue': { name: '🫕 Gorgonzola', color: [200, 220, 255], texture: 'veiny' },
    'Yellow': { name: '🇨🇭 Swiss', color: [255, 255, 150], texture: 'holey' },
    'Green': { name: '🌿 Pesto', color: [150, 255, 150], texture: 'herby' },
    'Black': { name: '🍯 Brie', color: [255, 255, 200], texture: 'creamy' },
    'White': { name: '🥛 Mozzarella', color: [255, 255, 255], texture: 'stretchy' }
};

// ========== P5.JS SETUP ==========
function setup() {
    // Create canvas that fills most of the screen
    let canvas = createCanvas(800, 600);
    canvas.parent('container');
    
    // Create video capture
    video = createCapture(VIDEO);
    video.size(320, 240);
    video.hide();
    
    // Initialize classifier - REPLACE THIS URL WITH YOUR TEACHABLE MACHINE MODEL URL
    const modelURL = 'https://teachablemachine.withgoogle.com/models/YOUR_MODEL_ID/model.json';
    
    classifier = ml5.imageClassifier(modelURL, modelLoaded);
}

function modelLoaded() {
    console.log('Model Loaded!');
    document.getElementById('cheeseDisplay').textContent = 'Model ready! Show me your shirt!';
    classifyVideo();
}

// ========== CLASSIFICATION ==========
function classifyVideo() {
    classifier.classify(video, gotResult);
}

function gotResult(error, results) {
    if (error) {
        console.error(error);
        return;
    }
    
    label = results[0].label;
    const confidence = results[0].confidence;
    
    // Only update cheese type if confidence is reasonable and it's a new type
    if (confidence > 0.7 && cheeseColors[label] && currentCheeseType !== label) {
        currentCheeseType = label;
        updateCheeseDisplay();
        createParticleBurst();
    }
    
    // Continue classifying
    classifyVideo();
}

function updateCheeseDisplay() {
    const display = document.getElementById('cheeseDisplay');
    const cheese = cheeseColors[currentCheeseType];
    display.textContent = `You are ${cheese.name}!`;
    display.style.color = `rgb(${cheese.color.join(',')})`;
}

// ========== PARTICLE SYSTEM ==========
function createParticleBurst() {
    // Clear old particles
    particles = [];
    
    // Create new particles
    for (let i = 0; i < 50; i++) {
        particles.push(new CheeseParticle());
    }
}

class CheeseParticle {
    constructor() {
        this.cheeseType = cheeseColors[currentCheeseType];
        this.pos = createVector(width/2, height/2);
        this.vel = createVector(random(-3, 3), random(-3, 3));
        this.size = random(10, 30);
        this.life = 255;
        this.decay = random(1, 3);
    }
    
    update() {
        this.pos.add(this.vel);
        this.vel.mult(0.98); // Slow down over time
        this.life -= this.decay;
        
        // Add some random movement for cheese-like behavior
        this.vel.x += random(-0.2, 0.2);
        this.vel.y += random(-0.2, 0.2);
    }
    
    display() {
        const alpha = this.life / 255;
        const [r, g, b] = this.cheeseType.color;
        
        push();
        translate(this.pos.x, this.pos.y);
        
        // Draw cheese particle based on texture type
        fill(r, g, b, alpha * 200);
        stroke(r * 0.8, g * 0.8, b * 0.8, alpha * 255);
        strokeWeight(2);
        
        // Different shapes for different cheese textures
        if (this.cheeseType.texture === 'holey') {
            // Swiss cheese with holes
            ellipse(0, 0, this.size);
            fill(50, 50, 50, alpha * 150);
            noStroke();
            ellipse(-this.size/4, -this.size/6, this.size/4);
            ellipse(this.size/4, this.size/6, this.size/5);
        } else if (this.cheeseType.texture === 'veiny') {
            // Blue cheese veins
            rect(0, 0, this.size, this.size, 5);
            stroke(100, 100, 200, alpha * 200);
            line(-this.size/3, -this.size/3, this.size/3, this.size/3);
            line(this.size/3, -this.size/3, -this.size/3, this.size/3);
        } else {
            // Default round cheese particle
            ellipse(0, 0, this.size);
        }
        
        pop();
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// ========== P5.JS DRAW LOOP ==========
function draw() {
    // Semi-transparent background for trail effect
    background(0, 0, 0, 25);
    
    // Update and display particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].display();
        
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
    
    // Display webcam feed in corner for debugging
    push();
    translate(width - 180, 20);
    image(video, 0, 0, 160, 120);
    fill(255);
    textSize(12);
    text(`Detected: ${label}`, 10, 140);
    pop();
}

// ========== INTERACTION ==========
function mouseMoved() {
    // Add new particles at mouse position for testing without webcam
    if (currentCheeseType) {
        for (let i = 0; i < 3; i++) {
            let p = new CheeseParticle();
            p.pos = createVector(mouseX, mouseY);
            p.vel = createVector(random(-2, 2), random(-2, 2));
            particles.push(p);
        }
    }
}