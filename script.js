// ==========================================
// 1. TEXTURE GENERATORS (Hearts, Balloons, Kisses)
// ==========================================
function createTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (type === 'heart') {
        ctx.fillStyle = "#ff0055"; // Red
        ctx.beginPath();
        ctx.moveTo(32, 15);
        ctx.bezierCurveTo(32, 12, 30, 5, 15, 5);
        ctx.bezierCurveTo(0, 5, 0, 25, 32, 55);
        ctx.bezierCurveTo(64, 25, 64, 5, 49, 5);
        ctx.bezierCurveTo(35, 5, 32, 12, 32, 15);
        ctx.fill();
    } else if (type === 'balloon') {
        ctx.fillStyle = "#8800ff"; // Purple/Blue
        ctx.beginPath();
        ctx.arc(32, 28, 22, 0, Math.PI * 2);
        ctx.fill();
        // String
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.moveTo(32, 50);
        ctx.lineTo(32, 64);
        ctx.stroke();
    } else if (type === 'kiss') {
        ctx.fillStyle = "#ff66b2"; // Pink
        ctx.font = "40px Arial";
        ctx.fillText("💋", 10, 45); // Using Emoji for Kiss shape
    }
    
    // Add Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = "white";
    
    return new THREE.CanvasTexture(canvas);
}

// ==========================================
// 2. THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050005, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 40;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// --- PARTICLE ENGINES (One for each type) ---
function createParticleSystem(type, count) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count); // Lifetime

    for(let i=0; i<count; i++) {
        pos[i*3+1] = -500; // Hide initially
        life[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('life', new THREE.BufferAttribute(life, 1));

    const mat = new THREE.PointsMaterial({
        map: createTexture(type),
        size: type === 'balloon' ? 1.5 : 1.0, // Balloons bigger
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.NormalBlending // Better visibility for colors
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    return { points, geo, vel, count };
}

const hearts = createParticleSystem('heart', 1000);
const balloons = createParticleSystem('balloon', 500);
const kisses = createParticleSystem('kiss', 500);
const systems = [hearts, balloons, kisses];

// Function to Launch Particles
function explode(amount) {
    // Randomly choose a system to activate
    systems.forEach(sys => {
        const positions = sys.geo.attributes.position.array;
        const lifes = sys.geo.attributes.life.array;
        
        // Spawn 'amount' particles
        for(let i=0; i<amount; i++) {
            // Find a dead particle
            const idx = Math.floor(Math.random() * sys.count);
            
            if (lifes[idx] <= 0) {
                // Reset Position (Bottom Center with spread)
                positions[idx*3] = (Math.random() - 0.5) * 20;
                positions[idx*3+1] = -25; 
                positions[idx*3+2] = (Math.random() - 0.5) * 10;

                // Velocity (Upwards)
                sys.vel[idx*3] = (Math.random() - 0.5) * 0.5; // X spread
                sys.vel[idx*3+1] = 0.3 + Math.random() * 0.5; // Y Speed
                sys.vel[idx*3+2] = (Math.random() - 0.5) * 0.5; // Z spread

                lifes[idx] = 1.0; // Life starts at 1
            }
        }
        sys.geo.attributes.position.needsUpdate = true;
        sys.geo.attributes.life.needsUpdate = true;
    });
}

// ==========================================
// 3. LOGIC & TRACKING
// ==========================================
let currentStage = 1; 
let transitionLocked = false;
let holdTimer = 0; // To force user to hold gesture

const uiStage1 = document.getElementById('stage-1');
const uiStage2 = document.getElementById('stage-2');
const uiStage3 = document.getElementById('stage-3');
const videoElement = document.getElementsByClassName('input_video')[0];

function onResults(results) {
    document.getElementById('loading-screen').style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        let gestureDetected = false;

        // --- STAGE 1: PINCH ---
        if (currentStage === 1 && !transitionLocked) {
            const thumb = landmarks[4];
            const index = landmarks[8];
            const dist = Math.hypot(thumb.x - index.x, thumb.y - index.y);

            // Strict pinch distance
            if (dist < 0.05) {
                gestureDetected = true;
                holdTimer++;
                // TRIGGER SMALL PARTICLES WHILE HOLDING
                if(holdTimer % 5 === 0) explode(2); 
            }
        }

        // --- STAGE 2: HIGH HAND ---
        if (currentStage === 2 && !transitionLocked) {
            const middleTip = landmarks[12];
            const wrist = landmarks[0];
            
            // Hand must be OPEN (distance wrist to tip is large)
            const handSize = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
            // Hand must be HIGH (y < 0.3)
            
            if (middleTip.y < 0.3 && handSize > 0.2) {
                gestureDetected = true;
                holdTimer++;
                if(holdTimer % 5 === 0) explode(2);
            }
        }

        // --- TRANSITION LOGIC (Must hold for 30 frames ~ 1 second) ---
        if (gestureDetected) {
            if (holdTimer > 30) {
                nextLevel();
            }
        } else {
            holdTimer = 0; // Reset if hand moves
        }
    }
}

function nextLevel() {
    if (transitionLocked) return;
    transitionLocked = true;
    holdTimer = 0;

    if (currentStage === 1) {
        // Clear Stage 1
        uiStage1.classList.remove('active');
        
        // EXPLOSION LOOP (3 Seconds)
        let count = 0;
        const interval = setInterval(() => {
            explode(20); // Big explosion
            count++;
            if(count > 30) clearInterval(interval);
        }, 100);

        // Wait 15s for Stage 2
        setTimeout(() => {
            currentStage = 2;
            transitionLocked = false;
            uiStage2.classList.add('active');
        }, 15000);
    }
    else if (currentStage === 2) {
        // Clear Stage 2
        uiStage2.classList.remove('active');
        
        // Show Final
        currentStage = 3;
        uiStage3.classList.add('active');

        // PERMANENT CELEBRATION
        setInterval(() => {
            explode(30);
        }, 200);
    }
}

// MediaPipe Setup
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
hands.onResults(onResults);

const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});
cameraUtils.start();

// ==========================================
// 4. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    // Update all 3 particle systems
    systems.forEach(sys => {
        const positions = sys.geo.attributes.position.array;
        const lifes = sys.geo.attributes.life.array;

        for(let i=0; i<sys.count; i++) {
            if (lifes[i] > 0) {
                const i3 = i*3;
                
                // Move Up
                positions[i3] += sys.vel[i3];
                positions[i3+1] += sys.vel[i3+1];
                positions[i3+2] += sys.vel[i3+2];

                // Gravity/Wobble
                if (sys.points.material.map.image) {
                     // Wobble X for balloons
                     positions[i3] += Math.sin(Date.now() * 0.005 + i) * 0.02;
                }

                // Fade Out
                lifes[i] -= 0.005;
                if(lifes[i] <= 0) positions[i3+1] = -500; // Reset off screen
            }
        }
        sys.geo.attributes.position.needsUpdate = true;
        sys.geo.attributes.life.needsUpdate = true;
    });

    renderer.render(scene, camera);
}

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();