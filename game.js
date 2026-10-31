const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statsContainer = document.getElementById('stats');
const inventoryContainer = document.getElementById('inventory');
const hudMessage = document.getElementById('hudMessage');

const world = {
  width: canvas.width,
  height: canvas.height,
  time: 0,
  dayLength: 85,
  night: false,
  relics: 0,
  campfire: false,
  relicObjects: [],
  resourceNodes: [],
  enemies: [],
};

const state = {
  keys: {},
  inventory: {
    wood: 0,
    stone: 0,
    fiber: 0,
    metal: 0,
    crystal: 0,
    food: 0,
    water: 0,
    relic: 0,
  },
  stats: {
    health: 100,
    hunger: 100,
    thirst: 100,
    sync: 0,
  },
  unlocked: {
    axe: false,
    bow: false,
    plasma: false,
  },
  hitFlash: 0,
};

const player = {
  x: canvas.width * 0.5,
  y: canvas.height * 0.55,
  radius: 14,
  speed: 200,
  dash: 1,
  attackCooldown: 0,
  lookX: 1,
  lookY: 0,
};

function makeResource(type, x, y) {
  return { type, x, y, radius: 18, amount: 1, picked: false };
}

function seedWorld() {
  world.resourceNodes = [
    makeResource('wood', 120, 170),
    makeResource('wood', 240, 260),
    makeResource('wood', 760, 390),
    makeResource('stone', 190, 420),
    makeResource('stone', 560, 120),
    makeResource('fiber', 300, 120),
    makeResource('fiber', 690, 250),
    makeResource('metal', 790, 160),
    makeResource('metal', 640, 390),
    makeResource('crystal', 450, 430),
    makeResource('food', 833, 440),
    makeResource('water', 160, 290),
    makeResource('water', 740, 80),
    makeResource('relic', 460, 190),
    makeResource('relic', 335, 330),
    makeResource('relic', 680, 310),
  ];

  world.enemies = [
    { x: 205, y: 120, radius: 12, hp: 35, speed: 60, type: 'dilophosaur' },
    { x: 705, y: 260, radius: 14, hp: 50, speed: 75, type: 'raptor' },
    { x: 495, y: 420, radius: 18, hp: 70, speed: 65, type: 'alpha' },
  ];
}

function renderStats() {
  const items = [
    ['Saúde', `${Math.max(0, Math.round(state.stats.health))}%`],
    ['Fome', `${Math.max(0, Math.round(state.stats.hunger))}%`],
    ['Sede', `${Math.max(0, Math.round(state.stats.thirst))}%`],
    ['Sincronia', `${Math.round(state.stats.sync)}%`],
  ];

  statsContainer.innerHTML = items
    .map(([name, value]) => `
      <div class="stat">
        <span class="stat-name">${name}</span>
        <span class="stat-value">${value}</span>
      </div>
    `)
    .join('');

  const inventoryList = Object.entries(state.inventory)
    .map(([key, value]) => `<li><span>${labelFor(key)}</span><strong>${value}</strong></li>`)
    .join('');

  inventoryContainer.innerHTML = inventoryList;
}

function labelFor(key) {
  const labels = {
    wood: 'Madeira',
    stone: 'Pedra',
    fiber: 'Fibra',
    metal: 'Metal',
    crystal: 'Cristal',
    food: 'Comida',
    water: 'Água',
    relic: 'Relíquia',
  };

  return labels[key] || key;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearbyResource() {
  for (const node of world.resourceNodes) {
    if (!node.picked && distance(node, player) < node.radius + player.radius + 18) {
      return node;
    }
  }
  return null;
}

function gatherNearbyResource() {
  const node = nearbyResource();
  if (!node) {
    return;
  }

  if (node.type === 'relic') {
    state.inventory.relic += 1;
    state.stats.sync = clamp(state.stats.sync + 15, 0, 100);
    world.relics += 1;
    hudMessage.textContent = 'Relíquia recuperada: memória do planeta reativada.';
  } else {
    state.inventory[node.type] += 1;
    hudMessage.textContent = `Recurso coletado: ${labelFor(node.type)}.`;
  }

  node.picked = true;
  renderStats();
}

function craftRecipe(recipe) {
  const recipes = {
    stoneAxe: { cost: { wood: 2, stone: 2, fiber: 1 }, label: 'Machado de Pedra', unlock: 'axe' },
    campfire: { cost: { wood: 3, stone: 2, fiber: 1 }, label: 'Fogueira Básica', unlock: 'campfire' },
    recurveBow: { cost: { wood: 3, metal: 2, fiber: 2 }, label: 'Arco Recurvo', unlock: 'bow' },
    plasmaCore: { cost: { metal: 3, crystal: 2, fiber: 2 }, label: 'Núcleo de Plasma', unlock: 'plasma' },
  };

  const recipeData = recipes[recipe];
  if (!recipeData) return;

  const canAfford = Object.entries(recipeData.cost).every(([k, v]) => state.inventory[k] >= v);
  if (!canAfford) {
    hudMessage.textContent = `Recursos insuficientes para ${recipeData.label}.`;
    return;
  }

  Object.entries(recipeData.cost).forEach(([k, v]) => {
    state.inventory[k] -= v;
  });

  if (recipeData.unlock === 'campfire') {
    world.campfire = true;
    state.stats.health = clamp(state.stats.health + 8, 0, 100);
  }

  if (recipeData.unlock === 'axe') {
    state.unlocked.axe = true;
  }

  if (recipeData.unlock === 'bow') {
    state.unlocked.bow = true;
  }

  if (recipeData.unlock === 'plasma') {
    state.unlocked.plasma = true;
    state.stats.sync = clamp(state.stats.sync + 25, 0, 100);
  }

  hudMessage.textContent = `${recipeData.label} criado com sucesso.`;
  renderStats();
}

function updatePlayer(dt) {
  let moveX = 0;
  let moveY = 0;

  if (state.keys['w'] || state.keys['arrowup']) moveY -= 1;
  if (state.keys['s'] || state.keys['arrowdown']) moveY += 1;
  if (state.keys['a'] || state.keys['arrowleft']) moveX -= 1;
  if (state.keys['d'] || state.keys['arrowright']) moveX += 1;

  const magnitude = Math.hypot(moveX, moveY) || 1;
  if (moveX || moveY) {
    player.lookX = moveX / magnitude;
    player.lookY = moveY / magnitude;
  }

  const modifier = state.keys['shift'] ? 1.48 : 1;
  player.x += (moveX / magnitude) * player.speed * modifier * dt;
  player.y += (moveY / magnitude) * player.speed * modifier * dt;

  player.x = clamp(player.x, player.radius, canvas.width - player.radius);
  player.y = clamp(player.y, player.radius, canvas.height - player.radius);

  if (state.keys[' '] && player.attackCooldown <= 0) {
    attackEnemy();
    player.attackCooldown = 0.4;
  }

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
}

function attackEnemy() {
  for (const enemy of world.enemies) {
    const d = distance(player, enemy);
    if (d < 60) {
      enemy.hp -= state.unlocked.bow ? 22 : 15;
      state.stats.sync = clamp(state.stats.sync + 2, 0, 100);
      hudMessage.textContent = 'Ataque realizado. A ameaça recua.';

      if (enemy.hp <= 0) {
        enemy.x = -1000;
        enemy.y = -1000;
        state.inventory.food += 1;
        state.inventory.metal += 1;
        hudMessage.textContent = 'Inimigo derrotado. Recursos de sobrevivência obtidos.';
      }
    }
  }
}

function updateWorld(dt) {
  world.time += dt;
  const cycle = (world.time % world.dayLength) / world.dayLength;
  world.night = cycle > 0.65;

  state.stats.hunger = clamp(state.stats.hunger - dt * 1.2, 0, 100);
  state.stats.thirst = clamp(state.stats.thirst - dt * 1.6, 0, 100);

  if (state.stats.hunger <= 15) {
    state.stats.health = clamp(state.stats.health - dt * 5, 0, 100);
  }

  if (state.stats.thirst <= 8) {
    state.stats.health = clamp(state.stats.health - dt * 6, 0, 100);
  }

  if (state.inventory.food > 0 && world.time % 10 < dt) {
    state.inventory.food = Math.max(0, state.inventory.food - 1);
    state.stats.hunger = clamp(state.stats.hunger + 18, 0, 100);
  }

  if (state.inventory.water > 0 && world.time % 9 < dt) {
    state.inventory.water = Math.max(0, state.inventory.water - 1);
    state.stats.thirst = clamp(state.stats.thirst + 18, 0, 100);
  }

  if (state.stats.health <= 0) {
    state.stats.health = 100;
    state.stats.hunger = 100;
    state.stats.thirst = 100;
    hudMessage.textContent = 'Respawn realizado. O planeta continua exigindo sobrevivência.';
  }

  if (world.relics >= 3 && state.unlocked.plasma) {
    hudMessage.textContent = 'A transmissão global está pronta. O sinal orbital foi ativado!';
    state.stats.sync = 100;
  }
}

function tickEnemies(dt) {
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0 || enemy.x < -2000) continue;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < 200 || world.night) {
      enemy.x += (dx / dist) * enemy.speed * dt;
      enemy.y += (dy / dist) * enemy.speed * dt;
    }

    if (dist < enemy.radius + player.radius + 4) {
      state.stats.health = clamp(state.stats.health - dt * 18, 0, 100);
      state.hitFlash = 0.2;
    }
  }
}

function drawBackground() {
  const skyTop = world.night ? '#020810' : '#7bdfff';
  const skyBottom = world.night ? '#0f1d2a' : '#bff3ff';
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, skyTop);
  gradient.addColorStop(1, skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = world.night ? 'rgba(13, 18, 24, 0.72)' : 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#273a2d';
  ctx.fillRect(0, canvas.height * 0.68, canvas.width, canvas.height * 0.32);
  ctx.fillStyle = '#345a42';
  ctx.fillRect(0, canvas.height * 0.58, canvas.width, canvas.height * 0.1);
  ctx.fillStyle = '#405a4b';
  ctx.fillRect(0, canvas.height * 0.62, canvas.width, 40);
}

function drawResourceNodes() {
  for (const node of world.resourceNodes) {
    if (node.picked) continue;

    const colors = {
      wood: '#8d5d2f',
      stone: '#7e8ea0',
      fiber: '#62b862',
      metal: '#a2b0c7',
      crystal: '#7ad8ff',
      food: '#d9d388',
      water: '#5aa8ff',
      relic: '#d6a2ff',
    };

    ctx.fillStyle = colors[node.type] || '#fff';
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fill();

    if (node.type === 'relic') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y - 8);
      ctx.lineTo(node.x + 6, node.y + 8);
      ctx.lineTo(node.x - 6, node.y + 8);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  if (state.hitFlash > 0) {
    ctx.fillStyle = '#ff6a7a';
    state.hitFlash -= 1 / 60;
  } else {
    ctx.fillStyle = '#f5f5f5';
  }

  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#5ac5ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(player.lookX * 18, player.lookY * 18);
  ctx.stroke();

  ctx.restore();
}

function drawEnemies() {
  for (const enemy of world.enemies) {
    if (enemy.hp <= 0 || enemy.x < -1000) continue;

    ctx.fillStyle = enemy.type === 'alpha' ? '#ee6d5e' : enemy.type === 'raptor' ? '#eb9e6d' : '#d66285';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillRect(enemy.x - 16, enemy.y - enemy.radius - 12, 32, 5);
    ctx.fillStyle = '#59e38d';
    ctx.fillRect(enemy.x - 16, enemy.y - enemy.radius - 12, (enemy.hp / 70) * 32, 5);
  }
}

function drawCampfire() {
  if (!world.campfire) return;
  ctx.fillStyle = world.night ? '#ff9d4d' : '#d0712d';
  ctx.beginPath();
  ctx.arc(200, 190, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawLighting() {
  if (!world.night) return;
  const glow = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 220);
  glow.addColorStop(0, 'rgba(255, 200, 120, 0.65)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawHudText() {
  const stage = world.night ? 'Noite' : 'Amanhecer';
  ctx.fillStyle = 'rgba(10, 15, 22, 0.8)';
  ctx.fillRect(15, 15, 180, 40);
  ctx.fillStyle = '#edf6ff';
  ctx.font = '18px Arial';
  ctx.fillText(`Fase: ${stage}`, 25, 40);

  ctx.fillStyle = 'rgba(10, 15, 22, 0.8)';
  ctx.fillRect(canvas.width - 220, 15, 200, 40);
  ctx.fillStyle = '#edf6ff';
  ctx.fillText(`Relíquias: ${world.relics}/3`, canvas.width - 200, 40);
}

function loop(timestamp) {
  const dt = Math.min(0.033, (timestamp - (loop.lastTimestamp || timestamp)) / 1000);
  loop.lastTimestamp = timestamp;

  updatePlayer(dt);
  updateWorld(dt);
  tickEnemies(dt);

  drawBackground();
  drawCampfire();
  drawResourceNodes();
  drawEnemies();
  drawPlayer();
  drawLighting();
  drawHudText();

  const near = nearbyResource();
  if (near) {
    hudMessage.textContent = `Próximo de ${labelFor(near.type)}. Pressione E para coletar.`;
  }

  renderStats();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  state.keys[key] = true;

  if (key === 'e') {
    gatherNearbyResource();
  }

  if (key === ' ') {
    event.preventDefault();
    state.keys[' '] = true;
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  delete state.keys[key];
  if (key === ' ') {
    delete state.keys[' '];
  }
});

document.querySelectorAll('.craft-btn').forEach((button) => {
  button.addEventListener('click', () => {
    craftRecipe(button.dataset.recipe);
  });
});

seedWorld();
renderStats();
hudMessage.textContent = 'Você acorda na cápsula de fuga de um planeta-prisão.';
requestAnimationFrame(loop);
