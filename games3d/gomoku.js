/**
 * 五目並べの3D表示 — 脚付きの榧の碁盤と、蛤・那智黒風の碁石。
 * 2D盤面: .gomoku-board-frame / #gomoku-grid > .gom-cell > .gom-piece(.b|.w)
 */
(function () {
  const N = 11;
  const STEP = 0.8;
  const BOARD = 9.6;
  const THICK = 0.9;
  const STONE_R = 0.36;
  const STONE_H = 0.19;

  window.BoardArena3D.registerAdapter('gomoku', (THREE, container, api) => {
    const frameEl = container.querySelector('.gomoku-board-frame');
    const gridEl = container.querySelector('#gomoku-grid');
    if (!frameEl || !gridEl) return null;

    const st = api.createStage(THREE, frameEl, {
      radius: 14.2, phi: 0.7, lookY: -0.3, extent: 5.6, tableY: -THICK - 0.42
    });
    const { kit, geo, root, markers } = st;

    // ---- 碁盤 ----
    const boardMat = kit.wood('kaya', { repeat: 0.1, vertical: true, clearcoat: 0.25, roughness: 0.5 });
    const block = new THREE.Mesh(geo.slab(BOARD, BOARD, THICK, { bevel: 0.05, radius: 0.08 }), boardMat);
    block.position.y = -THICK / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    root.add(block);

    // 脚 (くちなし型を簡略化)
    const legGeo = geo.cached('gomoku-leg', () => geo.lathe([
      [0, -0.42], [0.36, -0.42], [0.4, -0.36], [0.42, -0.2], [0.34, -0.06], [0.26, 0], [0, 0]
    ], 32));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const leg = new THREE.Mesh(legGeo, boardMat);
      leg.position.set(sx * (BOARD / 2 - 1.1), -THICK, sz * (BOARD / 2 - 1.1));
      leg.castShadow = true;
      root.add(leg);
    });

    const span = (N - 1) * STEP;
    const surfaceCanvas = api.canvas.cached('gomoku-surface', 1024, 1024, (ctx, w, h) => {
      api.canvas.paintWood(ctx, 0, 0, w, h, api.WOODS.kaya, 31, true);
      const m = ((BOARD - span) / 2 / BOARD) * w;
      const s = w - m * 2;
      ctx.strokeStyle = 'rgba(28, 18, 10, 0.86)';
      ctx.lineWidth = 2.6;
      for (let i = 0; i < N; i++) {
        const p = m + (s * i) / (N - 1);
        ctx.beginPath();
        ctx.moveTo(p, m);
        ctx.lineTo(p, h - m);
        ctx.moveTo(m, p);
        ctx.lineTo(w - m, p);
        ctx.stroke();
      }
      ctx.lineWidth = 4.5;
      ctx.strokeRect(m, m, s, s);
      ctx.fillStyle = 'rgba(28, 18, 10, 0.9)';
      [[2, 2], [2, 8], [8, 2], [8, 8], [5, 5]].forEach(([a, b]) => {
        ctx.beginPath();
        ctx.arc(m + (s * a) / (N - 1), m + (s * b) / (N - 1), 7, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD - 0.1, BOARD - 0.1).rotateX(-Math.PI / 2),
      new THREE.MeshPhysicalMaterial({
        map: kit.texture(surfaceCanvas),
        roughness: 0.5,
        clearcoat: 0.25,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.8
      })
    );
    surface.position.y = 0.002;
    surface.receiveShadow = true;
    root.add(surface);

    // ---- 碁石 ----
    const stoneGeo = geo.cached('gomoku-stone', () => geo.lens(STONE_R, STONE_H, 56));
    const blackMat = kit.lacquer('#141414', { roughness: 0.55, clearcoat: 0.2 });
    const whiteMat = kit.lacquer('#e6e1d5', { roughness: 0.32, clearcoat: 0.6 });

    function createStone(isBlack) {
      const holder = new THREE.Group();
      const stone = new THREE.Mesh(stoneGeo, isBlack ? blackMat : whiteMat);
      stone.castShadow = true;
      stone.receiveShadow = true;
      stone.position.y = STONE_H / 2;
      stone.rotation.y = Math.random() * Math.PI;
      const shadow = markers.contact(STONE_R * 2.4, STONE_R * 2.4, 0.5);
      shadow.position.y = 0.004;
      holder.add(shadow, stone);
      holder.userData.stone = stone;
      return holder;
    }

    const pos = (r, c) => ({ x: (c - (N - 1) / 2) * STEP, z: (r - (N - 1) / 2) * STEP });

    // ---- 印 ----
    const hoverRing = markers.ring(0.28, 0.33, '#1c120a', 0.55);
    hoverRing.visible = false;
    root.add(hoverRing);
    const lastMark = markers.dot(0.07, '#c0392b', 0.95);
    lastMark.visible = false;
    root.add(lastMark);

    let state = new Array(N * N).fill(null);
    const cells = () => gridEl.querySelectorAll('.gom-cell');
    const isEmpty = (r, c) => !state[r * N + c];

    const picker = st.gridPicker({
      rows: N,
      cols: N,
      step: STEP,
      y: 0.01,
      clickable: isEmpty,
      onHover: (r, c) => {
        hoverRing.visible = isEmpty(r, c);
        const p = pos(r, c);
        hoverRing.position.set(p.x, 0.006, p.z);
      },
      onLeave: () => { hoverRing.visible = false; },
      onClick: (r, c) => {
        const cell = cells()[r * N + c];
        if (cell) cell.click();
      }
    });

    // ---- 同期 ----
    const stones = new Array(N * N).fill(null);
    let first = true;

    function sync() {
      const list = cells();
      if (list.length < N * N) return;
      const next = [];
      list.forEach((cell, i) => {
        const p = cell.querySelector('.gom-piece');
        next[i] = p ? (p.classList.contains('b') ? 'b' : 'w') : null;
      });

      const placed = [];
      next.forEach((color, i) => {
        if (color !== state[i] && stones[i]) {
          st.removeObject(stones[i]);
          stones[i] = null;
        }
        if (color && !stones[i]) {
          const r = Math.floor(i / N);
          const c = i % N;
          const p = pos(r, c);
          const holder = createStone(color === 'b');
          holder.position.set(p.x, 0, p.z);
          root.add(holder);
          stones[i] = holder;
          placed.push(i);
          if (!first) {
            const s = holder.userData.stone;
            s.position.y = 0.9;
            st.animate(s, { position: { y: STONE_H / 2 } }, { duration: 260, ease: 'outCubic' });
          }
        }
      });

      if (!first && placed.length === 1) {
        const p = pos(Math.floor(placed[0] / N), placed[0] % N);
        lastMark.position.set(p.x, STONE_H + 0.003, p.z);
        lastMark.visible = true;
      } else if (next.every((v) => !v)) {
        lastMark.visible = false;
      }

      state = next;
      first = false;
      const h = picker.hovered;
      hoverRing.visible = !!h && isEmpty(h.r, h.c);
    }

    sync();
    return { st, sync };
  });
})();
