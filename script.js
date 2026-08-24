/* ===================================================
   1. SISTEMA DE AUDIO SINTETIZADO (WEB AUDIO API)
   =================================================== */
class AudioSystem {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playEat() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playPowerUp() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playCrash() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
}

const sfx = new AudioSystem();

/* ===================================================
   2. ESTADO DEL JUEGO Y VARIABLES
   =================================================== */
const canvas = document.getElementById('lienzo-snake');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;

let snake = [];
let dirX = 1, dirY = 0;
let nextDirX = 1, nextDirY = 0;

let dataNode = { x: 0, y: 0 };
let powerUp = null; // { x, y, type: 'freeze'|'nitro'|'cut', timer }
let firewalls = []; // Array de posiciones {x, y}

let score = 0;
let highscore = 0;
let temp = 35;

let gameLoopInterval = null;
let baseSpeed = 80;
let currentSpeed = 80;
let isPaused = false;
let isGameOver = false;

// Estado de Power-Ups activos
let activeEffect = null;
let effectTimer = 0;

/* ===================================================
   3. FLUJO Y CONTROLES
   =================================================== */
function iniciarInfiltracion() {
  sfx.init();
  baseSpeed = parseInt(document.getElementById('select-diff').value);
  currentSpeed = baseSpeed;
  
  document.getElementById('menu-inicio').classList.add('oculto');
  document.getElementById('escenario-juego').classList.remove('oculto');
  
  reiniciarJuego();
}

function volverAlMenu() {
  clearInterval(gameLoopInterval);
  document.getElementById('escenario-juego').classList.add('oculto');
  document.getElementById('menu-inicio').classList.remove('oculto');
}

function reiniciarJuego() {
  clearInterval(gameLoopInterval);
  
  snake = [
    { x: 10, y: 12 },
    { x: 9, y: 12 },
    { x: 8, y: 12 }
  ];
  
  dirX = 1; dirY = 0;
  nextDirX = 1; nextDirY = 0;
  
  score = 0;
  temp = 35;
  isGameOver = false;
  isPaused = false;
  powerUp = null;
  firewalls = [];
  activeEffect = null;
  currentSpeed = baseSpeed;
  
  actualizarHUD();
  generarDataNode();
  
  ajustarVelocidad(currentSpeed);
}

function ajustarVelocidad(ms) {
  clearInterval(gameLoopInterval);
  gameLoopInterval = setInterval(gameStep, ms);
}

function pausarJuego() {
  if (isGameOver) return;
  isPaused = !isPaused;
  document.getElementById('btn-pause').innerText = isPaused ? '[ REANUDAR ]' : '[ PAUSA ]';
}

/* ===================================================
   4. BUCLE PRINCIPAL DE LÓGICA (GAME STEP)
   =================================================== */
function gameStep() {
  if (isPaused || isGameOver) return;

  dirX = nextDirX;
  dirY = nextDirY;

  const headX = snake[0].x + dirX;
  const headY = snake[0].y + dirY;

  // 1. Colisión con Bordes
  if (headX < 0 || headX >= TILE_COUNT || headY < 0 || headY >= TILE_COUNT) {
    ejecutarGameOver();
    return;
  }

  // 2. Colisión con Cuerpo
  for (let segment of snake) {
    if (segment.x === headX && segment.y === headY) {
      ejecutarGameOver();
      return;
    }
  }

  // 3. Colisión con Cortafuegos (Firewalls)
  for (let fw of firewalls) {
    if (fw.x === headX && fw.y === headY) {
      ejecutarGameOver();
      return;
    }
  }

  // Mover serpiente
  snake.unshift({ x: headX, y: headY });

  // 4. Comer Data Node estándar
  if (headX === dataNode.x && headY === dataNode.y) {
    sfx.playEat();
    const puntos = activeEffect === 'nitro' ? 200 : 100;
    score += puntos;
    temp = Math.min(95, temp + 1.2);
    
    if (score > highscore) highscore = score;
    
    // Desplegar Cortafuegos cada 300 puntos
    if (score % 300 === 0) {
      generarCortafuegos();
    }

    // Oportunidad de spawnear Power-Up (30% de probabilidad)
    if (!powerUp && Math.random() < 0.3) {
      generarPowerUp();
    }

    actualizarHUD();
    generarDataNode();
  } else {
    snake.pop();
  }

  // 5. Recoger Power-Up
  if (powerUp && headX === powerUp.x && headY === powerUp.y) {
    sfx.playPowerUp();
    aplicarPowerUp(powerUp.type);
    powerUp = null;
  }

  // Manejo de temporizador de Power-Up
  if (activeEffect) {
    effectTimer--;
    if (effectTimer <= 0) {
      desactivarEfecto();
    }
  }

  renderizar();
}

/* ===================================================
   5. SISTEMA DE POWER-UPS Y CORTAFUEGOS
   =================================================== */
function generarCortafuegos() {
  let x, y, valido;
  do {
    x = Math.floor(Math.random() * TILE_COUNT);
    y = Math.floor(Math.random() * TILE_COUNT);
    valido = true;

    // No generar cerca de la cabeza ni en ítems
    if (Math.abs(x - snake[0].x) < 3 && Math.abs(y - snake[0].y) < 3) valido = false;
    if (x === dataNode.x && y === dataNode.y) valido = false;
  } while (!valido);

  firewalls.push({ x, y });
}

function generarPowerUp() {
  const tipos = ['freeze', 'nitro', 'cut'];
  const typeSelected = tipos[Math.floor(Math.random() * tipos.length)];
  let x, y, valido;

  do {
    x = Math.floor(Math.random() * TILE_COUNT);
    y = Math.floor(Math.random() * TILE_COUNT);
    valido = true;
    if (x === dataNode.x && y === dataNode.y) valido = false;
  } while (!valido);

  powerUp = { x, y, type: typeSelected };
}

function aplicarPowerUp(tipo) {
  activeEffect = tipo;
  effectTimer = 40; // Aproximadamente 4 a 5 segundos según velocidad

  if (tipo === 'freeze') {
    temp = 35; // Enfría CPU
    currentSpeed = baseSpeed * 1.5;
    ajustarVelocidad(currentSpeed);
  } else if (tipo === 'nitro') {
    currentSpeed = baseSpeed * 0.6;
    ajustarVelocidad(currentSpeed);
  } else if (tipo === 'cut') {
    // Truncar 25% del cuerpo
    const recortar = Math.floor(snake.length * 0.25);
    for (let i = 0; i < recortar; i++) {
      if (snake.length > 3) snake.pop();
    }
    desactivarEfecto(); // Efecto instantáneo
  }
}

function desactivarEfecto() {
  activeEffect = null;
  currentSpeed = baseSpeed;
  ajustarVelocidad(currentSpeed);
}

function ejecutarGameOver() {
  isGameOver = true;
  sfx.playCrash();
  clearInterval(gameLoopInterval);
  
  // Fondo oscuro transparente con matiz frío
  ctx.fillStyle = 'rgba(6, 8, 12, 0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Texto de error
  ctx.fillStyle = '#ff3355';
  ctx.font = 'bold 20px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('CRASH: BARRERA DETECTADA', canvas.width / 2, canvas.height / 2 - 10);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Courier New';
  ctx.fillText('PRESIONA REINICIAR PARA NUEVO INTENTO', canvas.width / 2, canvas.height / 2 + 25);
}

function generarDataNode() {
  let valido = false;
  while (!valido) {
    dataNode.x = Math.floor(Math.random() * TILE_COUNT);
    dataNode.y = Math.floor(Math.random() * TILE_COUNT);
    valido = true;
    for (let segment of snake) {
      if (segment.x === dataNode.x && segment.y === dataNode.y) valido = false;
    }
  }
}

function actualizarHUD() {
  document.getElementById('score-val').innerText = String(score).padStart(4, '0');
  document.getElementById('highscore-val').innerText = String(highscore).padStart(4, '0');
  document.getElementById('temp-val').innerText = `${temp.toFixed(1)}°C`;
}

/* ===================================================
   6. RENDERIZADO VISUAL CON EFECTOS NEÓN (BLANCO CUÁNTICO)
   =================================================== */
function renderizar() {
  // Fondo del Canvas
  ctx.fillStyle = '#040508';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Malla / Circuito
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height);
    ctx.moveTo(0, i); ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }

  // Cortafuegos (Firewalls - Rojo Fuego)
  ctx.fillStyle = '#ff3355';
  ctx.shadowColor = '#ff3355';
  ctx.shadowBlur = 12;
  firewalls.forEach(fw => {
    ctx.fillRect(fw.x * GRID_SIZE + 1, fw.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
  });

  // Paquete Estándar (Púrpura Neón Ultra)
  ctx.fillStyle = '#8a00ff';
  ctx.shadowColor = '#8a00ff';
  ctx.shadowBlur = 14;
  ctx.fillRect(dataNode.x * GRID_SIZE + 2, dataNode.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);

  // Power-Up Dinámico
  if (powerUp) {
    if (powerUp.type === 'freeze') ctx.fillStyle = '#00e1ff';
    else if (powerUp.type === 'nitro') ctx.fillStyle = '#ff6600';
    else if (powerUp.type === 'cut') ctx.fillStyle = '#00ff66';

    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 15;
    ctx.fillRect(powerUp.x * GRID_SIZE + 3, powerUp.y * GRID_SIZE + 3, GRID_SIZE - 6, GRID_SIZE - 6);
  }

  // Gusano (Data Snake - Cabeza Blanco Puro brillante / Cuerpo Gris Metalizado)
  snake.forEach((segment, index) => {
    if (index === 0) {
      ctx.fillStyle = activeEffect === 'nitro' ? '#ff6600' : (activeEffect === 'freeze' ? '#00e1ff' : '#ffffff');
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 16;
    } else {
      ctx.fillStyle = '#788090';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 4;
    }
    ctx.fillRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
  });

  ctx.shadowBlur = 0; // Limpiar sombras
}

/* ===================================================
   7. TECLADO
   =================================================== */
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ((key === 'arrowup' || key === 'w') && dirY !== 1) { nextDirX = 0; nextDirY = -1; }
  else if ((key === 'arrowdown' || key === 's') && dirY !== -1) { nextDirX = 0; nextDirY = 1; }
  else if ((key === 'arrowleft' || key === 'a') && dirX !== 1) { nextDirX = -1; nextDirY = 0; }
  else if ((key === 'arrowright' || key === 'd') && dirX !== -1) { nextDirX = 1; nextDirY = 0; }
});
