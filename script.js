const scene = document.getElementById('scene');
const viewTurnaround = document.getElementById('view-turnaround');
const message = document.getElementById('message');
const bang = document.getElementById('bang');
const restartButton = document.getElementById('restart');
const reactionTimeDisplay = document.getElementById('reaction-time');

let gameState = 'waiting';
let canShoot = false;
let tStart;
let difficulty = 'medium'; // Could be expanded to a selector

const difficultySettings = {
    easy: { minDelay: 1000, maxDelay: 2000, accuracy: 0.6 },
    medium: { minDelay: 500, maxDelay: 1500, accuracy: 0.8 },
    hard: { minDelay: 300, maxDelay: 1000, accuracy: 0.95 }
};

function startGame() {
    gameState = 'waiting';
    canShoot = false;
    message.textContent = 'Get ready...';
    scene.style.transform = 'rotateY(0deg)';
    restartButton.style.display = 'none';
    bang.style.display = 'none';
    reactionTimeDisplay.style.display = 'none';

    // Randomize AI cowboy position
    const aiCowboy = viewTurnaround.querySelector('.cowboy');
    aiCowboy.style.left = `${250 + Math.random() * 400}px`; // Between 250px and 650px
    aiCowboy.style.bottom = '60px';
    aiCowboy.classList.remove('hit');

    const drawDelay = 2000 + Math.random() * 3000; // 2-5 seconds
    setTimeout(() => {
        if (gameState === 'waiting') {
            gameState = 'turning';
            message.textContent = 'Draw!';
            scene.style.transform = 'rotateY(180deg)';
        }
    }, drawDelay);
}

scene.addEventListener('transitionend', () => {
    if (gameState === 'turning') {
        gameState = 'draw';
        canShoot = true;
        tStart = Date.now();

        // AI shooting logic
        const settings = difficultySettings[difficulty];
        const aiDelay = settings.minDelay + Math.random() * (settings.maxDelay - settings.minDelay);
        setTimeout(() => {
            if (gameState === 'draw') {
                if (Math.random() < settings.accuracy) {
                    gameState = 'ended';
                    showBang();
                    message.textContent = 'The AI gunned you down!';
                    restartButton.style.display = 'block';
                } else {
                    message.textContent = 'AI missed! Your chance!';
                }
            }
        }, aiDelay);
    }
});

viewTurnaround.addEventListener('click', (e) => {
    if (e.target.classList.contains('cowboy')) {
        const aiCowboy = e.target;
        if (gameState === 'waiting' || gameState === 'turning') {
            gameState = 'ended';
            message.textContent = 'False start! You lose!';
            restartButton.style.display = 'block';
        } else if (gameState === 'draw' && canShoot) {
            gameState = 'ended';
            showBang();
            aiCowboy.classList.add('hit');
            const reactionTime = (Date.now() - tStart) / 1000;
            message.textContent = 'You shot the AI!';
            reactionTimeDisplay.style.display = 'block';
            reactionTimeDisplay.textContent = `Reaction time: ${reactionTime.toFixed(2)} seconds`;
            restartButton.style.display = 'block';

            // Fun extra: Tumbleweed victory roll
            const victoryTumbleweed = document.createElement('div');
            victoryTumbleweed.className = 'tumbleweed';
            victoryTumbleweed.style.left = '0px';
            victoryTumbleweed.style.bottom = '60px';
            victoryTumbleweed.style.animation = 'roll 5s linear';
            viewTurnaround.appendChild(victoryTumbleweed);
            setTimeout(() => victoryTumbleweed.remove(), 5000);
        }
    }
});

function showBang() {
    bang.style.display = 'block';
    setTimeout(() => {
        bang.style.display = 'none';
    }, 200);
}

restartButton.addEventListener('click', startGame);

// Start the game
startGame();
