// ========== GLOBAL VARIABLES ==========
let classifier;
let video;
let label = "Waiting...";
let particles = [];
let currentCheeseType = null;
let modelLoadedSuccessfully = false;

// Cheese color mappings (no emojis, no black)
const cheeseColors = {
    'Red': { name: 'Cheddar', color: [255, 150, 0], texture: 'sharp' },
    'Blue': { name: 'Gorgonzola', color: [200, 220, 255], texture: 'veiny' },
    'Yellow': { name: 'Swiss', color: [255, 255, 150], texture: 'holey' },
    'Green': { name: 'Pesto', color: [150, 255, 150], texture: 'herby' },
    'White': { name: 'Mozzarella', color: [255, 255, 255], texture: 'stretchy' }
};

// ========== P5.JS SETUP ==========
function setup() {
    console.log("Setup function started");
    
    // Create canvas that fills most of the screen
    let canvas = createCanvas(800, 600);
    canvas.parent('container');
    console.log("Canvas created");
    
    // Create video capture
    video = createCapture(VIDEO, function() {
        console.log("Video capture ready");
    });
    video.size(320, 240);
    video.hide();
    
    // Initialize classifier -  Replace the link with the trained ML
    const modelURL = 'https://teachablemachine.withgoogle.com/models/QQgaNNlJ1/';
    console.log("Loading model from:", modelURL);
    
    classifier = ml5.imageClassifier(modelURL, modelLoaded);
}

function modelLoaded() {
    console.log("Model Loaded Successfully!");
    modelLoadedSuccessfully = true;
    document.getElementById('cheeseDisplay').textContent = 'Model ready! Show me your shirt!';
    classifyVideo();
}

// ========== CLASSIFICATION ==========
function classifyVideo() {
    if (!modelLoadedSuccessfully) {
        console.log("Model not loaded yet, skipping classification");
        return;
    }
    
    console.log("Classifying video frame...");
    classifier.classify(video, gotResult);
}

function gotResult(error, results) {
    if (error) {
        console.error("Classification error:", error);
        document.getElementById('cheeseDisplay').textContent = 'Error: ' + error;
        return;
    }
    
    console.log("Raw results:", results);
    
    label = results[0].label;
    const confidence = results[0].confidence;
    
    console.log(`Detected: ${label} (confidence: ${confidence})`);
    
    // Only update cheese type if confidence is reasonable and it's a new type
    if (confidence > 0.7 && cheeseColors[label] && currentCheeseType !== label) {
        currentCheeseType = label;
        console.log(`Cheese type changed to: ${label}`);
        updateCheeseDisplay();
        createParticleBurst();
    } else {
        console.log(`Not updating - Confidence: ${confidence}, Valid: ${cheeseColors[label]}, New: ${currentCheeseType !== label}`);
    }
    
    // Continue classifying
    setTimeout(classifyVideo, 1000);
}

function updateCheeseDisplay() {
    const display = document.getElementById('cheeseDisplay');
    const cheese = cheeseColors[currentCheeseType];
    display.textContent = `You are ${cheese.name} Cheese!`;
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
        this.size = random(15, 35);
        this.life = 255;
        this.decay = random(1, 3);
        this.rotation = random(0, TWO_PI);
        this.rotationSpeed = random(-0.1, 0.1);
    }
    
    update() {
        this.pos.add(this.vel);
        this.vel.mult(0.98); // Slow down over time
        this.life -= this.decay;
        this.rotation += this.rotationSpeed;
        
        // Add some random movement for organic behavior
        this.vel.x += random(-0.2, 0.2);
        this.vel.y += random(-0.2, 0.2);
        
        // Add slight gravity
        this.vel.y += 0.05;
    }
    
    display() {
        const alpha = this.life / 255;
        const [r, g, b] = this.cheeseType.color;
        
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.rotation);
        
        // Draw cheese particle based on texture type
        fill(r, g, b, alpha * 200);
        stroke(r * 0.8, g * 0.8, b * 0.8, alpha * 255);
        strokeWeight(1);
        
        // Different self-drawn shapes for different cheese textures
        if (this.cheeseType.texture === 'holey') {
            this.drawSwissParticle();
        } else if (this.cheeseType.texture === 'veiny') {
            this.drawBlueCheeseParticle();
        } else if (this.cheeseType.texture === 'herby') {
            this.drawPestoParticle();
        } else if (this.cheeseType.texture === 'stretchy') {
            this.drawMozzarellaParticle();
        } else {
            this.drawBasicCheeseParticle();
        }
        
        pop();
    }
    
    drawBasicCheeseParticle() {
        // Simple cheese wedge shape
        beginShape();
        vertex(0, -this.size/2);
        vertex(this.size/2, this.size/4);
        vertex(0, this.size/2);
        vertex(-this.size/2, this.size/4);
        endShape(CLOSE);
    }
    
    drawSwissParticle() {
        // Swiss cheese with holes
        ellipse(0, 0, this.size);
        
        // Draw holes
        fill(50, 50, 50, this.life);
        noStroke();
        ellipse(-this.size/4, -this.size/6, this.size/5);
        ellipse(this.size/4, this.size/6, this.size/6);
        ellipse(0, this.size/4, this.size/7);
    }
    
    drawBlueCheeseParticle() {
        // Blue cheese with veins
        rect(0, 0, this.size, this.size, 5);
        
        // Draw blue veins
        stroke(100, 100, 200, this.life * 0.8);
        strokeWeight(2);
        line(-this.size/3, -this.size/3, this.size/3, this.size/3);
        line(this.size/3, -this.size/3, -this.size/3, this.size/3);
        line(0, -this.size/2, 0, this.size/2);
    }
    
    drawPestoParticle() {
        // Pesto cheese with herb specks
        ellipse(0, 0, this.size);
        
        // Draw herb specks
        fill(50, 100, 50, this.life);
        noStroke();
        ellipse(-this.size/3, 0, this.size/8);
        ellipse(this.size/4, -this.size/4, this.size/10);
        ellipse(this.size/5, this.size/3, this.size/9);
        ellipse(-this.size/5, this.size/4, this.size/7);
    }
    
    drawMozzarellaParticle() {
        // Stretchy mozzarella - oval shape
        ellipse(0, 0, this.size, this.size * 0.6);
        
        // Draw stretch lines
        stroke(255, 255, 255, this.life * 0.6);
        strokeWeight(1);
        line(-this.size/3, 0, this.size/3, 0);
        line(0, -this.size/4, 0, this.size/4);
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
    text(`Model Ready: ${modelLoadedSuccessfully}`, 10, 160);
    pop();
    
    // Display debug info
    fill(255);
    textSize(16);
    text(`Debug - Model: ${modelLoadedSuccessfully} | Label: ${label}`, 10, 30);
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

// Test function - press keys 1-5 to manually test cheese types
function keyPressed() {
    const testCheeses = ['Red', 'Blue', 'Yellow', 'Green', 'White'];
    if (key >= '1' && key <= '5') {
        currentCheeseType = testCheeses[key - 1];
        updateCheeseDisplay();
        createParticleBurst();
        console.log("Manual test:", currentCheeseType);
    }
}