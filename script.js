document.getElementById("partner").addEventListener("click", () => {
  window.location.href = "mailto:hello@linsnexus.com?subject=Partnership";
});

(() => {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  const desktopQuery = window.matchMedia("(min-width: 769px)");

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) nav.removeAttribute("hidden");
    else nav.setAttribute("hidden", "");
    document.body.style.overflow = open ? "hidden" : "";
  }

  function syncViewport() {
    if (desktopQuery.matches) {
      nav.removeAttribute("hidden");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      document.body.style.overflow = "";
    } else {
      setOpen(false);
    }
  }

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    setOpen(open);
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (!desktopQuery.matches) setOpen(false);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });

  syncViewport();
  if (desktopQuery.addEventListener) desktopQuery.addEventListener("change", syncViewport);
  else if (desktopQuery.addListener) desktopQuery.addListener(syncViewport);
})();

(() => {
  const track = document.querySelector(".brands-track");
  if (!track) return;

  const originals = Array.from(track.children);
  if (!originals.length) return;

  originals.forEach((item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  });

  const SPEED = 55; // px per second
  let offset = 0;
  let loopWidth = 0;
  let last = performance.now();

  function measure() {
    loopWidth = track.scrollWidth / 2;
  }

  measure();
  window.addEventListener("resize", () => {
    const prev = loopWidth;
    measure();
    if (prev > 0 && loopWidth > 0) offset = (offset / prev) * loopWidth;
  });
  track.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", measure, { once: true });
  });
  // Layout can settle after fonts/images.
  setTimeout(measure, 100);
  setTimeout(measure, 500);

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (loopWidth < 1) measure();

    if (loopWidth > 1) {
      offset += SPEED * dt;
      while (offset >= loopWidth) offset -= loopWidth;
      track.style.transform = "translate3d(" + -offset.toFixed(2) + "px,0,0)";
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

(() => {
  const root = document.querySelector(".testimonials");
  if (!root) return;

  const track = root.querySelector(".testimonials-track");
  const slides = Array.from(root.querySelectorAll(".testimonial"));
  const prevBtn = document.getElementById("testimonial-prev");
  const nextBtn = document.getElementById("testimonial-next");
  const dotsWrap = root.querySelector(".testimonials-dots");
  if (!track || !slides.length || !prevBtn || !nextBtn || !dotsWrap) return;

  const AUTO_MS = 5000;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileQuery = window.matchMedia("(max-width: 768px)");

  let index = 0;
  let startX = 0;
  let deltaX = 0;
  let dragging = false;
  let autoTimer = 0;
  let visible = 3;

  // Clone slides so we can loop while showing multiple at once.
  slides.forEach((slide) => {
    const clone = slide.cloneNode(true);
    clone.removeAttribute("data-index");
    clone.classList.remove("is-active");
    clone.setAttribute("inert", "");
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  });

  function syncVisible() {
    visible = mobileQuery.matches ? 1 : Math.min(3, slides.length);
    root.style.setProperty("--testimonial-visible", String(visible));
  }

  function slidePct() {
    return 100 / visible;
  }

  function setTransform(i, animate) {
    if (!animate) track.style.transition = "none";
    track.style.transform = `translateX(-${i * slidePct()}%)`;
    if (!animate) {
      // Force reflow so the next transition works.
      void track.offsetWidth;
      track.style.transition = "";
    }
  }

  const dots = slides.map((_, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "testimonials-dot";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-label", `Show testimonial set ${i + 1}`);
    btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
    btn.addEventListener("click", () => {
      goTo(i);
      restartAuto();
    });
    dotsWrap.appendChild(btn);
    return btn;
  });

  function updateActive() {
    const real = ((index % slides.length) + slides.length) % slides.length;
    const activeSet = new Set();
    for (let k = 0; k < visible; k++) {
      activeSet.add((real + k) % slides.length);
    }
    slides.forEach((slide, i) => {
      const active = activeSet.has(i);
      slide.classList.toggle("is-active", active);
      if (active) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });
    dots.forEach((dot, i) => {
      dot.setAttribute("aria-selected", i === real ? "true" : "false");
    });
  }

  function goTo(next, animate = true) {
    index = next;
    setTransform(index, animate);
    updateActive();
  }

  function advance(delta) {
    if (delta < 0 && index === 0) {
      // Jump to the cloned tail, then step back one for a seamless loop.
      goTo(slides.length, false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => goTo(slides.length - 1, true));
      });
      return;
    }
    goTo(index + delta, true);
  }

  function onTransitionEnd() {
    if (index >= slides.length) {
      goTo(index - slides.length, false);
    } else if (index < 0) {
      goTo(index + slides.length, false);
    }
  }

  track.addEventListener("transitionend", (e) => {
    if (e.target !== track || e.propertyName !== "transform") return;
    onTransitionEnd();
  });

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = 0;
    }
  }

  function startAuto() {
    stopAuto();
    if (reduceMotion || slides.length <= 1) return;
    autoTimer = window.setInterval(() => advance(1), AUTO_MS);
  }

  function restartAuto() {
    stopAuto();
    startAuto();
  }

  prevBtn.addEventListener("click", () => {
    advance(-1);
    restartAuto();
  });
  nextBtn.addEventListener("click", () => {
    advance(1);
    restartAuto();
  });

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      advance(-1);
      restartAuto();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      advance(1);
      restartAuto();
    }
  });

  root.addEventListener("mouseenter", stopAuto);
  root.addEventListener("mouseleave", startAuto);
  root.addEventListener("focusin", stopAuto);
  root.addEventListener("focusout", (e) => {
    if (!root.contains(e.relatedTarget)) startAuto();
  });

  track.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      stopAuto();
      startX = e.clientX;
      deltaX = 0;
      track.setPointerCapture(e.pointerId);
      track.style.transition = "none";
    },
    { passive: true }
  );

  track.addEventListener(
    "pointermove",
    (e) => {
      if (!dragging) return;
      deltaX = e.clientX - startX;
      const width = track.clientWidth || 1;
      const offset = -index * slidePct() + (deltaX / width) * slidePct();
      track.style.transform = `translateX(${offset}%)`;
    },
    { passive: true }
  );

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    track.style.transition = "";
    const threshold = Math.min(80, (track.clientWidth || 320) * 0.18);
    if (deltaX > threshold) advance(-1);
    else if (deltaX < -threshold) advance(1);
    else goTo(index);
    restartAuto();
    try {
      track.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  function onResize() {
    syncVisible();
    goTo(((index % slides.length) + slides.length) % slides.length, false);
    restartAuto();
  }

  syncVisible();
  goTo(0, false);
  startAuto();

  window.addEventListener("resize", onResize);
  if (mobileQuery.addEventListener) mobileQuery.addEventListener("change", onResize);
  else if (mobileQuery.addListener) mobileQuery.addListener(onResize);
})();

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
  const TEXT_SELECTORS = ".tagline, .subhead";

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
