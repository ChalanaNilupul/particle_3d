// Three.js Scene Setup
let scene, camera, renderer, particles;
let particlePositions = [];
let targetPositions = [];
let spherePositions = [];
let animating = false;
let isTextMode = false; // NEW: Track if we're showing text (pauses rotation)

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
    renderer = new THREE.WebGLRenderer({ 
        canvas, 
        alpha: true,
        antialias: true 
    });
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
        // Fibonacci sphere distribution for even particle spread
        const phi = Math.acos(1 - 2 * (i + 0.5) / PARTICLE_COUNT);
        const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
        
        const x = SPHERE_RADIUS * Math.cos(theta) * Math.sin(phi);
        const y = SPHERE_RADIUS * Math.sin(theta) * Math.sin(phi);
        const z = SPHERE_RADIUS * Math.cos(phi);
        
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        // Store sphere positions for reset
        spherePositions.push({ x, y, z });
        particlePositions.push({ x, y, z });
        targetPositions.push({ x, y, z });
        
        // Gradient colors across sphere
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
    
    // Material
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
    
    isTextMode = true; // NEW: Pause rotation when text is shown
    
    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 400;
    
    // Configure text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 120px Playfair Display, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw text
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Extract pixel positions
    const textPixels = [];
    const sampleRate = 4; // Sample every nth pixel for performance
    
    for (let y = 0; y < canvas.height; y += sampleRate) {
        for (let x = 0; x < canvas.width; x += sampleRate) {
            const index = (y * canvas.width + x) * 4;
            const alpha = pixels[index + 3];
            
            if (alpha > 128) {
                // Convert to 3D coordinates (centered)
                const px = (x - canvas.width / 2) / 100;
                const py = -(y - canvas.height / 2) / 100;
                const pz = (Math.random() - 0.5) * 0.5; // Add slight depth
                
                textPixels.push({ x: px, y: py, z: pz });
            }
        }
    }
    
    // Assign particles to text positions
    const pixelCount = textPixels.length;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        if (i < pixelCount) {
            // Assign to text pixel
            const pixel = textPixels[i % pixelCount];
            targetPositions[i] = {
                x: pixel.x,
                y: pixel.y,
                z: pixel.z
            };
        } else {
            // Extra particles scatter randomly nearby
            const basePixel = textPixels[Math.floor(Math.random() * pixelCount)];
            targetPositions[i] = {
                x: basePixel.x + (Math.random() - 0.5) * 2,
                y: basePixel.y + (Math.random() - 0.5) * 2,
                z: basePixel.z + (Math.random() - 0.5) * 2
            };
        }
    }
    
    animating = true;
}

// Reset to sphere
function resetToSphere() {
    isTextMode = false; // NEW: Resume rotation when back to sphere
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        targetPositions[i] = {
            x: spherePositions[i].x,
            y: spherePositions[i].y,
            z: spherePositions[i].z
        };
    }
    animating = true;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate particles slowly - ONLY when NOT showing text
    if (particles && !isTextMode) { // CHANGED: Added condition !isTextMode
        particles.rotation.y += 0.001;
       // particles.rotation.x += 0.0005;
    }
    
    // Morph animation
    if (animating) {
        const positions = particles.geometry.attributes.position.array;
        let allReached = true;
        
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const current = particlePositions[i];
            const target = targetPositions[i];
            
            // Smooth lerp towards target
            const lerpFactor = 0.05;
            
            current.x += (target.x - current.x) * lerpFactor;
            current.y += (target.y - current.y) * lerpFactor;
            current.z += (target.z - current.z) * lerpFactor;
            
            positions[i * 3] = current.x;
            positions[i * 3 + 1] = current.y;
            positions[i * 3 + 2] = current.z;
            
            // Check if reached target
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

// Event listeners using jQuery
function setupEventListeners() {
    let typingTimer;
    const typingDelay = 500; // milliseconds delay after typing stops
    
    // Text input onChange with debouncing
    $('#textInput').on('input', function() {
        clearTimeout(typingTimer);
        const text = $(this).val().trim();
        
        if (text === '') {
            // If text is cleared, reset to sphere
            resetToSphere();
        } else {
            // Wait for user to stop typing, then morph
            typingTimer = setTimeout(function() {
                textToParticles(text);
                particles.rotation.y = 0;
                particles.rotation.x = 0;
            }, typingDelay);
        }
    });
    
    // Preset buttons using jQuery
    $('.preset-btn').on('click', function() {
        const text = $(this).data('text');
        $('#textInput').val(text);
        textToParticles(text);
    });
    
    // Window resize
    $(window).on('resize', function() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Mouse interaction - rotate camera slightly
    let mouseX = 0;
    let mouseY = 0;
    
    $(document).on('mousemove', function(e) {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Update camera position based on mouse
    function updateCameraPosition() {
        camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.05;
        camera.position.y += (mouseY * 0.5 - camera.position.y) * 0.05;
        camera.lookAt(scene.position);
        
        requestAnimationFrame(updateCameraPosition);
    }
    updateCameraPosition();
}

// Initialize when DOM is ready using jQuery
$(document).ready(function() {
    init();
});