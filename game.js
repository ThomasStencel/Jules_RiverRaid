document.addEventListener('DOMContentLoaded', () => {
    // Get the canvas element
    const canvas = document.getElementById('gameCanvas');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const gameOverDisplay = document.getElementById('gameOverDisplay');
    const livesDisplay = document.getElementById('livesDisplay');

    if (!canvas || !scoreDisplay || !gameOverDisplay || !livesDisplay) {
        console.error("Required DOM elements (canvas, scoreDisplay, livesDisplay, or gameOverDisplay) not found.");
        return;
    }

    let score = 0;
    let playerLives = 3;
    let isGameOver = false;

    function updateLivesDisplay() {
        livesDisplay.textContent = "Lives: " + playerLives;
    }
    updateLivesDisplay(); // Initial display

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

        // Base deep sea blue color
        context.fillStyle = '#003366'; 
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Add some light blue wavy lines/stripes for highlights
        context.fillStyle = '#ADD8E6'; // Light blue
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

    // Airplane (Placeholder 3D Shape - P38-like)
    const airplane = new THREE.Group();
    const playerBodyMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa }); // Gray

    // Central Fuselage
    const fuselageGeometry = new THREE.BoxGeometry(0.3, 0.2, 1.5); // width, height, depth
    const fuselage = new THREE.Mesh(fuselageGeometry, playerBodyMaterial);
    airplane.add(fuselage);

    // Engine Nacelles/Booms
    const boomGeometry = new THREE.BoxGeometry(0.2, 0.15, 1.0); // Slightly shorter than fuselage
    const boom1 = new THREE.Mesh(boomGeometry, playerBodyMaterial);
    boom1.position.set(-0.3, 0, -0.1); // x offset, y same, z slightly forward from center of fuselage
    airplane.add(boom1);

    const boom2 = new THREE.Mesh(boomGeometry, playerBodyMaterial);
    boom2.position.set(0.3, 0, -0.1);
    airplane.add(boom2);
    
    // Wings (connecting fuselage and booms)
    const wingGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.4); // width, height, depth
    const wing = new THREE.Mesh(wingGeometry, playerBodyMaterial);
    wing.position.set(0, 0.05, -0.1); // Centered, slightly above booms/fuselage center, at boom Z
    airplane.add(wing);

    airplane.position.set(0, -2, 0); // Centered horizontally, near bottom
    scene.add(airplane);
    
    // Store main fuselage depth for bullet calculation if needed, or use a fixed offset
    const mainFuselageDepth = 1.5;


    // Keyboard controls
    const keysPressed = {};
    const playerSpeed = 0.1;
    // Approximate horizontal boundaries based on camera FOV and distance
    // Visible width at z=0 is 2 * camera.position.z * tan(camera.fov / 2 * PI / 180)
    // For fov=75, z=5: 2 * 5 * tan(37.5 * PI/180) approx 7.67. So, +/- 3.83
    const xMin = -3.7; 
    const xMax = 3.7;

    // Enemy Type 1 (Default) properties
    const defaultEnemyGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.8); // width, height, depth
    const defaultEnemyMaterialBase = new THREE.MeshBasicMaterial({ color: 0x008800 }); // Dark Green
    
    // Enemy Type 2 properties
    const type2EnemyGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.6); // Wider, flatter
    const type2EnemyMaterialBase = new THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brownish

    // Enemy Type 3 properties
    const type3EnemyGeometry = new THREE.BoxGeometry(0.7, 0.5, 1.0); // Larger, taller
    const type3EnemyMaterialBase = new THREE.MeshBasicMaterial({ color: 0x444444 }); // Dark Gray

    const enemies = [];
    const enemySpeed = 0.05; // Same speed for all types for now
    let framesSinceLastSpawn = 0;
    const spawnInterval = 120; // Approx every 2 seconds at 60fps

    // Bullet properties (Updated for Sky Destroyer style)
    const bulletGeometry = new THREE.SphereGeometry(0.08, 6, 6); // Small sphere
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // White
    const bullets = [];
    const bulletSpeed = 0.3;
    let canShoot = true;
    const shootCooldown = 300; // Milliseconds (0.3 seconds)

    function spawnEnemy() {
        if (isGameOver) return;

        let selectedEnemyGeometry;
        let selectedEnemyMaterial; // This will be a clone
        let enemyType;
        let scoreValue;
        const rand = Math.random();

        if (rand < 0.60) { // 60% chance for Type 1
            selectedEnemyGeometry = defaultEnemyGeometry;
            selectedEnemyMaterial = defaultEnemyMaterialBase.clone();
            enemyType = 'type1';
            scoreValue = 10;
        } else if (rand < 0.85) { // 25% chance for Type 2 (0.60 + 0.25 = 0.85)
            selectedEnemyGeometry = type2EnemyGeometry;
            selectedEnemyMaterial = type2EnemyMaterialBase.clone();
            enemyType = 'type2';
            scoreValue = 20;
        } else { // 15% chance for Type 3
            selectedEnemyGeometry = type3EnemyGeometry;
            selectedEnemyMaterial = type3EnemyMaterialBase.clone();
            enemyType = 'type3';
            scoreValue = 30;
        }
        
        const enemy = new THREE.Mesh(selectedEnemyGeometry, selectedEnemyMaterial);
        enemy.userData = { type: enemyType, scoreValue: scoreValue };
        
        // Random horizontal position within player's range
        enemy.position.x = Math.random() * (xMax - xMin) + xMin;
        enemy.position.y = airplane.position.y; // Same vertical level as airplane
        enemy.position.z = airplane.position.z - 20; // Spawn at the "top" of the view, far away

        scene.add(enemy);
        enemies.push(enemy);
    }

    function shootBullet() {
        if (!canShoot || isGameOver) return;

        console.log("SFX: Player Shoot");
        const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial.clone()); // Clone material
        bullet.position.x = airplane.position.x; // Group's x
        bullet.position.y = airplane.position.y; // Group's y
        // Fire from the front of the main fuselage (group's z - half of main fuselage depth)
        bullet.position.z = airplane.position.z - (mainFuselageDepth / 2); 

        scene.add(bullet);
        bullets.push(bullet);

        canShoot = false;
        setTimeout(() => {
            canShoot = true;
        }, shootCooldown);
    }

    document.addEventListener('keydown', (event) => {
        keysPressed[event.key] = true;
        if (!isGameOver && event.code === 'Space') { // Only allow shooting if game is not over
            shootBullet();
        }
        if (isGameOver && (event.key === 'r' || event.key === 'R')) {
            resetGame();
        }
    });

    document.addEventListener('keyup', (event) => {
        keysPressed[event.key] = false;
    });

    function resetGame() {
        console.log("SFX: Game Restart/Coin Insert");
        isGameOver = false;
        score = 0;
        scoreDisplay.textContent = "Score: " + score;
        playerLives = 3;
        updateLivesDisplay();
        gameOverDisplay.style.display = 'none';

        airplane.position.set(0, -2, 0);

        // Clear enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            scene.remove(enemy);
            if (enemy.material) {
                enemy.material.dispose();
            }
        }
        enemies.length = 0;

        // Clear bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            scene.remove(bullet);
            if (bullet.material) {
                bullet.material.dispose();
            }
        }
        bullets.length = 0;

        framesSinceLastSpawn = 0;
        canShoot = true;
        // Make sure keysPressed is cleared to avoid unintended immediate movement
        for (const key in keysPressed) {
            keysPressed[key] = false;
        }
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        if (!isGameOver) {
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
                spawnEnemy(); // spawnEnemy itself checks for isGameOver
                framesSinceLastSpawn = 0;
            }

            // Update bounding box for the airplane (once per frame, after movement)
            const airplaneBox = new THREE.Box3().setFromObject(airplane);

            // Enemy movement, removal, and player-enemy collision
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                enemy.position.z += enemySpeed;

                // Check for removal if past camera
                if (enemy.position.z > camera.position.z + 1) {
                    scene.remove(enemy);
                    if (enemy.material) {
                        enemy.material.dispose();
                    }
                    enemies.splice(i, 1);
                    continue; 
                }

                // Player-Enemy Collision
                const enemyBoxForPlayerCollision = new THREE.Box3().setFromObject(enemy);
                if (airplaneBox.intersectsBox(enemyBoxForPlayerCollision)) {
                    console.log("SFX: Player Hit/Explosion");
                    playerLives--;
                    updateLivesDisplay();
                    
                    scene.remove(enemy); 
                    if (enemy.material) {
                        enemy.material.dispose();
                    }
                    enemies.splice(i, 1);

                    if (playerLives <= 0) {
                        console.log("SFX: Game Over");
                        isGameOver = true;
                        gameOverDisplay.style.display = 'block';
                        break; // Exit enemy loop as game is over
                    } else {
                        airplane.position.x = 0; // Reset player position
                        // Potentially add brief invincibility here in a future step
                    }
                    continue; // Player hit, so skip further checks for this enemy for this frame (though it's removed)
                }
            }
        } // end if(!isGameOver) for game logic updates

        if (!isGameOver) { // Bullet logic only if game is not over
            // Bullet movement, removal, and bullet-enemy collision
            for (let i = bullets.length - 1; i >= 0; i--) {
                const bullet = bullets[i];
                bullet.position.z -= bulletSpeed;
                const bulletBox = new THREE.Box3().setFromObject(bullet);

                // Check for removal if bullet is far off-screen
                if (bullet.position.z < airplane.position.z - 30) {
                    scene.remove(bullet);
                    if (bullet.material) {
                        bullet.material.dispose();
                    }
                    bullets.splice(i, 1);
                    continue; 
                }

                // Bullet-Enemy Collision
                for (let j = enemies.length - 1; j >= 0; j--) {
                    const enemy = enemies[j];
                    const enemyBoxForBulletCollision = new THREE.Box3().setFromObject(enemy);

                    if (bulletBox.intersectsBox(enemyBoxForBulletCollision)) {
                        console.log("SFX: Enemy Explosion");
                        console.log(`Bullet hit enemy of type: ${enemy.userData.type}`);
                        score += enemy.userData.scoreValue; // Use scoreValue from enemy's userData
                        scoreDisplay.textContent = "Score: " + score;

                        scene.remove(bullet);
                        if (bullet.material) {
                            bullet.material.dispose();
                        }
                        bullets.splice(i, 1);

                        scene.remove(enemy);
                        if (enemy.material) {
                            enemy.material.dispose();
                        }
                        enemies.splice(j, 1);
                        
                        break; 
                    }
                }
            }
        } // end if(!isGameOver) for bullet logic

        renderer.render(scene, camera);
    }

    // Start animation
    animate();

    // Optional: Initial enemy spawn to not wait for the first interval
    // spawnEnemy(); 
});
