// ==========================================
// 1. HELPER: GENERATE HEART TEXTURE
// ==========================================
function createHeartTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Draw Heart Shape
    ctx.fillStyle = "#ff5588";
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.bezierCurveTo(64, 25, 60, 10, 30, 10);
    ctx.bezierCurveTo(0, 10, 0, 50, 64, 110);
    ctx.bezierCurveTo(128, 50, 128, 10, 98, 10);
    ctx.bezierCurveTo(70, 10, 64, 25, 64, 30);
    ctx.fill();

    // Add Glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = "white";
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// ==========================================
// 2. THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050005, 0.002);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// --- PARTICLE SYSTEMS ---

// System A: Ambient Floating Dust (Atmosphere)
const dustGeo = new THREE.BufferGeometry();
const dustCount = 1000;
const dustPos = new Float32Array(dustCount * 3);
for(let i=0; i<dustCount*3; i++) dustPos[i] = (Math.random()-0.5)*200;
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustMat = new THREE.PointsMaterial({ size: 0.4, color: 0xffccdd, transparent: true, opacity: 0.6 });
const dustParticles = new THREE.Points(dustGeo, dustMat);
scene.add(dustParticles);

// System B: Explosion Particles (Hearts)
const heartTexture = createHeartTexture();
const explodeCount = 2000;
const explodeGeo = new THREE.BufferGeometry();
const explodePos = new Float32Array(explodeCount * 3);
const explodeVel = new Float32Array(explodeCount * 3); // Velocity
const explodeOpacities = new Float32Array(explodeCount); // Opacity lifecycle

// Initialize hidden
for(let i=0; i<explodeCount; i++) {
    explodePos[i*3+1] = -500; // Hide below screen
    explodeOpacities[i] = 0;
}

explodeGeo.setAttribute('position', new THREE.BufferAttribute(explodePos, 3));
explodeGeo.setAttribute('alpha', new THREE.BufferAttribute(explodeOpacities, 1));

const explodeMat = new THREE.ShaderMaterial({
    uniforms: {
        pointTexture: { value: heartTexture }
    },
    vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
            vAlpha = alpha;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 20.0 * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D pointTexture;
        varying float vAlpha;
        void main() {
            gl_FragColor = texture2D(pointTexture, gl_PointCoord);
            gl_FragColor.a *= vAlpha;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

const explosions = new THREE.Points(explodeGeo, explodeMat);
scene.add(explosions);

// Function to launch Fireworks
function triggerFirework() {
    const positions = explodeGeo.attributes.position.array;
    const alphas = explodeGeo.attributes.alpha.array;
    
    // Activate 50 particles at a time
    for(let i=0; i<50; i++) {
        // Find a "dead" particle (alpha near 0)
        const randIndex = Math.floor(Math.random() * explodeCount);
        
        // Set Start Position (Bottom Center-ish)
        positions[randIndex*3] = (Math.random() - 0.5) * 10;
        positions[randIndex*3+1] = -20; 
        positions[randIndex*3+2] = (Math.random() - 0.5) * 10;

        // Set Velocity (Up and Out)
        explodeVel[randIndex*3] = (Math.random() - 0.5) * 1.5; // X
        explodeVel[randIndex*3+1] = 0.5 + Math.random() * 1.0; // Y (Up)
        explodeVel[randIndex*3+2] = (Math.random() - 0.5) * 1.5; // Z

        alphas[randIndex] = 1.0; // Visible
    }
}

// ==========================================
// 3. GAME LOGIC & HAND TRACKING
// ==========================================
let currentStage = 1; // 1 = Q1, 2 = Q2, 3 = Final
let transitionLocked = false;

const uiStage1 = document.getElementById('stage-1');
const uiStage2 = document.getElementById('stage-2');
const uiStage3 = document.getElementById('stage-3');

const videoElement = document.getElementsByClassName('input_video')[0];

function onResults(results) {
    // Hide loading screen once tracking starts
    const loader = document.getElementById('loading-screen');
    if(loader) loader.style.display = 'none';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // 1. PINCH DETECTION (Question 1)
        if (currentStage === 1 && !transitionLocked) {
            const thumb = landmarks[4];
            const index = landmarks[8];
            const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y);

            if (distance < 0.05) {
                transitionLocked = true;
                
                // Action: UI Change
                uiStage1.classList.remove('active');
                
                // Firework loop for 3 seconds
                let fwInterval = setInterval(triggerFirework, 100);
                setTimeout(() => clearInterval(fwInterval), 3000);

                // Wait 15 Seconds then show Q2
                setTimeout(() => {
                    currentStage = 2;
                    transitionLocked = false;
                    uiStage2.classList.add('active');
                }, 15000); 
            }
        }

        // 2. RAISE HAND DETECTION (Question 2)
        if (currentStage === 2 && !transitionLocked) {
            const middleTip = landmarks[12];
            
            // Check if Middle Finger Tip Y is < 0.3 (Top 30% of screen)
            if (middleTip.y < 0.3) {
                transitionLocked = true;

                uiStage2.classList.remove('active');
                uiStage3.classList.add('active');
                currentStage = 3;

                // MASSIVE CELEBRATION
                setInterval(triggerFirework, 50); // Fast fireworks forever
            }
        }
    }
}

// Setup MediaPipe
const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.6 });
hands.onResults(onResults);

// Setup Camera
const cameraUtils = new Camera(videoElement, {
    onFrame: async () => { await hands.send({image: videoElement}); },
    width: 1280, height: 720
});

// Error Handling for Camera
cameraUtils.start().catch(err => {
    console.error(err);
    document.getElementById('error-msg').style.display = 'block';
});

// ==========================================
// 4. ANIMATION LOOP
// ==========================================
function animate() {
    requestAnimationFrame(animate);

    // Rotate ambient dust
    dustParticles.rotation.y += 0.001;

    // Physics for Explosion Particles
    const pos = explodeGeo.attributes.position.array;
    const alphas = explodeGeo.attributes.alpha.array;

    for(let i=0; i<explodeCount; i++) {
        if(alphas[i] > 0) {
            const i3 = i*3;
            // Move
            pos[i3] += explodeVel[i3];
            pos[i3+1] += explodeVel[i3+1];
            pos[i3+2] += explodeVel[i3+2];
            
            // Gravity
            explodeVel[i3+1] -= 0.02;

            // Fade out
            alphas[i] -= 0.01;
        }
    }
    explodeGeo.attributes.position.needsUpdate = true;
    explodeGeo.attributes.alpha.needsUpdate = true;

    renderer.render(scene, camera);
}

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start Animation
animate();