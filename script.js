const scene = document.getElementById('scene');
const viewTurnaround = document.getElementById('view-turnaround');
const message = document.getElementById('message');
const bang = document.getElementById('bang');
const restartButton = document.getElementById('restart');
const reactionTimeDisplay = document.getElementById('reaction-time');
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const healthBar = document.getElementById('health-bar');
const ammoCounter = document.getElementById('ammo-counter');
const injuryOverlay = document.getElementById('injury-overlay');

let gameState = 'waiting';
let canShoot = false;
let tStart;
let difficulty = 'medium';
let currentBarrel = null;
let currentLevel = 1;
let score = 0;
let cowboysRemaining = 0;
let cowboyTimers = [];
let playerHealth = 2;
let ammoCount = 6;

// Difficulty settings for each level - slowing down cowboy shooting speed
const difficultySettings = {
    easy: { minDelay: 1000, maxDelay: 1800, accuracy: 0.7 },     // Slower
    medium: { minDelay: 600, maxDelay: 1200, accuracy: 0.85 },   // Slower
    hard: { minDelay: 400, maxDelay: 1000, accuracy: 0.95 }      // Slower
};

// Level settings
const levelSettings = [
    { cowboys: 1, spacing: 0, difficulty: 'easy' },       // Level 1
    { cowboys: 1, spacing: 0, difficulty: 'medium' },     // Level 2
    { cowboys: 2, spacing: 1500, difficulty: 'medium' },  // Level 3
    { cowboys: 2, spacing: 1000, difficulty: 'hard' },    // Level 4
    { cowboys: 3, spacing: 800, difficulty: 'hard' },     // Level 5
    { cowboys: 3, spacing: 600, difficulty: 'hard',       // Level 6
      specialFeature: 'fastDraw' },                       // Cowboys draw faster
    { cowboys: 4, spacing: 700, difficulty: 'hard' },     // Level 7
    { cowboys: 2, spacing: 800, difficulty: 'hard',       // Level 8 - Reduced to 2 cowboys
      specialFeature: 'movingTargets' },                  // Cowboys move side to side
    { cowboys: 5, spacing: 400, difficulty: 'hard',       // Level 9
      specialFeature: 'quickReload' },                    // Cowboys reload faster
    { cowboys: 6, spacing: 300, difficulty: 'hard',       // Level 10 - Final Boss Level
      specialFeature: 'allFeatures' }                     // All special features active
];

// Special feature modifiers - adjusted for slower shooting
const specialFeatures = {
    fastDraw: { delayModifier: 0.8 },                    // 20% faster draw (less aggressive)
    movingTargets: { moveSpeed: 2 },                     // Movement speed in px/frame
    quickReload: { reloadTime: 1000 },                   // Reload time in ms (default 2000)
    allFeatures: { 
        delayModifier: 0.7,                              // 30% faster draw (less aggressive)
        moveSpeed: 3,                                    // Faster movement
        reloadTime: 800                                  // Faster reload
    }
};

// Possible positions for the AI cowboy
const possiblePositions = [
    // Ground positions (fully visible)
    { left: 150, type: 'ground' },
    { left: 450, type: 'ground' },
    { left: 750, type: 'ground' },
    // Barrel positions (peeking from behind)
    { left: 300, type: 'barrel', peekDirection: 'right' },
    { left: 600, type: 'barrel', peekDirection: 'left' },
    // Rooftop positions (peeking over edge)
    { left: 200, type: 'rooftop', buildingHeight: 220 },
    { left: 500, type: 'rooftop', buildingHeight: 240 }
];

// Sound effects
const sounds = {
    music: new Audio('showdown.mp3'),
    whoosh: new Audio('whoosh.mp3'),
    bulletWhiz: new Audio('whiz.mp3'),
    gunshot: new Audio('gunshot.mp3')
};

// Configure sounds
sounds.music.loop = true;
sounds.music.volume = 0.4;
sounds.whoosh.volume = 0.6;
sounds.bulletWhiz.volume = 0.5;
sounds.gunshot.volume = 0.7;

function getRandomPosition() {
    // Get a random position, ensuring no overlap with existing cowboys
    const usedPositions = Array.from(document.querySelectorAll('.cowboy.ai')).map(cowboy => 
        parseInt(cowboy.style.left.replace('px', '')) + 70); // Get center position
    
    let position;
    let attempts = 0;
    
    do {
        position = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
        attempts++;
        // After 10 attempts, just use any position
        if (attempts > 10) break;
    } while (usedPositions.some(usedPos => Math.abs(usedPos - position.left) < 150));
    
    return position;
}

function positionCowboy(aiCowboy) {
    // Remove any existing covers for this cowboy
    if (aiCowboy.coverElement) {
        aiCowboy.coverElement.remove();
        aiCowboy.coverElement = null;
    }

    // Reset cowboy classes and ensure it's visible
    aiCowboy.className = 'cowboy ai';
    aiCowboy.style.opacity = '1';
    aiCowboy.dataset.hit = 'false';

    const position = getRandomPosition();
    
    switch (position.type) {
        case 'ground':
            // Standard ground position - fully visible
            aiCowboy.style.left = `${position.left - 70}px`; // 70 is half of cowboy width
            aiCowboy.style.zIndex = 2;
            break;

        case 'barrel':
            // Position behind barrel with peeking
            aiCowboy.style.left = `${position.left - 70}px`;
            aiCowboy.style.zIndex = 1;
            aiCowboy.classList.add(`peek-${position.peekDirection}`);

            // Create and position barrel
            const barrel = document.createElement('div');
            barrel.className = 'barrel-cover';
            barrel.style.left = `${position.left - 60}px`; // Center barrel
            viewTurnaround.appendChild(barrel);
            aiCowboy.coverElement = barrel;
            break;

        case 'rooftop':
            // Position on rooftop, peeking over edge
            aiCowboy.style.left = `${position.left - 70}px`;
            aiCowboy.classList.add('rooftop');
            aiCowboy.style.zIndex = 1;

            // Create and position rooftop cover
            const rooftop = document.createElement('div');
            rooftop.className = 'rooftop-cover';
            rooftop.style.left = `${position.left - 80}px`; // Center cover
            rooftop.style.bottom = `${position.buildingHeight}px`; // Match building height
            viewTurnaround.appendChild(rooftop);
            aiCowboy.coverElement = rooftop;

            // Randomly choose peek direction for rooftop
            const peekDirection = Math.random() < 0.5 ? 'left' : 'right';
            aiCowboy.classList.add(`peek-${peekDirection}`);
            break;
    }
    
    // Apply moving targets feature if active
    applySpecialFeatures(aiCowboy);
}

function applySpecialFeatures(aiCowboy) {
    // Get current level settings
    const levelIndex = Math.min(currentLevel - 1, levelSettings.length - 1);
    const level = levelSettings[levelIndex];
    
    // Check if level has special features
    if (!level.specialFeature) return;
    
    // Get feature settings
    const feature = level.specialFeature === 'allFeatures' ? 
        specialFeatures.allFeatures : 
        specialFeatures[level.specialFeature];
    
    // Apply moving targets feature
    if (level.specialFeature === 'movingTargets' || level.specialFeature === 'allFeatures') {
        const moveSpeed = feature.moveSpeed;
        const startLeft = parseInt(aiCowboy.style.left);
        const moveRange = 100; // px to move left/right
        
        // Store original position
        aiCowboy.dataset.originalLeft = startLeft;
        aiCowboy.dataset.moveDirection = Math.random() < 0.5 ? 'left' : 'right';
        aiCowboy.dataset.moveSpeed = moveSpeed;
        aiCowboy.dataset.moveRange = moveRange;
        
        // Start movement animation
        startCowboyMovement(aiCowboy);
    }
}

function startCowboyMovement(aiCowboy) {
    if (gameState !== 'draw' || aiCowboy.dataset.hit === 'true') return;
    
    const originalLeft = parseInt(aiCowboy.dataset.originalLeft);
    const currentLeft = parseInt(aiCowboy.style.left);
    const moveRange = parseInt(aiCowboy.dataset.moveRange);
    const moveSpeed = parseInt(aiCowboy.dataset.moveSpeed);
    let moveDirection = aiCowboy.dataset.moveDirection;
    
    // Change direction if reached range limit
    if (moveDirection === 'right' && currentLeft > originalLeft + moveRange) {
        moveDirection = 'left';
        aiCowboy.dataset.moveDirection = 'left';
    } else if (moveDirection === 'left' && currentLeft < originalLeft - moveRange) {
        moveDirection = 'right';
        aiCowboy.dataset.moveDirection = 'right';
    }
    
    // Move cowboy
    const newLeft = moveDirection === 'right' ? 
        currentLeft + moveSpeed : 
        currentLeft - moveSpeed;
    
    aiCowboy.style.left = `${newLeft}px`;
    
    // Move cover element if exists
    if (aiCowboy.coverElement) {
        const coverLeft = parseInt(aiCowboy.coverElement.style.left);
        const newCoverLeft = moveDirection === 'right' ? 
            coverLeft + moveSpeed : 
            coverLeft - moveSpeed;
        aiCowboy.coverElement.style.left = `${newCoverLeft}px`;
    }
    
    // Continue movement animation
    if (gameState === 'draw' && aiCowboy.dataset.hit === 'false') {
        requestAnimationFrame(() => startCowboyMovement(aiCowboy));
    }
}

function createCowboy() {
    const aiCowboy = document.createElement('div');
    aiCowboy.className = 'cowboy ai';
    aiCowboy.dataset.hit = 'false';
    viewTurnaround.appendChild(aiCowboy);
    positionCowboy(aiCowboy);
    return aiCowboy;
}

function clearAllCowboys() {
    // Clear all cowboys and their covers
    const cowboys = document.querySelectorAll('.cowboy.ai');
    cowboys.forEach(cowboy => {
        if (cowboy.coverElement) {
            cowboy.coverElement.remove();
        }
        cowboy.remove();
    });
    
    // Clear any pending timers
    cowboyTimers.forEach(timer => clearTimeout(timer));
    cowboyTimers = [];
}

function updateHealthDisplay() {
    const healthPoints = healthBar.querySelectorAll('.health-point');
    healthPoints.forEach((point, index) => {
        if (index < playerHealth) {
            point.classList.add('active');
        } else {
            point.classList.remove('active');
        }
    });

    // Update injury overlay based on health
    injuryOverlay.className = '';
    if (playerHealth === 1) {
        injuryOverlay.classList.add('injured');
    } else if (playerHealth === 0) {
        injuryOverlay.classList.add('critical');
    }
}

function updateAmmoDisplay() {
    const bullets = ammoCounter.querySelectorAll('.bullet');
    bullets.forEach((bullet, index) => {
        if (index < ammoCount) {
            bullet.classList.add('active');
        } else {
            bullet.classList.remove('active');
        }
    });
}

function revolveAmmo() {
    // Animate the revolver cylinder
    ammoCounter.classList.add('revolve');
    setTimeout(() => {
        ammoCounter.classList.remove('revolve');
    }, 300);
}

function updateDisplays() {
    levelDisplay.textContent = `Level ${currentLevel}`;
    
    // Update score and cowboys remaining display
    if (gameState === 'draw') {
        // Create base score text
        let scoreText = `Score: ${score} | `;
        
        // Add cowboy indicators
        scoreDisplay.innerHTML = scoreText;
        
        // Add visual indicators for remaining cowboys
        for (let i = 0; i < cowboysRemaining; i++) {
            const indicator = document.createElement('span');
            indicator.className = 'cowboy-indicator';
            scoreDisplay.appendChild(indicator);
        }
    } else {
        scoreDisplay.textContent = `Score: ${score}`;
    }
    
    updateHealthDisplay();
    updateAmmoDisplay();
}

function startLevel() {
    // Get settings for current level (cap at max level)
    const maxLevel = levelSettings.length - 1;
    const levelIndex = Math.min(currentLevel - 1, maxLevel);
    const level = levelSettings[levelIndex];
    
    // Set difficulty based on level
    difficulty = level.difficulty;
    
    // Reset health and ammo for new level
    playerHealth = 2;
    ammoCount = 6;
    
    // Update message with level info
    message.textContent = `Level ${currentLevel} - Get ready...`;
    
    // Set number of cowboys for this level
    cowboysRemaining = level.cowboys;
    
    // Update displays
    updateDisplays();
    
    // Start the game sequence
    gameState = 'waiting';
    canShoot = false;
    scene.style.transform = 'rotateY(0deg)';
    restartButton.style.display = 'none';
    bang.style.display = 'none';
    reactionTimeDisplay.style.display = 'none';

    // Start background music
    sounds.music.currentTime = 0;
    sounds.music.play();

    // Clear any existing cowboys
    clearAllCowboys();

    const drawDelay = 2000 + Math.random() * 2000; // 2-4 seconds
    setTimeout(() => {
        if (gameState === 'waiting') {
            gameState = 'turning';
            message.textContent = `Draw!`;
            scene.style.transform = 'rotateY(180deg)';
            sounds.whoosh.play();
        }
    }, drawDelay);
}

function spawnCowboys() {
    // Get settings for current level
    const levelIndex = Math.min(currentLevel - 1, levelSettings.length - 1);
    const level = levelSettings[levelIndex];
    
    // Spawn cowboys with spacing
    for (let i = 0; i < level.cowboys; i++) {
        const delay = i * level.spacing;
        const timer = setTimeout(() => {
            if (gameState === 'draw') {
                const cowboy = createCowboy();
                setupCowboyBehavior(cowboy);
            }
        }, delay);
        cowboyTimers.push(timer);
    }
}

function setupCowboyBehavior(cowboy) {
    // Get current level settings
    const levelIndex = Math.min(currentLevel - 1, levelSettings.length - 1);
    const level = levelSettings[levelIndex];
    
    // Set up AI shooting behavior
    const settings = difficultySettings[difficulty];
    
    // Apply fast draw modifier if active
    let delayModifier = 1;
    if (level.specialFeature === 'fastDraw' || level.specialFeature === 'allFeatures') {
        const feature = level.specialFeature === 'allFeatures' ? 
            specialFeatures.allFeatures : 
            specialFeatures.fastDraw;
        delayModifier = feature.delayModifier;
    }
    
    // Calculate delay with modifier
    const minDelay = settings.minDelay * delayModifier;
    const maxDelay = settings.maxDelay * delayModifier;
    const aiDelay = minDelay + Math.random() * (maxDelay - minDelay);
    
    const timer = setTimeout(() => {
        if (gameState === 'draw' && cowboy.dataset.hit === 'false') {
            sounds.bulletWhiz.play();
            if (Math.random() < settings.accuracy) {
                // AI hit the player
                playerHealth--;
                updateHealthDisplay();
                
                if (playerHealth <= 0) {
                    // Player is dead
                    gameState = 'ended';
                    showBang();
                    message.textContent = 'The AI gunned you down!';
                    restartButton.style.display = 'block';
                    sounds.music.pause();
                    
                    // Show final score
                    reactionTimeDisplay.style.display = 'block';
                    reactionTimeDisplay.textContent = `Final Score: ${score}`;
                } else {
                    // Player was hit but still alive
                    message.textContent = 'You were hit! Shoot back quickly!';
                }
            } else {
                message.textContent = 'AI missed! Your chance!';
            }
        }
    }, aiDelay);
    
    cowboyTimers.push(timer);
}

function startGame() {
    // Reset game state
    currentLevel = 1;
    score = 0;
    
    // Update displays
    updateDisplays();
    
    // Start first level
    startLevel();
}

scene.addEventListener('transitionend', () => {
    if (gameState === 'turning') {
        gameState = 'draw';
        canShoot = true;
        tStart = Date.now();
        
        // Clear the message as soon as cowboys appear
        setTimeout(() => {
            message.textContent = '';
        }, 500);
        
        // Spawn cowboys for this level
        spawnCowboys();
        
        // Update display to show cowboys remaining
        updateDisplays();
    }
});

// Function to show BANG effect at the cowboy's position
function showBangAtPosition(x, y) {
    // Create a new BANG element
    const bangEffect = document.createElement('div');
    bangEffect.className = 'comic-bang';
    
    // Position it at the cowboy's location
    bangEffect.style.left = `${x}px`;
    bangEffect.style.top = `${y}px`;
    
    // Add to the game
    document.getElementById('game').appendChild(bangEffect);
    
    // Remove after animation completes
    setTimeout(() => {
        bangEffect.remove();
    }, 1000);
}

// Update the viewTurnaround click handler
viewTurnaround.addEventListener('click', (e) => {
    if (gameState === 'draw' && canShoot && ammoCount > 0) {
        if (e.target.classList.contains('cowboy') && e.target.dataset.hit === 'false') {
            // Mark this cowboy as hit
            e.target.dataset.hit = 'true';
            e.target.classList.add('hit');
            
            // Show BANG at cowboy's position
            const cowboyRect = e.target.getBoundingClientRect();
            const gameRect = document.getElementById('game').getBoundingClientRect();
            
            // Calculate position relative to game container
            const bangX = cowboyRect.left - gameRect.left + (cowboyRect.width / 2) - 50; // Center horizontally
            const bangY = cowboyRect.top - gameRect.top + (cowboyRect.height / 3) - 50; // Position near upper body
            
            showBangAtPosition(bangX, bangY);
            
            // Calculate points based on reaction time
            const reactionTime = (Date.now() - tStart) / 1000;
            const timePoints = Math.max(10, Math.floor(30 - reactionTime * 10));
            const levelBonus = currentLevel * 5;
            const pointsEarned = timePoints + levelBonus;
            
            // Update score
            score += pointsEarned;
            
            // Decrease cowboys remaining
            cowboysRemaining--;
            
            // Update displays
            updateDisplays();
            
            // Check if level complete
            if (cowboysRemaining <= 0) {
                gameState = 'ended';
                message.textContent = `Level ${currentLevel} Complete!`;
                reactionTimeDisplay.style.display = 'block';
                reactionTimeDisplay.textContent = `Score: ${score} (+${pointsEarned})`;
                
                // Show next level button
                restartButton.style.display = 'block';
                restartButton.textContent = currentLevel < levelSettings.length ? 'Next Level' : 'Play Again';
                
                // Increment level for next round
                currentLevel = currentLevel < levelSettings.length ? currentLevel + 1 : 1;
                
                sounds.music.pause();
            } else {
                // Show points earned
                const pointsDisplay = document.createElement('div');
                pointsDisplay.className = 'points-popup';
                pointsDisplay.textContent = `+${pointsEarned}`;
                pointsDisplay.style.left = e.pageX + 'px';
                pointsDisplay.style.top = e.pageY + 'px';
                document.body.appendChild(pointsDisplay);
                
                // Animate and remove
                setTimeout(() => {
                    pointsDisplay.style.opacity = '0';
                    pointsDisplay.style.transform = 'translateY(-50px)';
                    setTimeout(() => pointsDisplay.remove(), 1000);
                }, 10);
            }
        } else if (e.target.classList.contains('barrel-cover') || e.target.classList.contains('rooftop-cover')) {
            // Hit the cover instead
            message.textContent = 'You hit the cover! The AI is still alive!';
            
            // Clear message after 1 second
            setTimeout(() => {
                if (gameState === 'draw') {
                    message.textContent = '';
                }
            }, 1000);
        } else {
            // Missed completely
            message.textContent = 'You missed!';
            
            // Clear message after 1 second
            setTimeout(() => {
                if (gameState === 'draw') {
                    message.textContent = '';
                }
            }, 1000);
        }
    } else if (gameState === 'waiting' || gameState === 'turning') {
        gameState = 'ended';
        message.textContent = 'False start! You lose!';
        restartButton.style.display = 'block';
        restartButton.textContent = 'Play Again';
        currentLevel = 1; // Reset to level 1
        updateDisplays();
        sounds.music.pause();
    }
});

// Remove the previous global click handler and create a new one
document.getElementById('game').addEventListener('click', function(e) {
    // Only allow shooting if we have ammo
    if (gameState === 'draw' || gameState === 'waiting' || gameState === 'turning') {
        if (ammoCount > 0) {
            // Play gunshot sound
            sounds.gunshot.currentTime = 0;
            sounds.gunshot.play();
            
            // Don't show the central BANG anymore - we'll use positioned BANGs instead
            if (!(e.target.classList.contains('cowboy') && e.target.dataset.hit === 'false' && gameState === 'draw')) {
                // Show bang effect for misses
                showBang();
            }
            
            // Decrease ammo
            ammoCount--;
            
            // Animate revolver
            revolveAmmo();
            
            // Update ammo display
            updateAmmoDisplay();
            
            // Check if out of ammo
            if (ammoCount === 0) {
                message.textContent = 'Out of ammo! Reload!';
                
                // Get current level settings for reload time
                const levelIndex = Math.min(currentLevel - 1, levelSettings.length - 1);
                const level = levelSettings[levelIndex];
                
                // Determine reload time based on level features
                let reloadTime = 2000; // Default reload time
                if (level.specialFeature === 'quickReload' || level.specialFeature === 'allFeatures') {
                    const feature = level.specialFeature === 'allFeatures' ? 
                        specialFeatures.allFeatures : 
                        specialFeatures.quickReload;
                    reloadTime = feature.reloadTime;
                }
                
                setTimeout(() => {
                    if (gameState === 'draw') {
                        // Auto reload after delay
                        ammoCount = 6;
                        updateAmmoDisplay();
                        message.textContent = 'Reloaded! Keep shooting!';
                    }
                }, reloadTime);
            }
        } else {
            // Click with no ammo - play empty gun sound
            sounds.bulletWhiz.play(); // Reuse whiz sound as empty gun click
            message.textContent = 'Out of ammo! Reloading...';
        }
    }
}, true);

restartButton.addEventListener('click', () => {
    if (currentLevel === 1) {
        startGame();
    } else {
        startLevel();
    }
});

// Initialize the game
document.addEventListener('DOMContentLoaded', startGame);

// Update the showBang function to ensure it works consistently
function showBang() {
    // Reset the animation
    bang.style.display = 'block';
    bang.style.animation = 'none';
    void bang.offsetWidth; // Trigger reflow
    bang.style.animation = 'flash 0.5s';
    
    // Clear any existing timeout
    if (bang.hideTimeout) {
        clearTimeout(bang.hideTimeout);
    }
    
    // Set new timeout
    bang.hideTimeout = setTimeout(() => {
        bang.style.display = 'none';
    }, 500);
}
