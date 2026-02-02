/* ===================================
   ダメだ石をぶっ壊せ！ - ゲームロジック
   =================================== */

// ゲーム設定
const CONFIG = {
    maxExp: 1000,
    expPerHit: 10,
    expPerMiss: 3,
    gemExpMultiplier: 2,
    positiveDropChance: 0.3, // 肯定的なしずくの出現率 (さらに増やした)
    positiveDropExpMultiplier: 2, // 経験値2倍
    stoneSpawnInterval: 1200,
    stoneSpeed: 2.0,
    stoneSizeMin: 35,
    stoneSizeMax: 65,
    rareStoneChance: 0.15,
    beamSpeed: 12,
    beamSize: 8,
    gemFallSpeed: 3,
    gemSize: 25,
    positiveDropSpeed: 2.5,
    positiveDropSize: 20,
    playerSpeed: 8,
    playerSize: 25,
    shellCrackStages: 5,
    growthStages: [0.2, 0.4, 0.6, 0.8, 1.0],
};

const POSITIVE_WORDS = ["ありがとう", "たすかったよ", "それいいね", "やるじゃん", "いきてるだけでOK", "すばらしい", "すごい", "あいしてるよ"];
const PASTEL_COLORS = ['#ff9ff3', '#feca57', '#ff6b6b', '#48dbfb', '#1dd1a1']; // 光るパステルカラー

const DAME_MESSAGES = ["だめだ", "むり", "できない", "やめとけ", "むりだ", "あきらめろ", "どうせ", "しっぱいする", "むだ", "さいのうない"];
const RARE_MESSAGES = ["もっとできる", "まだあまい", "ほんきだせ", "あきらめるな", "ちょうせんしろ", "かわれ", "せいちょうしろ", "たちあがれ", "おそれるな", "すすめ"];

let gameState = {
    isPlaying: false,
    isClearing: false,
    exp: 0,
    stones: [],
    beams: [],
    gems: [],
    positiveDrops: [],
    particles: [],
    plantStage: 0,
    brightness: 0,
    shellCracks: [],
    clearAnimation: 0,
};

let layout = {
    centerX: 0,
    centerY: 0,
    shellRadiusX: 0,
    shellRadiusY: 0,
    groundY: 0,
};

let player = { x: 0, targetX: 0, y: 0 };
let shell = { cracks: [], breaking: false, fragments: [] };
let plant = { seedVisible: false, stemHeight: 0, leafCount: 0, flowerBloom: 0, targetHeight: 0 };

let canvas, ctx, animationId, lastStoneSpawn = 0;
let keys = { left: false, right: false };
let touchStartX = null;

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', restartGame);
    canvas.addEventListener('click', handleShoot);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // エラーハンドリング
    window.onerror = function (msg, url, line, col, error) {
        console.error("Game Error:", msg, error);
        const errDiv = document.createElement('div');
        errDiv.style.position = 'fixed';
        errDiv.style.top = '0';
        errDiv.style.left = '0';
        errDiv.style.background = 'rgba(255,0,0,0.8)';
        errDiv.style.color = 'white';
        errDiv.style.padding = '10px';
        errDiv.style.zIndex = '10000';
        errDiv.innerText = 'エラーが発生しました: ' + msg;
        document.body.appendChild(errDiv);
    };
});

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    layout.centerX = canvas.width / 2;
    layout.centerY = canvas.height / 2;

    // 殻を横長にする
    layout.shellRadiusX = Math.min(canvas.width, canvas.height) * 0.55;
    if (canvas.width > canvas.height) layout.shellRadiusX = canvas.width * 0.4;
    layout.shellRadiusY = layout.shellRadiusX * 0.7; // YをXより小さくして横長に

    layout.groundY = layout.centerY + layout.shellRadiusY * 0.8;

    if (layout.centerY + layout.shellRadiusY > canvas.height - 20) {
        const scale = (canvas.height - 40) / (layout.shellRadiusY * 2);
        layout.shellRadiusY *= scale;
        layout.shellRadiusX *= scale;
        layout.groundY = layout.centerY + layout.shellRadiusY * 0.8;
    }
    if (!gameState.isPlaying) {
        player.x = layout.centerX;
        player.targetX = layout.centerX;
        player.y = layout.groundY;
    }
}

function startGame() {
    gameState = {
        isPlaying: true, isClearing: false, exp: 0, stones: [], beams: [], gems: [], positiveDrops: [],
        particles: [], plantStage: 0, brightness: 0, clearAnimation: 0
    };
    player = { x: layout.centerX, targetX: layout.centerX, y: layout.groundY };
    shell = { cracks: [], breaking: false, breakProgress: 0, fragments: [] };
    plant = { seedVisible: false, stemHeight: 0, leafCount: 0, flowerBloom: 0, targetHeight: 0 };
    lastStoneSpawn = 0;
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('clear-screen').classList.add('hidden');
    gameLoop();
}

function restartGame() {
    document.getElementById('clear-screen').classList.add('hidden');
    startGame();
}

function handleKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
}

function handleKeyUp(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
}

function handleShoot(e) {
    if (!gameState.isPlaying || gameState.isClearing) return;
    const rect = canvas.getBoundingClientRect();
    shootBeam(e.clientX - rect.left, e.clientY - rect.top);
}

function handleTouchStart(e) {
    e.preventDefault();
    if (!gameState.isPlaying || gameState.isClearing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = touch.clientX - rect.left;
    shootBeam(touch.clientX - rect.left, touch.clientY - rect.top);
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!gameState.isPlaying || touchStartX === null || gameState.isClearing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    player.targetX += (currentX - touchStartX) * 1.5;
    touchStartX = currentX;
}

function handleTouchEnd(e) { touchStartX = null; }

function shootBeam(targetX, targetY) {
    const startX = player.x;
    const startY = player.y - 10;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

    gameState.beams.push({
        x: startX, y: startY,
        vx: (dx / dist) * CONFIG.beamSpeed,
        vy: (dy / dist) * CONFIG.beamSpeed,
        size: CONFIG.beamSize, life: 1
    });
    gameState.exp = Math.min(gameState.exp + CONFIG.expPerMiss, CONFIG.maxExp);
    updateExpBar();
    createParticles(startX, startY, '#a29bfe', 5);
}

function spawnStone() {
    const size = CONFIG.stoneSizeMin + Math.random() * (CONFIG.stoneSizeMax - CONFIG.stoneSizeMin);
    const isRare = Math.random() < CONFIG.rareStoneChance;
    const messages = isRare ? RARE_MESSAGES : DAME_MESSAGES;
    const spawnWidth = layout.shellRadiusX * 1.6;
    const spawnX = layout.centerX + (Math.random() - 0.5) * spawnWidth;

    gameState.stones.push({
        x: spawnX, y: -size - 50, size: size,
        speed: CONFIG.stoneSpeed * (0.8 + Math.random() * 0.6),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        message: messages[Math.floor(Math.random() * messages.length)],
        isRare: isRare,
        color: isRare ? PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)] : null, // レアな石にパステルカラーを付与
        alpha: 1, fading: false
    });

    // 肯定的なしずくの出現判定
    if (Math.random() < CONFIG.positiveDropChance) {
        spawnPositiveDrop();
    }
}

function spawnPositiveDrop() {
    const word = POSITIVE_WORDS[Math.floor(Math.random() * POSITIVE_WORDS.length)];
    const spawnWidth = layout.shellRadiusX * 1.4;
    const x = layout.centerX + (Math.random() - 0.5) * spawnWidth;

    gameState.positiveDrops.push({
        x: x, y: -50, size: CONFIG.positiveDropSize,
        text: word,
        color: PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)], // パステルカラーを使用
        speed: CONFIG.positiveDropSpeed,
        rotation: 0,
        wobbleOffset: Math.random() * Math.PI * 2
    });
}

function spawnGem(x, y) {
    const colors = ['#a55eea', '#74b9ff', '#ff7675', '#ffeaa7'];
    gameState.gems.push({
        x: x, y: y, size: CONFIG.gemSize,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: CONFIG.gemFallSpeed, rotation: 0, sparkle: 0
    });
}

function addShellCrack() {
    const angle = Math.random() * Math.PI * 2;
    const startRadius = 0.5 + Math.random() * 0.3;
    const crack = {
        angle: angle, startRadius: startRadius,
        length: 0.1 + Math.random() * 0.2,
        branches: [], width: 2 + Math.random() * 2, alpha: 0, targetAlpha: 0.8
    };
    const branchCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < branchCount; i++) {
        crack.branches.push({
            offset: 0.3 + Math.random() * 0.5,
            angle: (Math.random() - 0.5) * 1.0,
            length: 0.1 + Math.random() * 0.15,
        });
    }
    shell.cracks.push(crack);
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        gameState.particles.push({
            x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 6, color: color, life: 1, decay: 0.01 + Math.random() * 0.02
        });
    }
}

function gameLoop(timestamp = 0) {
    if (!gameState.isPlaying) return;
    if (!gameState.isClearing && timestamp - lastStoneSpawn > CONFIG.stoneSpawnInterval) {
        spawnStone();
        lastStoneSpawn = timestamp;
    }
    update();
    render();
    if (gameState.exp >= CONFIG.maxExp && !gameState.isClearing) startClearAnimation();
    animationId = requestAnimationFrame(gameLoop);
}

function update() {
    updatePlayer();

    // クリア中もオブジェクトを更新（ただし衝突判定などは制御する）
    updateBeams();
    updateStones();
    updateGems();
    updatePositiveDrops();

    updateParticles();
    updatePlant();
    updateBrightness();
    shell.cracks.forEach(c => { if (c.alpha < c.targetAlpha) c.alpha += 0.05; });
    if (gameState.isClearing) updateClearAnimation();
}

function updatePlayer() {
    if (gameState.isClearing) return;
    if (keys.left) player.targetX -= CONFIG.playerSpeed;
    if (keys.right) player.targetX += CONFIG.playerSpeed;

    // プレイヤーが殻の端で消えないように制限を調整
    const limitX = layout.shellRadiusX * 0.9;
    player.targetX = Math.max(layout.centerX - limitX, Math.min(layout.centerX + limitX, player.targetX));
    player.x += (player.targetX - player.x) * 0.2;

    // 殻のカーブに沿ってY座標を計算
    // 楕円の方程式: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 = 1
    // y = cy + ry * sqrt(1 - (x-cx)^2/rx^2)
    const normalizedX = (player.x - layout.centerX) / layout.shellRadiusX;
    // 完全に端に行くとsqrt内が負になる可能性があるのでclamp
    const safeX = Math.max(-0.99, Math.min(0.99, normalizedX));
    const curveY = Math.sqrt(1 - safeX * safeX) * layout.shellRadiusY;

    // プレイヤーの足元がカーブに接するように少し調整
    player.y = layout.centerY + curveY * 0.9;
}

function updateBeams() {
    for (let i = gameState.beams.length - 1; i >= 0; i--) {
        const beam = gameState.beams[i];
        beam.x += beam.vx; beam.y += beam.vy; beam.life -= 0.01;
        if (beam.x < -100 || beam.x > canvas.width + 100 || beam.y < -100 || beam.y > canvas.height + 100 || beam.life <= 0) {
            gameState.beams.splice(i, 1); continue;
        }
        let hit = false;
        // クリア中は衝突判定をスキップ
        if (!gameState.isClearing) {
            for (let j = gameState.stones.length - 1; j >= 0; j--) {
                const stone = gameState.stones[j];
                if (stone.fading) continue;
                const dist = Math.hypot(beam.x - stone.x, beam.y - stone.y);
                if (dist < stone.size / 2 + beam.size) {
                    hitStone(stone, j); hit = true; break;
                }
            }
        }
        if (hit) gameState.beams.splice(i, 1);
    }
}

function hitStone(stone, index) {
    const prevExp = gameState.exp;
    gameState.exp = Math.min(gameState.exp + (CONFIG.expPerHit - CONFIG.expPerMiss), CONFIG.maxExp);
    updateExpBar();
    createParticles(stone.x, stone.y, stone.isRare ? '#ffeaa7' : '#a29bfe', 15);
    if (stone.isRare) spawnGem(stone.x, stone.y);

    const crackInterval = CONFIG.maxExp / CONFIG.shellCrackStages;
    if (Math.floor(gameState.exp / crackInterval) > Math.floor(prevExp / crackInterval)) {
        addShellCrack();
    }
    gameState.stones.splice(index, 1);
}

function updateStones() {
    for (let i = gameState.stones.length - 1; i >= 0; i--) {
        const stone = gameState.stones[i];
        stone.y += stone.speed;
        stone.rotation += stone.rotationSpeed;
        if (stone.y > layout.groundY + 100 && !stone.fading) stone.fading = true;
        if (stone.fading) {
            stone.alpha -= 0.05;
            if (stone.alpha <= 0) gameState.stones.splice(i, 1);
        }
    }
}

function updateGems() {
    for (let i = gameState.gems.length - 1; i >= 0; i--) {
        const gem = gameState.gems[i];
        gem.y += gem.speed; gem.rotation += 0.05; gem.sparkle = (gem.sparkle + 0.1) % (Math.PI * 2);
        const dist = Math.hypot(gem.x - player.x, gem.y - player.y);
        if (dist < gem.size + CONFIG.playerSize) {
            const prevExp = gameState.exp;
            gameState.exp = Math.min(gameState.exp + (CONFIG.expPerHit * CONFIG.gemExpMultiplier), CONFIG.maxExp);
            updateExpBar();
            const crackInterval = CONFIG.maxExp / CONFIG.shellCrackStages;
            if (Math.floor(gameState.exp / crackInterval) > Math.floor(prevExp / crackInterval)) {
                addShellCrack();
            }
            createParticles(gem.x, gem.y, gem.color, 20);
            gameState.gems.splice(i, 1); continue;
        }
        if (gem.y > canvas.height + gem.size) gameState.gems.splice(i, 1);
    }
}

function updatePositiveDrops() {
    for (let i = gameState.positiveDrops.length - 1; i >= 0; i--) {
        const drop = gameState.positiveDrops[i];
        drop.y += drop.speed;
        drop.x += Math.sin(Date.now() * 0.002 + drop.wobbleOffset) * 0.5; // ゆらゆらさせる

        const dist = Math.hypot(drop.x - player.x, drop.y - player.y);
        if (dist < drop.size + CONFIG.playerSize) {
            const prevExp = gameState.exp;
            // 経験値2倍の効果（あるいは大量経験値）
            gameState.exp = Math.min(gameState.exp + (CONFIG.expPerHit * CONFIG.positiveDropExpMultiplier), CONFIG.maxExp);
            updateExpBar();

            const crackInterval = CONFIG.maxExp / CONFIG.shellCrackStages;
            if (Math.floor(gameState.exp / crackInterval) > Math.floor(prevExp / crackInterval)) {
                addShellCrack();
            }
            createParticles(drop.x, drop.y, drop.color, 20);
            gameState.positiveDrops.splice(i, 1); continue;
        }
        if (drop.y > canvas.height + drop.size) gameState.positiveDrops.splice(i, 1);
    }
}

function updateParticles() {
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay;
        if (p.life <= 0) gameState.particles.splice(i, 1);
    }
}

function updatePlant() {
    const expRatio = gameState.exp / CONFIG.maxExp;
    if (expRatio > 0.05 && !plant.seedVisible) plant.seedVisible = true;
    for (let i = 0; i < CONFIG.growthStages.length; i++) {
        if (expRatio >= CONFIG.growthStages[i]) gameState.plantStage = i + 1;
    }
    plant.targetHeight = expRatio * (layout.shellRadiusY * 1.5);
    plant.stemHeight += (plant.targetHeight - plant.stemHeight) * 0.03;
    plant.leafCount = Math.floor(expRatio * 8);
}

function updateBrightness() {
    gameState.brightness += (gameState.exp / CONFIG.maxExp - gameState.brightness) * 0.02;
}

function updateExpBar() {
    const expBarFill = document.getElementById('exp-fill'); // ID修正: exp-bar-fill -> exp-fill
    if (expBarFill) {
        const progress = Math.min((gameState.exp / CONFIG.maxExp) * 100, 100);
        expBarFill.style.width = `${progress}%`;
    }
}

function startClearAnimation() {
    gameState.isClearing = true; shell.breaking = true;
    const fragmentCount = 40;
    for (let i = 0; i < fragmentCount; i++) {
        const angle = (i / fragmentCount) * Math.PI * 2;
        const ex = Math.cos(angle) * layout.shellRadiusX;
        const ey = Math.sin(angle) * layout.shellRadiusY;
        shell.fragments.push({
            x: layout.centerX + ex, y: layout.centerY + ey,
            vx: Math.cos(angle) * (5 + Math.random() * 10),
            vy: Math.sin(angle) * (5 + Math.random() * 10) - 5,
            rotation: Math.random() * Math.PI * 2, rotationSpeed: (Math.random() - 0.5) * 0.3,
            size: 20 + Math.random() * 40, alpha: 1, color: '#2d3436'
        });
    }
    for (let i = 0; i < 200; i++) createParticles(layout.centerX, layout.centerY, '#fff', 1);
}

function updateClearAnimation() {
    gameState.clearAnimation += 0.01;
    for (let i = shell.fragments.length - 1; i >= 0; i--) {
        const f = shell.fragments[i];
        f.x += f.vx; f.y += f.vy; f.vy += 0.2; f.rotation += f.rotationSpeed; f.alpha -= 0.005;
        if (f.alpha <= 0 || f.y > canvas.height + 200) shell.fragments.splice(i, 1);
    }
    plant.stemHeight += 5;
    // 花が見切れないように高さ制限
    if (plant.stemHeight > layout.shellRadiusY * 1.5) {
        plant.stemHeight = layout.shellRadiusY * 1.5;
    }
    plant.flowerBloom = Math.min(plant.flowerBloom + 0.02, 1);
    if (gameState.clearAnimation > 4.0 && shell.fragments.length === 0) showClearScreen();
}

function showClearScreen() {
    gameState.isPlaying = false;
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('clear-screen').classList.remove('hidden');
    drawClearFlower();
}

function render() {
    drawOutsideWorld();

    ctx.save();
    if (!shell.breaking) {
        ctx.beginPath();
        ctx.ellipse(layout.centerX, layout.centerY, layout.shellRadiusX, layout.shellRadiusY, 0, 0, Math.PI * 2);
        ctx.clip();
        drawInnerWorld();
    }

    if (shell.breaking) {
        ctx.globalAlpha = Math.max(0, 1 - gameState.clearAnimation * 0.5);
        drawInnerWorld();
        ctx.globalAlpha = 1;
    }

    drawPlant();
    ctx.restore(); // クリップを解除してプレイヤーを描画（端で消えないように）

    drawPlayer(); // クリップ解除後に移動

    // 石などを最前面に描画（クリア中も表示したままにする）
    for (const stone of gameState.stones) drawStone(stone);
    for (const beam of gameState.beams) drawBeam(beam);
    for (const gem of gameState.gems) drawGem(gem);
    for (const drop of gameState.positiveDrops) drawPositiveDrop(drop);
    for (const p of gameState.particles) drawParticle(p);

    if (!shell.breaking) drawShellOutline();
    else for (const f of shell.fragments) drawShellFragment(f);

    if (gameState.isClearing && gameState.clearAnimation > 0.5) drawClearText();
}

function drawOutsideWorld() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#81ecec'); gradient.addColorStop(0.5, '#74b9ff'); gradient.addColorStop(1, '#a29bfe');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawInnerWorld() {
    const b = gameState.brightness;
    // 本体は真っ白 (文字を読めるようにするため)
    ctx.fillStyle = "#ffffff";
    drawStars();
}

function drawStars() {
    const starCount = Math.floor(10 + gameState.brightness * 40);
    for (let i = 0; i < starCount; i++) {
        const x = ((i * 1234) % (layout.shellRadiusX * 1.8)) + layout.centerX - layout.shellRadiusX * 0.9;
        const y = ((i * 5678) % (layout.shellRadiusY * 1.8)) + layout.centerY - layout.shellRadiusY * 0.9;
        if (Math.hypot((x - layout.centerX) / layout.shellRadiusX, (y - layout.centerY) / layout.shellRadiusY) > 0.9) continue;
        const size = 1 + (i % 3);
        const twinkle = Math.sin(Date.now() * 0.003 + i) * 0.5 + 0.5;
        ctx.globalAlpha = twinkle * (0.2 + gameState.brightness * 0.8);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawShellOutline() {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(layout.centerX, layout.centerY, layout.shellRadiusX, layout.shellRadiusY, 0, 0, Math.PI * 2);
    const c = 40 + gameState.brightness * 60;
    ctx.strokeStyle = `rgb(${c}, ${c}, ${c + 20})`; ctx.lineWidth = 15; ctx.stroke();
    drawCracks();
    ctx.restore();
}

function drawCracks() {
    ctx.save(); ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + gameState.brightness * 0.4})`; ctx.lineCap = 'round';
    for (const crack of shell.cracks) {
        const { startRadius: sR, length: len, angle, width, alpha, branches } = crack;
        const cx = layout.centerX, cy = layout.centerY, rx = layout.shellRadiusX, ry = layout.shellRadiusY;
        const x1 = cx + Math.cos(angle) * rx * sR, y1 = cy + Math.sin(angle) * ry * sR;
        const x2 = cx + Math.cos(angle) * rx * (sR - len), y2 = cy + Math.sin(angle) * ry * (sR - len);
        ctx.lineWidth = width; ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        for (const b of branches) {
            const bx = x1 + (x2 - x1) * b.offset, by = y1 + (y2 - y1) * b.offset;
            const bEx = bx - Math.cos(angle + b.angle) * rx * b.length, bEy = by - Math.sin(angle + b.angle) * ry * b.length;
            ctx.lineWidth = width * 0.6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bEx, bEy); ctx.stroke();
        }
    }
    ctx.restore();
}

function drawShellFragment(f) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rotation); ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color; ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2, r = f.size * (0.7 + Math.sin(i * 2.5) * 0.3);
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawPlant() {
    if (!plant.seedVisible) return;
    const rootX = layout.centerX, rootY = layout.groundY;
    ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.ellipse(rootX, rootY + 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (plant.stemHeight > 0) {
        ctx.strokeStyle = '#27ae60'; ctx.lineWidth = 4 + (plant.stemHeight / 200) * 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(rootX, rootY);
        const wobble = Math.sin(Date.now() * 0.001) * 5;
        ctx.quadraticCurveTo(rootX + wobble, rootY - plant.stemHeight * 0.5, rootX, rootY - plant.stemHeight);
        ctx.stroke();
        for (let i = 0; i < plant.leafCount; i++) {
            const h = plant.stemHeight * ((i + 1) / (plant.leafCount + 1)), ly = rootY - h;
            const side = i % 2 === 0 ? 1 : -1;
            ctx.fillStyle = `hsl(${120 + i * 5}, 60%, ${40 + gameState.brightness * 20}%)`;
            ctx.beginPath(); ctx.ellipse(rootX + side * 15, ly, 12, 6, side * 0.3, 0, Math.PI * 2); ctx.fill();
        }
        let bloomSize = gameState.isClearing ? 30 + plant.flowerBloom * 100 : (gameState.plantStage >= 4 ? 10 + (gameState.exp / CONFIG.maxExp - 0.8) * 50 : 0);
        if (bloomSize > 0) drawFlowerHead(rootX, rootY - plant.stemHeight, bloomSize);
    }
}

function drawFlowerHead(x, y, size) {
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + Date.now() * 0.0005;
        ctx.fillStyle = `hsl(${330 + i * 10}, 80%, ${70 + Math.sin(Date.now() * 0.002) * 10}%)`;
        ctx.beginPath(); ctx.ellipse(x + Math.cos(angle) * size * 0.5, y + Math.sin(angle) * size * 0.5, size * 0.7, size * 0.3, angle, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffeaa7'; ctx.beginPath(); ctx.arc(x, y, size * 0.3, 0, Math.PI * 2); ctx.fill();
}

function drawPlayer() {
    // クリア中もプレイヤーを描画し続ける

    // 最初は光がない状態から、経験値と共に光る
    const brightness = gameState.brightness; // 0 to 1

    // 色の計算：最初は暗く、徐々に明るく
    // Base: Dark Blue/Black -> Bright Light
    const r = Math.floor(10 + brightness * 245);
    const g = Math.floor(10 + brightness * 245);
    const b = Math.floor(20 + brightness * 235);

    const color = `rgb(${r},${g},${b})`;
    const x = player.x, y = player.y;

    // グロー効果も明るさに依存
    // 本体は真っ白 (文字を読めるようにするため)
    ctx.fillStyle = "#ffffff";

    // 中心の核
    ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`; // 最初は芯も見えない？あるいは薄く
    if (brightness < 0.1) ctx.fillStyle = '#333';

    ctx.beginPath(); ctx.arc(x, y, CONFIG.playerSize * 0.4, 0, Math.PI * 2); ctx.fill();

    if (!('ontouchstart' in window) && gameState.exp < 50) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('← Move →', x, y + 40);
    }
}

function drawStone(stone) {
    ctx.save(); ctx.translate(stone.x, stone.y); ctx.rotate(stone.rotation); ctx.globalAlpha = stone.alpha;

    // 塗りつぶしのスタイル決定
    if (stone.isRare) {
        // レア: パステルカラーで発光
        ctx.shadowColor = stone.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = stone.color; // パステルカラー
    } else {
        // 通常: 暗い色 (グラデーション)
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, stone.size / 2);
        gradient.addColorStop(0, '#636e72'); gradient.addColorStop(0.5, '#4a4a4a'); gradient.addColorStop(1, '#2d3436');
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2, r = stone.size / 2 * (0.8 + Math.sin(i * 3) * 0.2);
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();

    // レアな場合、ハイライトを入れて少し立体感を出す
    if (stone.isRare) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
    }

    // 文字描画
    // レアなら黒文字、通常なら白文字
    ctx.fillStyle = stone.isRare ? '#000' : '#fff';
    ctx.font = `bold ${stone.size / 4}px 'Zen Maru Gothic', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(stone.message, 0, 0);
    ctx.restore();
}

function drawBeam(beam) {
    ctx.save(); ctx.globalAlpha = beam.life;
    // 本体は真っ白 (文字を読めるようにするため)
    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(beam.x, beam.y, beam.size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawGem(gem) {
    ctx.save(); ctx.translate(gem.x, gem.y); ctx.rotate(gem.rotation);
    ctx.beginPath(); ctx.moveTo(0, -gem.size); ctx.lineTo(gem.size * 0.7, 0); ctx.lineTo(0, gem.size); ctx.lineTo(-gem.size * 0.7, 0); ctx.closePath();
    const gradient = ctx.createLinearGradient(-gem.size, -gem.size, gem.size, gem.size);
    gradient.addColorStop(0, gem.color); gradient.addColorStop(0.5, '#fff'); gradient.addColorStop(1, gem.color);
    ctx.fillStyle = gradient; ctx.fill();
    ctx.shadowColor = gem.color; ctx.shadowBlur = 15 + Math.sin(gem.sparkle) * 5; ctx.fill();
    ctx.restore();
}

function drawParticle(p) {
    ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawClearFlower() {
    const display = document.getElementById('flower-display');
    display.innerHTML = `
        <svg viewBox="0 0 200 200" style="width: 100%; height: 100%;">
            <defs>
                <radialGradient id="petalGradient">
                    <stop offset="0%" stop-color="#fd79a8"/>
                    <stop offset="100%" stop-color="#e84393"/>
                </radialGradient>
                <radialGradient id="centerGradient">
                    <stop offset="0%" stop-color="#ffeaa7"/>
                    <stop offset="100%" stop-color="#fdcb6e"/>
                </radialGradient>
            </defs>
            <path d="M100 200 Q95 150 100 80" stroke="#27ae60" stroke-width="6" fill="none"/>
            <ellipse cx="85" cy="160" rx="20" ry="8" fill="#2ecc71" transform="rotate(-30 85 160)"/>
            <ellipse cx="115" cy="140" rx="18" ry="7" fill="#27ae60" transform="rotate(25 115 140)"/>
            <ellipse cx="80" cy="120" rx="16" ry="6" fill="#2ecc71" transform="rotate(-20 80 120)"/>
            <ellipse cx="120" cy="100" rx="14" ry="5" fill="#27ae60" transform="rotate(30 120 100)"/>
            ${Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * 360;
        return `<ellipse cx="100" cy="50" rx="20" ry="35" fill="url(#petalGradient)" 
                    transform="rotate(${angle} 100 80)" opacity="0.9">
                    <animate attributeName="opacity" values="0.7;1;0.7" dur="${2 + i * 0.1}s" repeatCount="indefinite"/>
                </ellipse>`;
    }).join('')}
            <circle cx="100" cy="80" r="18" fill="url(#centerGradient)">
                <animate attributeName="r" values="16;20;16" dur="2s" repeatCount="indefinite"/>
            </circle>
        </svg>
    `;
}

function drawClearText() {
    const alpha = Math.min((gameState.clearAnimation - 0.5) * 2, 1);
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px "Zen Maru Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#fd79a8'; ctx.shadowBlur = 20;
    ctx.fillText('心の殻が破れた！', canvas.width / 2, 80);
    ctx.font = '20px "Zen Maru Gothic", sans-serif';
    ctx.fillText('あなたの心に美しい花が咲きました', canvas.width / 2, 120);
    ctx.restore();
}

function drawPositiveDrop(drop) {
    ctx.save(); ctx.translate(drop.x, drop.y);
    // しずく型 (光るパステルカラー)
    ctx.beginPath();
    ctx.moveTo(0, -drop.size);
    ctx.bezierCurveTo(drop.size, 0, drop.size, drop.size, 0, drop.size);
    ctx.bezierCurveTo(-drop.size, drop.size, -drop.size, 0, 0, -drop.size);

    // グロー効果 (発光)
    ctx.shadowColor = drop.color;
    ctx.shadowBlur = 30; // 強く発光させる

    // 本体は真っ白 (文字を読めるようにするため)
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // ハイライト (少し白を乗せる - 不要なら削除可能だが残しておく)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    // 文字 (黒色)
    ctx.fillStyle = '#000';
    ctx.font = `bold ${drop.size * 0.6}px 'Zen Maru Gothic', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(drop.text, 0, drop.size * 0.2);



    ctx.restore();
}
