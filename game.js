document.addEventListener('DOMContentLoaded', () => {
    // Get the canvas element
    const canvas = document.getElementById('gameCanvas');

    if (!canvas) {
        console.error("Canvas element with ID 'gameCanvas' not found.");
        return;
    }

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Light blue background

    // Camera
    const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
    camera.position.z = 5;
    // The camera looks at the origin by default if not specified otherwise after positioning.

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.setSize(800, 600);
    // The canvas element is already in the DOM, so we don't need to append renderer.domElement again.
    // However, it's good practice to ensure the canvas size matches the renderer size if not already set.
    canvas.width = 800;
    canvas.height = 600;

    // Function to create a procedural river texture
    function createRiverTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 512; // Long texture for vertical tiling simulation
        const context = canvas.getContext('2d');

        // Base blue color
        context.fillStyle = '#336699'; // Darker blue
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add some lighter blue wavy lines/stripes
        context.fillStyle = '#5588bb'; // Lighter blue
        for (let i = 0; i < canvas.height; i += 20) {
            context.fillRect(0, i + Math.random() * 5, canvas.width, 10 + Math.random() * 5);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    // River
    const riverTexture = createRiverTexture();
    // Repeat the texture 5 times along the length of the plane.
    // The actual visual density will depend on the texture's own detail and the plane's length.
    riverTexture.repeat.set(1, 5); 

    const riverGeometry = new THREE.PlaneGeometry(8, 40, 1, 10); // width, length, widthSegments, lengthSegments
    const riverMaterial = new THREE.MeshBasicMaterial({ map: riverTexture });
    const river = new THREE.Mesh(riverGeometry, riverMaterial);
    river.rotation.x = -Math.PI / 2; // Rotate to be flat on XZ plane
    river.position.set(0, -2.5, 0); // Position below the airplane
    scene.add(river);

    // Airplane
    const airplaneGeometry = new THREE.BoxGeometry(0.5, 0.2, 1.5); // width, height, depth
    const airplaneMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
    const airplane = new THREE.Mesh(airplaneGeometry, airplaneMaterial);
    airplane.position.set(0, -2, 0); // Centered horizontally, near bottom, at scene origin for z
    scene.add(airplane);

    // Keyboard controls
    const keysPressed = {};
    const playerSpeed = 0.1;
    // Approximate horizontal boundaries based on camera FOV and distance
    // Visible width at z=0 is 2 * camera.position.z * tan(camera.fov / 2 * PI / 180)
    // For fov=75, z=5: 2 * 5 * tan(37.5 * PI/180) approx 7.67. So, +/- 3.83
    const xMin = -3.7; 
    const xMax = 3.7;

    // Enemy properties
    const enemyGeometry = new THREE.SphereGeometry(0.2, 8, 6);
    const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green
    const enemies = [];
    const enemySpeed = 0.05;
    let framesSinceLastSpawn = 0;
    const spawnInterval = 120; // Approx every 2 seconds at 60fps

    // Bullet properties
    const bulletGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6); // radiusTop, radiusBottom, height, radialSegments
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow
    const bullets = [];
    const bulletSpeed = 0.3;
    let canShoot = true;
    const shootCooldown = 300; // Milliseconds (0.3 seconds)

    function spawnEnemy() {
        const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial.clone()); // Clone material
        
        // Random horizontal position within player's range
        enemy.position.x = Math.random() * (xMax - xMin) + xMin;
        enemy.position.y = airplane.position.y; // Same vertical level as airplane
        enemy.position.z = airplane.position.z - 20; // Spawn at the "top" of the view, far away

        scene.add(enemy);
        enemies.push(enemy);
    }

    function shootBullet() {
        if (!canShoot) return;

        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial.clone()); // Clone material
        bullet.position.x = airplane.position.x;
        bullet.position.y = airplane.position.y;
        // Airplane depth is 1.5, so fire from its front.
        bullet.position.z = airplane.position.z - (airplaneGeometry.parameters.depth / 2); 

        scene.add(bullet);
        bullets.push(bullet);

        canShoot = false;
        setTimeout(() => {
            canShoot = true;
        }, shootCooldown);
    }

    document.addEventListener('keydown', (event) => {
        keysPressed[event.key] = true;
        if (event.code === 'Space') {
            shootBullet();
        }
    });

    document.addEventListener('keyup', (event) => {
        keysPressed[event.key] = false;
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        // Handle airplane movement
        if (keysPressed['ArrowLeft']) {
            airplane.position.x -= playerSpeed;
        }
        if (keysPressed['ArrowRight']) {
            airplane.position.x += playerSpeed;
        }

        // Clamp airplane position to boundaries
        if (airplane.position.x < xMin) {
            airplane.position.x = xMin;
        }
        if (airplane.position.x > xMax) {
            airplane.position.x = xMax;
        }

        // Scroll river texture
        if (river && river.material && river.material.map) {
            river.material.map.offset.y += 0.005;
        }

        // Enemy spawning
        framesSinceLastSpawn++;
        if (framesSinceLastSpawn >= spawnInterval) {
            spawnEnemy();
            framesSinceLastSpawn = 0;
        }

        // Enemy movement and removal
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            enemy.position.z += enemySpeed;

            // If enemy is past the camera (and a bit more to be off-screen)
            if (enemy.position.z > camera.position.z + 1) { 
                scene.remove(enemy);
                if (enemy.material) {
                   enemy.material.dispose();
                }
                enemies.splice(i, 1);
            }
        }

        // Bullet movement and removal
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            bullet.position.z -= bulletSpeed;

            // If bullet is far off-screen "above" the plane
            if (bullet.position.z < airplane.position.z - 30) { 
                scene.remove(bullet);
                if (bullet.material) {
                    bullet.material.dispose();
                }
                bullets.splice(i, 1);
            }
        }

        renderer.render(scene, camera);
    }

    // Start animation
    animate();

    // Optional: Initial enemy spawn to not wait for the first interval
    // spawnEnemy(); 
});
