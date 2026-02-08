// Three.js Scene Setup
let scene, camera, renderer, particles;
let particlePositions = [];
let targetPositions = [];
let spherePositions = [];
let animating = false;
let isTextMode = false;
let roamingMode = false; // NEW: Track if particles should roam freely

// Hand Gesture Recognition
let hands, webcamCamera;
let gestureEnabled = false;
let lastGesture = null;
let gestureDebounce = 0;

const PARTICLE_COUNT = 3000;
const SPHERE_RADIUS = 3;

// Initialize Three.js
function init() {
    // Scene
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 8;
    
    // Renderer
    const canvas = document.getElementById('particleCanvas');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Create particles
    createSphereParticles();
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xff6b9d, 1, 100);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
    
    // Animation loop
    animate();
    
    // Event listeners
    setupEventListeners();
}

// Create sphere of particles
function createSphereParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    
    const color1 = new THREE.Color(0xff6b9d); // Rose pink
    const color2 = new THREE.Color(0xd4af37); // Gold
    const color3 = new THREE.Color(0xc44569); // Deep rose
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const r = SPHERE_RADIUS * Math.cbrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        spherePositions.push({ x, y, z });
        particlePositions.push({ x, y, z });
        targetPositions.push({ x, y, z });
        
        const mixRatio = i / PARTICLE_COUNT;
        let color;
        if (mixRatio < 0.5) {
            color = color1.clone().lerp(color2, mixRatio * 2);
        } else {
            color = color2.clone().lerp(color3, (mixRatio - 0.5) * 2);
        }
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

// Convert text to 3D particle positions
function textToParticles(text) {
    if (!text || text.trim() === '') return;
    
    isTextMode = true;
    roamingMode = false;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 800;
    canvas.height = 400;
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 120px Poppins, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    const textPixels = [];
    const sampleRate = 4;
    
    for (let y = 0; y < canvas.height; y += sampleRate) {
        for (let x = 0; x < canvas.width; x += sampleRate) {
            const index = (y * canvas.width + x) * 4;
            const alpha = pixels[index + 3];
            
            if (alpha > 128) {
                const px = (x - canvas.width / 2) / 100;
                const py = -(y - canvas.height / 2) / 100;
                const pz = (Math.random() - 0.5) * 0.5;
                textPixels.push({ x: px, y: py, z: pz });
            }
        }
    }
    
    const pixelCount = textPixels.length;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (i < pixelCount) {
            const pixel = textPixels[i % pixelCount];
            targetPositions[i] = { x: pixel.x, y: pixel.y, z: pixel.z };
        } else {
            const basePixel = textPixels[Math.floor(Math.random() * pixelCount)];
            targetPositions[i] = {
                x: basePixel.x + (Math.random() - 0.5) * 2,
                y: basePixel.y + (Math.random() - 0.5) * 2,
                z: basePixel.z + (Math.random() - 0.5) * 2
            };
        }
    }
    particles.rotation.y = 0;
        particles.rotation.x = 0;
    animating = true;
}

// Reset to sphere
function resetToSphere() {
    isTextMode = false;
    roamingMode = false;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        targetPositions[i] = {
            x: spherePositions[i].x,
            y: spherePositions[i].y,
            z: spherePositions[i].z
        };
    }
    
    animating = true;
}

// NEW: Set particles to roam freely
function setRoamingMode() {
    roamingMode = true;
    isTextMode = false;
    
    // Give each particle a random wandering target
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        targetPositions[i] = {
            x: (Math.random() - 0.5) * 15,
            y: (Math.random() - 0.5) * 15,
            z: (Math.random() - 0.5) * 15
        };
    }
    
    animating = true;
}

// ============================================
// GESTURE SHAPE GENERATORS
// ============================================

// Generate 3D Heart Shape
function setHeartShape() {
    isTextMode = true;
    roamingMode = false;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const t = (i / PARTICLE_COUNT) * Math.PI * 2;
        
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
        
        const scale = 0.15;
        const depth = (Math.random() - 0.5) * 1.5;
        
        targetPositions[i] = {
            x: x * scale,
            y: y * scale,
            z: depth
        };
        
        particles.rotation.y = 0;
        particles.rotation.x = 0;
    }
    
    animating = true;
}

// NEW: Generate Diamond Shape
function setDiamondShape() {
    isTextMode = true;
    roamingMode = false;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ratio = i / PARTICLE_COUNT;
        
        if (ratio < 0.25) {
            // Top pyramid (point up)
            const t = ratio / 0.25;
            const radius = 2.5 * (1 - t);
            const angle = t * Math.PI * 8;
            
            targetPositions[i] = {
                x: Math.cos(angle) * radius + (Math.random() - 0.5) * 0.3,
                y: t * 3 + (Math.random() - 0.5) * 0.2,
                z: Math.sin(angle) * radius + (Math.random() - 0.5) * 0.3
            };
        } else if (ratio < 0.5) {
            // Middle band
            const t = (ratio - 0.25) / 0.25;
            const angle = t * Math.PI * 2;
            const radius = 2.5;
            
            targetPositions[i] = {
                x: Math.cos(angle) * radius + (Math.random() - 0.5) * 0.2,
                y: (Math.random() - 0.5) * 0.5,
                z: Math.sin(angle) * radius + (Math.random() - 0.5) * 0.2
            };
        } else {
            // Bottom pyramid (point down)
            const t = (ratio - 0.5) / 0.5;
            const radius = 2.5 * t;
            const angle = t * Math.PI * 8;
            
            targetPositions[i] = {
                x: Math.cos(angle) * radius + (Math.random() - 0.5) * 0.3,
                y: -t * 3 + (Math.random() - 0.5) * 0.2,
                z: Math.sin(angle) * radius + (Math.random() - 0.5) * 0.3
            };
        }
    }
    
    particles.rotation.y = 0;
    particles.rotation.x = 0;
    animating = true;
}

// NEW: Generate Rose Shape
function setRoseShape() {
    isTextMode = true;
    roamingMode = false;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ratio = i / PARTICLE_COUNT;
        
        if (ratio < 0.6) {
            // Rose petals (parametric rose curve)
            const t = (ratio / 0.6) * Math.PI * 4;
            const r = 2 * Math.sin(4 * t);
            
            const x = r * Math.cos(t);
            const y = ratio * 6 - 2; // Vertical spread
            const z = r * Math.sin(t);
            
            targetPositions[i] = {
                x: x + (Math.random() - 0.5) * 0.5,
                y: y + (Math.random() - 0.5) * 0.5,
                z: z + (Math.random() - 0.5) * 0.5
            };
        } else {
            // Stem
            const t = (ratio - 0.6) / 0.4;
            
            targetPositions[i] = {
                x: (Math.random() - 0.5) * 0.3,
                y: -2 - t * 4,
                z: (Math.random() - 0.5) * 0.3
            };
        }
    }
    
    particles.rotation.y = 0;
    particles.rotation.x = 0;
    animating = true;
}

// Peace Sign (V fingers)
function setPeaceSignShape() {
    isTextMode = true;
    roamingMode = false;
    
    const particlesPerFinger = Math.floor(PARTICLE_COUNT / 2);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (i < particlesPerFinger) {
            const t = i / particlesPerFinger;
            const angle = Math.PI / 6;
            
            targetPositions[i] = {
                x: -2 - Math.sin(angle) * t * 6 + (Math.random() - 0.5) * 0.3,
                y: -2 + Math.cos(angle) * t * 6 + (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.5
            };
        } else {
            const t = (i - particlesPerFinger) / particlesPerFinger;
            const angle = -Math.PI / 6;
            
            targetPositions[i] = {
                x: 2 - Math.sin(angle) * t * 6 + (Math.random() - 0.5) * 0.3,
                y: -2 + Math.cos(angle) * t * 6 + (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.5
            };
        }
    }
    particles.rotation.y = 0;
        particles.rotation.x = 0;
    animating = true;
}

// Thumbs Up Shape
function setThumbsUpShape() {
    isTextMode = true;
    roamingMode = false;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ratio = i / PARTICLE_COUNT;
        
        if (ratio < 0.3) {
            const t = ratio / 0.3;
            targetPositions[i] = {
                x: -1 + (Math.random() - 0.5) * 0.8,
                y: -3 + t * 6 + (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.8
            };
        } else if (ratio < 0.7) {
            const t = (ratio - 0.3) / 0.4;
            const angle = t * Math.PI * 2;
            const radius = 1.5;
            
            targetPositions[i] = {
                x: 1 + Math.cos(angle) * radius + (Math.random() - 0.5) * 0.5,
                y: -2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 0.5,
                z: (Math.random() - 0.5) * 1
            };
        } else {
            targetPositions[i] = {
                x: (Math.random() - 0.5) * 3,
                y: -4 + (Math.random() - 0.5) * 1,
                z: (Math.random() - 0.5) * 1
            };
        }
    }
    particles.rotation.y = 0;
        particles.rotation.x = 0;
    animating = true;
}

// Rock On / I Love You Shape
function setRockOnShape() {
    isTextMode = true;
    roamingMode = false;
    
    const particlesPerFinger = Math.floor(PARTICLE_COUNT / 3);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (i < particlesPerFinger) {
            const t = i / particlesPerFinger;
            targetPositions[i] = {
                x: -3 + (Math.random() - 0.5) * 0.5,
                y: -2 + t * 6 + (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.5
            };
        } else if (i < particlesPerFinger * 2) {
            const t = (i - particlesPerFinger) / particlesPerFinger;
            targetPositions[i] = {
                x: 3 + (Math.random() - 0.5) * 0.5,
                y: -2 + t * 5 + (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.5
            };
        } else {
            const t = (i - particlesPerFinger * 2) / (PARTICLE_COUNT - particlesPerFinger * 2);
            targetPositions[i] = {
                x: (Math.random() - 0.5) * 4,
                y: -3 + (Math.random() - 0.5) * 2,
                z: (Math.random() - 0.5) * 1
            };
        }
    }
    particles.rotation.y = 0;
        particles.rotation.x = 0;
    animating = true;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate particles slowly - ONLY when NOT showing text
    if (particles && !isTextMode && !roamingMode) {
        particles.rotation.y += 0.001;
        particles.rotation.x += 0.0005;
    }
    
    // Roaming animation - continuous random wandering
    if (roamingMode) {
        const positions = particles.geometry.attributes.position.array;
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const current = particlePositions[i];
            const target = targetPositions[i];
            
            // Check if reached target, assign new random target
            const distance = Math.sqrt(
                Math.pow(target.x - current.x, 2) +
                Math.pow(target.y - current.y, 2) +
                Math.pow(target.z - current.z, 2)
            );
            
            if (distance < 0.5) {
                // Assign new random wandering target
                targetPositions[i] = {
                    x: (Math.random() - 0.5) * 15,
                    y: (Math.random() - 0.5) * 15,
                    z: (Math.random() - 0.5) * 15
                };
            }
            
            // Move towards target
            const lerpFactor = 0.02;
            current.x += (target.x - current.x) * lerpFactor;
            current.y += (target.y - current.y) * lerpFactor;
            current.z += (target.z - current.z) * lerpFactor;
            
            positions[i * 3] = current.x;
            positions[i * 3 + 1] = current.y;
            positions[i * 3 + 2] = current.z;
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
    }
    
    // Morph animation
    if (animating && !roamingMode) {
        const positions = particles.geometry.attributes.position.array;
        let allReached = true;
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const current = particlePositions[i];
            const target = targetPositions[i];
            
            const lerpFactor = 0.05;
            current.x += (target.x - current.x) * lerpFactor;
            current.y += (target.y - current.y) * lerpFactor;
            current.z += (target.z - current.z) * lerpFactor;
            
            positions[i * 3] = current.x;
            positions[i * 3 + 1] = current.y;
            positions[i * 3 + 2] = current.z;
            
            const distance = Math.sqrt(
                Math.pow(target.x - current.x, 2) +
                Math.pow(target.y - current.y, 2) +
                Math.pow(target.z - current.z, 2)
            );
            
            if (distance > 0.01) {
                allReached = false;
            }
        }
        
        particles.geometry.attributes.position.needsUpdate = true;
        
        if (allReached) {
            animating = false;
        }
    }
    
    renderer.render(scene, camera);
}

// ============================================
// HAND GESTURE RECOGNITION SYSTEM
// ============================================

function initHandDetection() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });
    
    hands.onResults(onHandResults);
}

function onHandResults(results) {
    if (!gestureEnabled) return;
    
    const canvas = document.getElementById('gestureCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = results.image.width;
    canvas.height = results.image.height;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const gesture = recognizeGesture(landmarks);
        
        if (gesture && gesture !== lastGesture) {
            const now = Date.now();
            if (now - gestureDebounce > 2000) {
                lastGesture = gesture;
                gestureDebounce = now;
                handleGesture(gesture);
            }
        }
    }
}

function recognizeGesture(landmarks) {
    const isIndexUp = landmarks[8].y < landmarks[6].y;
    const isMiddleUp = landmarks[12].y < landmarks[10].y;
    const isRingUp = landmarks[16].y < landmarks[14].y;
    const isPinkyUp = landmarks[20].y < landmarks[18].y;
    const isThumbUp = landmarks[4].y < landmarks[3].y;
    
    // Peace Sign
    if (isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return 'peace';
    }
    
    // Fist for Heart
    if (!isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
        return 'heart';
    }
    
    // REMOVE THIS ENTIRE BLOCK:
    // // Thumbs up
    // if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
    //     return 'thumbsup';
    // }
    
    // NEW: Middle finger only
    if (!isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
        return 'middlefinger';
    }
    
    // Rock on / I Love You (index + pinky)
    if (isIndexUp && isPinkyUp && !isMiddleUp && !isRingUp) {
        return 'iloveyou';
    }
    
    // Open hand - form ball shape
    if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
        return 'openhand';
    }
    
    return null;
}

function handleGesture(gesture) {
    let shapeName = '';
    
    switch(gesture) {
        case 'peace':
            textToParticles('WANNA LICK U'); // Changed from setPeaceSignShape()
            shapeName = 'Wanna Lick You 👅';
            break;
            
        case 'heart':
            setHeartShape();
            shapeName = 'Heart ❤️';
            console.log('Fist detected - showing heart shape');
            break;
            
        case 'middlefinger':  // NEW: Add middle finger case
            textToParticles('F ME BAD');
            shapeName = 'F Me Bad';
            console.log('Middle finger detected');
            break;
            
        case 'iloveyou':
            textToParticles('I LOVE YOU');
            shapeName = 'I Love You 💕';
            break;
            
        case 'openhand':
            resetToSphere();
            $('#gestureStatus').text('🖐 Open Hand - Ball Shape').addClass('active');
            setTimeout(() => {
                $('#gestureStatus').removeClass('active').text('Camera Active - Show gestures!');
            }, 2000);
            return;
    }
    
    if (shapeName) {
        $('#gestureStatus').text(`Gesture: ${shapeName}`).addClass('active');
        setTimeout(() => {
            $('#gestureStatus').removeClass('active').text('Camera Active - Show gestures!');
        }, 2000);
    }
}

async function startGestureRecognition() {
    try {
        const video = document.getElementById('webcam');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
        });
        video.srcObject = stream;
        
        if (!hands) {
            initHandDetection();
        }
        
        webcamCamera = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 640,
            height: 480
        });
        
        await webcamCamera.start();
        gestureEnabled = true;
        console.log('Hand gesture recognition started!');
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Could not access camera. Please allow camera permissions and refresh the page.');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    $('#toggleGesture').on('click', function() {
        if (!gestureEnabled) {
            startGestureRecognition();
        }
    });
    
    $(window).on('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    let mouseX = 0;
    let mouseY = 0;
    
    $(document).on('mousemove', function(e) {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    function updateCameraPosition() {
        camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
        camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);
        requestAnimationFrame(updateCameraPosition);
    }
    updateCameraPosition();
}

$(document).ready(function() {
    init();
    
    setTimeout(function() {
        startGestureRecognition();
    }, 1000);
});