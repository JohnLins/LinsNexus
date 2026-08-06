document.getElementById("partner").addEventListener("click", () => {
  window.location.href = "mailto:hello@linsnexus.com?subject=Partnership";
});

(() => {
  const RADIUS = 2;
  const SPAWN_RATE = 50;
  const ELASTICITY = 0.5;
  const BASE_SPEED = 420;
  const MIN_SPEED = 50;
  const SPAWN_Y_MIN = 60;
  const SPAWN_Y_MAX = 720;
  const COLOR_LEFT = "#000000";
  const COLOR_RIGHT = "red";
  const TEXT_SELECTORS = ".tagline";

  const canvas = document.getElementById("particles");
  const hero = document.querySelector(".hero");
  if (!canvas || !hero) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });

  let W = 0;
  let H = 0;
  let originX = 0;
  let originY = 0;
  let maskData = null;
  let particles = [];
  let spawnAcc = 0;
  let maskDirty = true;
  let lastTime = 0;
  let started = false;

  function syncOrigin() {
    const r = canvas.getBoundingClientRect();
    originX = r.left;
    originY = r.top;
  }

  function toLocal(rect) {
    return {
      left: rect.left - originX,
      top: rect.top - originY,
      right: rect.right - originX,
      bottom: rect.bottom - originY,
      width: rect.width,
      height: rect.height,
    };
  }

  function resize() {
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width = W;
    canvas.height = H;
    maskCanvas.width = W;
    maskCanvas.height = H;
    syncOrigin();
    maskDirty = true;
  }

  function inCanvas(local) {
    return local.bottom > 0 && local.top < H && local.right > 0 && local.left < W;
  }

  function applyFont(style) {
    maskCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    maskCtx.fillStyle = "#000";
    maskCtx.textBaseline = "alphabetic";
    maskCtx.textAlign = "left";
  }

  function paintTextNode(node) {
    const text = node.nodeValue;
    if (!text || !text.trim()) return;

    const parent = node.parentElement;
    if (!parent) return;

    const style = getComputedStyle(parent);
    if (style.visibility === "hidden" || style.display === "none") return;

    applyFont(style);

    const range = document.createRange();
    const len = text.length;

    for (let i = 0; i < len; i++) {
      const ch = text[i];
      if (ch === "\n" || ch === "\r") continue;

      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const local = toLocal(range.getBoundingClientRect());
      if (local.width < 0.25 || local.height < 0.25) continue;
      if (!inCanvas(local)) continue;

      const baseline = local.top + local.height * 0.82;
      maskCtx.fillText(ch, local.left, baseline);
    }
  }

  function paintTextElements() {
    const roots = document.querySelectorAll(TEXT_SELECTORS);
    for (const el of roots) {
      const local = toLocal(el.getBoundingClientRect());
      if (!inCanvas(local)) continue;

      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        paintTextNode(node);
      }
    }
  }

  function paintPartnerButton() {
    const btn = document.getElementById("partner");
    if (!btn) return;
    const local = toLocal(btn.getBoundingClientRect());
    if (!inCanvas(local)) return;
    maskCtx.fillStyle = "#000";
    maskCtx.fillRect(local.left, local.top, local.width, local.height);
  }

  function rebuildMask() {
    if (W < 1 || H < 1) return;
    syncOrigin();
    maskCtx.clearRect(0, 0, W, H);
    paintTextElements();
    paintPartnerButton();
    maskData = maskCtx.getImageData(0, 0, W, H);
    maskDirty = false;
  }

  function isSolid(x, y) {
    if (!maskData) return false;
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return false;
    return maskData.data[(iy * W + ix) * 4 + 3] > 32;
  }

  function overlapsSolid(px, py) {
    const r2 = RADIUS * RADIUS;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        if (isSolid(px + dx, py + dy)) return true;
      }
    }
    return false;
  }

  function sampleNormal(px, py) {
    let gx = 0;
    let gy = 0;
    const r2 = RADIUS * RADIUS;
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        if (isSolid(px + dx, py + dy)) {
          gx += dx;
          gy += dy;
        }
      }
    }
    const len = Math.hypot(gx, gy);
    if (len < 0.001) return null;
    return { x: -gx / len, y: -gy / len };
  }

  function resolveCollision(p) {
    if (!overlapsSolid(p.x, p.y)) return;

    const n = sampleNormal(p.x, p.y);
    if (!n) return;

    const vn = p.vx * n.x + p.vy * n.y;
    if (vn < 0) {
      const f = 1 + ELASTICITY;
      p.vx -= f * vn * n.x;
      p.vy -= f * vn * n.y;
    }

    for (let i = 0; i < 10 && overlapsSolid(p.x, p.y); i++) {
      p.x += n.x * 1.25;
      p.y += n.y * 1.25;
    }
  }

  function trySpawn() {
    const fromRight = Math.random() < 0.5;
    const x = fromRight ? W + RADIUS : -RADIUS;
    const y = SPAWN_Y_MIN + Math.random() * (SPAWN_Y_MAX - SPAWN_Y_MIN);
    if (y > H || overlapsSolid(x, y)) return;
    const speed = BASE_SPEED * (0.85 + Math.random() * 0.3);
    const drift = (Math.random() - 0.5) * speed * 0.15;
    particles.push({
      x,
      y,
      vx: fromRight ? -speed : speed,
      vy: drift,
      color: fromRight ? COLOR_RIGHT : COLOR_LEFT,
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    if (maskDirty) rebuildMask();

    spawnAcc += SPAWN_RATE * dt;
    while (spawnAcc >= 1) {
      trySpawn();
      spawnAcc -= 1;
    }

    ctx.clearRect(0, 0, W, H);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      resolveCollision(p);

      const speed = Math.hypot(p.vx, p.vy);
      if (
        speed < MIN_SPEED ||
        p.x < -RADIUS ||
        p.y < -RADIUS ||
        p.x > W + RADIUS ||
        p.y > H + RADIUS
      ) {
        particles.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  function start() {
    if (started) return;
    started = true;
    resize();
    rebuildMask();
    lastTime = performance.now();
    for (let i = 0; i < 8; i++) trySpawn();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  start();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      maskDirty = true;
    });
  }

  setTimeout(() => {
    maskDirty = true;
  }, 1200);
})();
