(() => {
  if (typeof THREE === "undefined") return;

  // Deep vanishing point at the center of this section's 3D space.
  const VANISH = new THREE.Vector3(0, 0, -22);
  const CUBE_SIZE = 1.15;
  const AMPLITUDE = 2.8;
  const OSCILLATION_SPEED = 0.7;

  const LOGO_PAD = 0.16; // fraction of face inset on each side

  // Rest positions in world space. Each cube lives on the ray
  // from VANISH through this point, and only slides along that ray.
  const PLATFORMS = [
    {
      id: "youtube",
      color: 0xff0000,
      logo: "youtube",
      pos: [-3.6, 2.35, -0.4],
      phase: 0.2,
    },
    {
      id: "instagram",
      color: 0xe1306c,
      logo: "instagram",
      pos: [3.7, 2.15, 0.2],
      phase: 1.1,
    },
    {
      id: "tiktok",
      color: 0x010101,
      logo: "tiktok",
      pos: [-4.2, 0.15, -1.8],
      phase: 2.0,
    },
    {
      id: "x",
      color: 0x000000,
      logo: "x",
      pos: [4.3, 0.4, -1.1],
      phase: 0.7,
    },
    {
      id: "appstore",
      color: 0x0a84ff,
      logo: "appstore",
      pos: [-3.4, -2.3, 0.1],
      phase: 1.6,
    },
    {
      id: "playstore",
      color: 0x34a853,
      logo: "playstore",
      pos: [3.5, -2.15, -1.5],
      phase: 2.5,
    },
    {
      id: "web",
      color: 0x2563eb,
      logo: null,
      pos: [-1.7, 2.7, -2.6],
      phase: 0.4,
    },
    {
      id: "substack",
      color: 0x6b7280,
      logo: "substack",
      pos: [1.8, 2.6, -2.2],
      phase: 1.9,
    },
    {
      id: "luma",
      color: 0xffffff,
      logo: "luma",
      pos: [0.2, -2.7, -0.8],
      phase: 2.9,
    },
  ];

  function colorToCss(hex) {
    return "#" + hex.toString(16).padStart(6, "0");
  }

  function darkenColor(hex, factor) {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Near-black cubes can't go darker visibly — lift slightly so edges still read.
    if (luma < 28) return 0x3f3f3f;
    const t = Math.max(0, Math.min(1, factor));
    return (
      (Math.round(r * t) << 16) |
      (Math.round(g * t) << 8) |
      Math.round(b * t)
    );
  }

  function makeGlobeTexture() {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#2563EB";
    ctx.fillRect(0, 0, size, size);

    const inset = size * LOGO_PAD;
    const draw = size - inset * 2;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = draw * 0.07;
    ctx.lineCap = "round";
    const r = draw * 0.28;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.45, r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(-r * 0.85, -r * 0.5);
    ctx.lineTo(r * 0.85, -r * 0.5);
    ctx.moveTo(-r * 0.85, r * 0.5);
    ctx.lineTo(r * 0.85, r * 0.5);
    ctx.stroke();
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function prepareTexture(tex) {
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }

  function makePaddedLogoTexture(img, brandColor) {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = colorToCss(brandColor);
    ctx.fillRect(0, 0, size, size);

    const pad = size * LOGO_PAD;
    const maxW = size - pad * 2;
    const maxH = size - pad * 2;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    return prepareTexture(new THREE.CanvasTexture(canvas));
  }

  function loadLogoTexture(key, brandColor) {
    return new Promise((resolve, reject) => {
      const data = window.LOGO_DATA && window.LOGO_DATA[key];
      if (!data) {
        reject(new Error("Missing logo data for " + key));
        return;
      }
      const img = new Image();
      img.onload = () => resolve(makePaddedLogoTexture(img, brandColor));
      img.onerror = () => reject(new Error("Failed to decode logo " + key));
      img.src = data;
    });
  }

  // Outward unit vector along the vanish → cube ray, plus rest distance.
  function rayFromVanish(restPos, outDir) {
    outDir.subVectors(restPos, VANISH);
    const distance = outDir.length();
    outDir.multiplyScalar(1 / Math.max(distance, 0.0001));
    return distance;
  }

  // Keep one face perfectly perpendicular to the vanish→cube line.
  // For meshes (not cameras), lookAt aims local +Z at the target,
  // so +Z faces the vanish point and -Z faces the screen.
  function orientToVanish(mesh) {
    mesh.lookAt(VANISH);
  }

  function placeOnRay(mesh, dir, distance) {
    mesh.position.copy(VANISH).addScaledVector(dir, distance);
    orientToVanish(mesh);
  }

  function makeCube(platform, tex) {
    // Logo on -Z: after lookAt(VANISH), +Z points at the vanish point,
    // so -Z is the face closest to the screen / camera.
    const faceOpacity = 0.78;
    const logoMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: false,
      opacity: 1,
    });
    const sideMat = new THREE.MeshBasicMaterial({
      color: platform.color,
      transparent: true,
      opacity: faceOpacity,
      depthWrite: false,
    });
    // Box materials: +x, -x, +y, -y, +z, -z
    const materials = [
      sideMat.clone(),
      sideMat.clone(),
      sideMat.clone(),
      sideMat.clone(),
      sideMat.clone(),
      logoMat,
    ];

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
      materials
    );
    mesh.renderOrder = 1;

    const edgeMat = new THREE.LineBasicMaterial({
      color: darkenColor(platform.color, 0.45),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      linewidth: 2,
    });
    const edgeGeo = new THREE.EdgesGeometry(mesh.geometry);
    // Two slightly scaled edge passes so the border reads thicker.
    for (const s of [1.004, 1.012]) {
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      edges.scale.setScalar(s);
      edges.renderOrder = 2;
      mesh.add(edges);
    }

    const rest = new THREE.Vector3(...platform.pos);
    const dir = new THREE.Vector3();
    const restDistance = rayFromVanish(rest, dir);
    placeOnRay(mesh, dir, restDistance);

    return {
      mesh,
      rest,
      dir,
      restDistance,
      phase: platform.phase,
      baseScale: 1,
    };
  }

  const section = document.querySelector(".integrations");
  const canvas = document.getElementById("platform-cubes");
  if (!section || !canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, -8);

  let cubes = [];
  let raf = 0;
  let running = false;
  let t0 = performance.now();

  function resize() {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (w < 1 || h < 1) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const scale = Math.min(1.15, Math.max(0.72, w / 1100));
    cubes.forEach((cube, i) => {
      const p = PLATFORMS[i];
      cube.rest.set(p.pos[0] * scale, p.pos[1] * scale, p.pos[2]);
      cube.restDistance = rayFromVanish(cube.rest, cube.dir);
      cube.baseScale = scale;
      cube.mesh.scale.setScalar(scale);
      placeOnRay(cube.mesh, cube.dir, cube.restDistance);
    });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    const amp = reduceMotion ? AMPLITUDE * 0.12 : AMPLITUDE;

    for (const cube of cubes) {
      // Strict 1D travel along vanish ↔ cube only.
      // Positive = toward the screen (farther from vanish).
      const travel = Math.sin(t * OSCILLATION_SPEED + cube.phase) * amp;
      placeOnRay(cube.mesh, cube.dir, cube.restDistance + travel);
      cube.mesh.scale.setScalar(cube.baseScale);
    }

    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  Promise.all(
    PLATFORMS.map((p) =>
      p.logo
        ? loadLogoTexture(p.logo, p.color)
        : Promise.resolve(makeGlobeTexture())
    )
  ).then((textures) => {
    cubes = PLATFORMS.map((p, i) => {
      const cube = makeCube(p, textures[i]);
      scene.add(cube.mesh);
      return cube;
    });

    resize();
    window.addEventListener("resize", resize);
    start();

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) start();
            else stop();
          }
        },
        { threshold: 0.02 }
      );
      io.observe(section);
    }
  });
})();
