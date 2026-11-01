import { TIERS, WORLD } from "./config.js";

const FONT = 'ui-sans-serif, "Segoe UI", sans-serif, "ZCOOL KuaiLe", "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "WenQuanYi Micro Hei"';

export function drawFrame(ctx, state, time) {
  const { width, height } = WORLD;

  ctx.clearRect(0, 0, width, height);
  drawJar(ctx, state);
  drawGuide(ctx, state);
  drawBalls(ctx, state, time);
  drawGlass(ctx, state);
  drawHeld(ctx, state, time);
  drawBits(ctx, state);
}

export function drawBall(ctx, x, y, r, tier, time, spin = 0, pop = 0, seed = 0) {
  const info = TIERS[tier];
  const scale = 1 + 0.16 * pop;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin + (tier >= 7 ? Math.sin(time * 3 + seed) * 0.08 : 0));
  ctx.scale(scale, scale);

  ctx.shadowColor = "rgba(40, 18, 8, 0.35)";
  ctx.shadowBlur = Math.max(6, r * 0.25);
  ctx.shadowOffsetY = Math.max(3, r * 0.08);

  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.42, r * 0.15, 0, 0, r);
  body.addColorStop(0, mix(info.color, "#ffffff", 0.55));
  body.addColorStop(0.55, info.color);
  body.addColorStop(1, mix(info.color, "#1a120c", 0.28));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();

  drawFace(ctx, r, tier, info, time, seed);
  if (r >= 36) {
    ctx.fillStyle = info.ink;
    ctx.font = `700 ${Math.max(11, Math.floor(r * 0.28))}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(info.short, 0, r * 0.5);
  }
  ctx.restore();
}

function drawFace(ctx, r, tier, info, time, seed) {
  const eyeX = r * 0.28;
  const eyeY = -r * 0.08;
  const eyeR = Math.max(1.7, r * 0.075);
  ctx.fillStyle = info.ink;
  ctx.strokeStyle = info.ink;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.6, r * 0.055);

  if (tier <= 5) {
    ctx.save();
    ctx.fillStyle = "rgba(255, 80, 70, 0.28)";
    ctx.beginPath();
    ctx.ellipse(-eyeX * 1.2, eyeY + eyeR * 2.4, eyeR * 1.15, eyeR * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeX * 1.2, eyeY + eyeR * 2.4, eyeR * 1.15, eyeR * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (info.face === "spiral") {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * eyeX, eyeY, eyeR * 1.5, time * 4 + seed, time * 4 + seed + 4.2);
      ctx.stroke();
    }
  } else if (info.face === "star" || info.face === "sun") {
    drawStar(ctx, -eyeX, eyeY, eyeR * 2.1, info.ink);
    drawStar(ctx, eyeX, eyeY, eyeR * 2.1, info.ink);
  } else if (info.face === "glasses") {
    ctx.beginPath();
    ctx.arc(-eyeX, eyeY, eyeR * 1.7, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, eyeR * 1.7, 0, Math.PI * 2);
    ctx.moveTo(-eyeX + eyeR * 1.7, eyeY);
    ctx.lineTo(eyeX - eyeR * 1.7, eyeY);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  if (info.face === "brow") {
    ctx.beginPath();
    ctx.moveTo(eyeX - eyeR * 1.4, eyeY - eyeR * 2.1);
    ctx.lineTo(eyeX + eyeR * 1.6, eyeY - eyeR * 2.8);
    ctx.stroke();
  }
  if (info.face === "sweat") {
    ctx.beginPath();
    ctx.ellipse(eyeX * 1.7, eyeY - eyeR, eyeR * 0.45, eyeR * 0.7, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (info.face === "halo") {
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.72, r * 0.34, r * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (info.face === "sun") {
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 7; i += 1) {
      const a = time * 1.4 + i * ((Math.PI * 2) / 7);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
      ctx.lineTo(Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08);
      ctx.stroke();
    }
    ctx.restore();
  }

  const mouthY = r * 0.16;
  const mouthW = r * 0.32;
  ctx.beginPath();
  if (info.face === "dot") {
    ctx.arc(0, mouthY, Math.max(1.4, r * 0.06), 0, Math.PI * 2);
    ctx.fill();
  } else if (info.face === "smile" || info.face === "halo" || info.face === "glasses") {
    ctx.arc(0, mouthY - r * 0.02, mouthW * 0.7, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (info.face === "grin" || info.face === "smirk" || info.face === "sweat" || info.face === "brow") {
    ctx.arc(0, mouthY - r * 0.06, mouthW, 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else if (info.face === "sun") {
    ctx.arc(0, mouthY, mouthW * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.moveTo(-mouthW, mouthY);
    ctx.quadraticCurveTo(0, mouthY + r * 0.22, mouthW, mouthY);
    ctx.stroke();
  }
}

function drawStar(ctx, x, y, radius, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + i * (Math.PI / 5);
    const len = i % 2 === 0 ? radius : radius * 0.45;
    const px = Math.cos(angle) * len;
    const py = Math.sin(angle) * len;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawJar(ctx, state) {
  const { jar } = state.metrics;
  const top = jar.y + 16;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(jar.x + jar.w / 2, jar.y + jar.h - 6, jar.w * 0.42, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  roundRect(ctx, jar.x, top, jar.w, jar.h - 16, 26);
  const fill = ctx.createLinearGradient(0, top, 0, jar.y + jar.h);
  fill.addColorStop(0, "#5a4636");
  fill.addColorStop(0.2, "#3c2e24");
  fill.addColorStop(1, "#241910");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  roundRect(ctx, jar.x, jar.y, jar.w, jar.h, 28);
  ctx.clip();
  const danger = state.overflow / state.overflowLimit;
  if (danger > 0) {
    ctx.fillStyle = `rgba(255, 70, 48, ${0.12 + danger * 0.38})`;
    ctx.fillRect(jar.x, jar.y, jar.w, state.metrics.line - jar.y + 8);
  }
  ctx.restore();
}

function drawGuide(ctx, state) {
  if (state.mode !== "play" || !state.held) return;
  const { held, metrics } = state;
  ctx.save();
  ctx.strokeStyle = "rgba(243, 234, 219, 0.28)";
  ctx.setLineDash([3, 7]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(held.x, held.y + held.r + 4);
  ctx.lineTo(held.x, metrics.bottom - 8);
  ctx.stroke();
  ctx.restore();
}

function drawBalls(ctx, state, time) {
  const { jar } = state.metrics;
  ctx.save();
  ctx.beginPath();
  ctx.rect(jar.x - 8, jar.y - 80, jar.w + 16, jar.h + 100);
  ctx.clip();
  const ordered = state.balls.slice().sort((a, b) => a.y - b.y);
  const matchTier = state.mode === "play" && state.held ? state.held.tier : -1;
  for (const ball of ordered) {
    drawBall(ctx, ball.x, ball.y, ball.r, ball.tier, time, ball.spin, ball.pop, ball.seed);
    if (ball.tier === matchTier) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 236, 210, ${0.35 + Math.sin(time * 6) * 0.25})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawGlass(ctx, state) {
  const { jar, line } = state.metrics;
  const lip = jar.y + 16;
  const radius = 26;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 228, 196, 0.78)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(jar.x, lip);
  ctx.lineTo(jar.x, jar.y + jar.h - radius);
  ctx.arcTo(jar.x, jar.y + jar.h, jar.x + radius, jar.y + jar.h, radius);
  ctx.lineTo(jar.x + jar.w - radius, jar.y + jar.h);
  ctx.arcTo(jar.x + jar.w, jar.y + jar.h, jar.x + jar.w, jar.y + jar.h - radius, radius);
  ctx.lineTo(jar.x + jar.w, lip);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 244, 220, 0.95)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(jar.x - 10, lip);
  ctx.lineTo(jar.x + jar.w + 10, lip);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(jar.x + 14, lip + 28);
  ctx.lineTo(jar.x + 14, jar.y + jar.h - 40);
  ctx.stroke();

  const hot = state.overflow > 0.05;
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = hot ? "rgba(255, 90, 60, 0.95)" : "rgba(240, 180, 70, 0.8)";
  ctx.beginPath();
  ctx.moveTo(jar.x + 18, line);
  ctx.lineTo(jar.x + jar.w - 18, line);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = hot ? "#fff8f5" : "rgba(243, 220, 180, 0.86)";
  ctx.fillText(hot ? "上下文要爆了" : "上下文上限", jar.x + 20, line - 6);

  if (state.mode === "play" && state.drops < 1) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(243, 234, 219, 0.78)";
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText("点按投放", jar.x + jar.w / 2, jar.y + jar.h * 0.46);
  }
  ctx.restore();
}

function drawHeld(ctx, state, time) {
  if (state.mode !== "play" || !state.held) return;
  const { held } = state;
  ctx.save();
  ctx.globalAlpha = held.ready ? 1 : 0.5;
  const pop = held.ready ? 0 : -0.2;
  drawBall(ctx, held.x, held.y, held.r, held.tier, time, 0, pop, 1);
  ctx.restore();
}

function drawBits(ctx, state) {
  for (const bit of state.particles) {
    const t = bit.age / bit.life;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = bit.color;
    ctx.beginPath();
    ctx.arc(bit.x, bit.y, bit.r * (1 - t * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 18px ${FONT}`;
  ctx.lineWidth = 4;
  for (const note of state.floaters) {
    const t = note.age / note.life;
    ctx.globalAlpha = Math.max(0, 1 - t * t);
    ctx.strokeStyle = "rgba(20, 12, 8, 0.72)";
    ctx.strokeText(note.text, note.x, note.y);
    ctx.fillStyle = note.color;
    ctx.fillText(note.text, note.x, note.y);
  }
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mix(hex, other, t) {
  const a = rgb(hex);
  const b = rgb(other);
  const channel = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function rgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
