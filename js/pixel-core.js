export const TILE = 16;
export const VIEW_W = 320;
export const VIEW_H = 180;

const GRAVITY = 1450;
const JUMP_V = 440;
const RUN = 132;
const ACCEL = 980;
const FRICTION = 1500;
const MAX_FALL = 720;
const COYOTE = 0.1;
const BUFFER = 0.12;
const STOMP_V = -260;

export function createWorld(level) {
  const rows = level.rows;
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const solid = new Set();
  const spikes = [];
  const coins = [];
  const enemies = [];
  const markers = [];
  let spawn = { x: 32, y: 32 };
  let flag = { x: 64, y: 32, w: TILE, h: TILE };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const ch = rows[y][x] || ".";
      const px = x * TILE;
      const py = y * TILE;
      if (ch === "#") solid.add(`${x},${y}`);
      else if (ch === "^") spikes.push({ x: px + 3, y: py + 4, w: 10, h: 12 });
      else if (ch === "o") coins.push({ x: px + 4, y: py + 4, w: 8, h: 8, taken: false });
      else if (ch === "P") spawn = { x: px + 2, y: py + TILE - 14 };
      else if (ch === "F") flag = { x: px, y: py, w: TILE, h: TILE };
      else if (ch === "E") enemies.push({ x: px + 2, y: py + TILE - 12, w: 12, h: 12, vx: 42, alive: true });
      else if (ch === "M") markers.push({ x, y, px, py });
    }
  }

  const platforms = markers.map((mark) => {
    const span = TILE * 3;
    let dest = mark.x + 1;
    while (dest < width && !solid.has(`${dest},${mark.y}`)) dest += 1;
    const dock = dest < width ? dest * TILE - span : mark.px + TILE * 5;
    return {
      x: mark.px,
      y: mark.py,
      w: span,
      h: TILE,
      minX: mark.px,
      maxX: Math.max(mark.px, dock),
      vx: 46,
    };
  });

  return {
    name: level.name,
    w: width,
    h: height,
    solid,
    spikes,
    coins,
    enemies,
    platforms,
    flag,
    player: {
      x: spawn.x,
      y: spawn.y,
      w: 12,
      h: 14,
      vx: 0,
      vy: 0,
      onGround: false,
      coyote: COYOTE,
      buffer: 0,
      facing: 1,
    },
    rideId: null,
    dead: false,
    won: false,
    time: 0,
  };
}

export function solidAt(solid, x, y) {
  return solid.has(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
}

export function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function coinCount(world) {
  return world.coins.filter((coin) => coin.taken).length;
}

function tilesTouching(solid, box) {
  const x0 = Math.floor(box.x / TILE);
  const x1 = Math.floor((box.x + box.w - 0.001) / TILE);
  const y0 = Math.floor(box.y / TILE);
  const y1 = Math.floor((box.y + box.h - 0.001) / TILE);
  const tiles = [];
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (solid.has(`${tx},${ty}`)) tiles.push({ x: tx * TILE, y: ty * TILE });
    }
  }
  return tiles;
}

function movePlatforms(world, dt) {
  const prev = world.platforms.map((platform) => platform.x);
  for (const platform of world.platforms) {
    platform.x += platform.vx * dt;
    if (platform.x <= platform.minX) {
      platform.x = platform.minX;
      platform.vx = Math.abs(platform.vx);
    } else if (platform.x >= platform.maxX) {
      platform.x = platform.maxX;
      platform.vx = -Math.abs(platform.vx);
    }
  }
  return prev;
}

function moveEnemies(world, dt) {
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    const speed = Math.abs(enemy.vx) || 42;
    const dir = enemy.vx < 0 ? -1 : 1;
    const probeX = dir > 0 ? enemy.x + enemy.w + 1 : enemy.x - 1;
    const aheadWall = probeX < 0 || solidAt(world.solid, probeX, enemy.y + 4);
    const aheadFloor = solidAt(world.solid, probeX, enemy.y + enemy.h + 2);
    if (aheadWall || !aheadFloor) enemy.vx = -dir * speed;
    enemy.x += enemy.vx * dt;
  }
}

export function step(world, input, dt) {
  if (world.dead || world.won) return world;
  const stepDt = Math.min(Math.max(0, dt), 1 / 50);
  const player = world.player;
  world.time += stepDt;

  if (input.left && !input.right) player.facing = -1;
  if (input.right && !input.left) player.facing = 1;
  if (input.left) player.vx -= ACCEL * stepDt;
  if (input.right) player.vx += ACCEL * stepDt;
  if (!input.left && !input.right) {
    const sign = Math.sign(player.vx);
    if (sign !== 0) {
      player.vx -= sign * FRICTION * stepDt;
      if (Math.sign(player.vx) !== sign) player.vx = 0;
    }
  }
  player.vx = Math.max(-RUN, Math.min(RUN, player.vx));

  player.buffer = input.jumpPressed ? BUFFER : Math.max(0, player.buffer - stepDt);
  if (player.onGround) player.coyote = COYOTE;
  else player.coyote = Math.max(0, player.coyote - stepDt);

  let jumped = false;
  if (player.buffer > 0 && (player.onGround || player.coyote > 0)) {
    player.vy = -JUMP_V;
    player.buffer = 0;
    player.coyote = 0;
    player.onGround = false;
    world.rideId = null;
    jumped = true;
  } else if (!input.jump && player.vy < -40) {
    player.vy *= 0.5;
  }

  const prev = movePlatforms(world, stepDt);
  if (!jumped && world.rideId != null) player.x += world.platforms[world.rideId].x - prev[world.rideId];

  player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * stepDt);
  player.x += player.vx * stepDt;
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
  let bumped = tilesTouching(world.solid, player);
  if (bumped.length) {
    const pushLeft = player.vx > 0;
    player.x = pushLeft
      ? Math.min(...bumped.map((tile) => tile.x)) - player.w
      : Math.max(...bumped.map((tile) => tile.x + TILE));
    player.vx = 0;
  }

  player.y += player.vy * stepDt;
  player.onGround = false;
  bumped = tilesTouching(world.solid, player);
  if (bumped.length) {
    if (player.vy >= 0) {
      player.y = Math.min(...bumped.map((tile) => tile.y)) - player.h;
      player.onGround = true;
    } else {
      player.y = Math.max(...bumped.map((tile) => tile.y + TILE));
    }
    player.vy = 0;
  }

  world.rideId = null;
  if (!player.onGround && player.vy >= 0) {
    for (let i = 0; i < world.platforms.length; i += 1) {
      const platform = world.platforms[i];
      const feet = player.y + player.h;
      const across = player.x + player.w > platform.x + 2 && player.x < platform.x + platform.w - 2;
      if (across && feet >= platform.y && feet <= platform.y + 16) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
        world.rideId = i;
        break;
      }
    }
  }

  moveEnemies(world, stepDt);

  if (player.y > world.h * TILE) {
    world.dead = true;
    return world;
  }
  if (world.spikes.some((spike) => overlap(player, spike))) {
    world.dead = true;
    return world;
  }
  for (const coin of world.coins) {
    if (!coin.taken && overlap(player, coin)) coin.taken = true;
  }
  for (const enemy of world.enemies) {
    if (!enemy.alive || !overlap(player, enemy)) continue;
    const fromAbove = player.vy > 0 && player.y < enemy.y;
    if (fromAbove) {
      enemy.alive = false;
      player.vy = STOMP_V;
      player.onGround = false;
      world.rideId = null;
    } else {
      world.dead = true;
      return world;
    }
  }
  if (overlap(player, world.flag)) world.won = true;
  return world;
}

export function cameraFor(world) {
  const mapW = world.w * TILE;
  const mapH = world.h * TILE;
  let x = world.player.x + world.player.w / 2 - VIEW_W * 0.38;
  let y = world.player.y + world.player.h / 2 - VIEW_H * 0.62;
  if (mapW <= VIEW_W) x = (mapW - VIEW_W) / 2;
  else x = Math.max(0, Math.min(mapW - VIEW_W, x));
  if (mapH <= VIEW_H) y = (mapH - VIEW_H) / 2;
  else y = Math.max(0, Math.min(mapH - VIEW_H, y));
  return { x: Math.round(x), y: Math.round(y) };
}
