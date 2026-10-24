/**
 * バトルシップの3D表示 — 左右2枚の穴あきボードに、灰色の艦体と赤白のピン。
 * 2D盤面: .bs-boards-container / #my-grid, #opp-grid > .bs-cell(100) (.ship, .hit, .miss)
 *   自分の海域では被弾したマスは .ship が外れて .hit になる。
 */
(function () {
  const N = 10;
  const SP = 0.58;
  const BOARD = N * SP + 0.7;
  const GAP = 1.5;
  const CX = BOARD / 2 + GAP / 2;

  window.BoardArena3D.registerAdapter('battleship', (THREE, container, api) => {
    const boardsEl = container.querySelector('.bs-boards-container');
    const myGridEl = container.querySelector('#my-grid');
    const oppGridEl = container.querySelector('#opp-grid');
    if (!boardsEl || !myGridEl || !oppGridEl) return null;

    const st = api.createStage(THREE, boardsEl, { radius: 15.2, phi: 0.72, lookY: -0.2, extent: 7.2, tableY: -0.32 });
    const { kit, geo, root, markers } = st;

    // ---- ボード ----
    const holesCanvas = api.canvas.cached('bs-holes', 1024, 1024, (ctx, w, h) => {
      api.canvas.paintNoise(ctx, w, h, '#26384a', 8, 91, 0);
      const m = (0.35 / BOARD) * w;
      const s = (w - m * 2) / N;
      ctx.strokeStyle = 'rgba(180, 200, 220, 0.12)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= N; i++) {
        ctx.beginPath();
        ctx.moveTo(m + i * s, m);
        ctx.lineTo(m + i * s, h - m);
        ctx.moveTo(m, m + i * s);
        ctx.lineTo(w - m, m + i * s);
        ctx.stroke();
      }
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const x = m + (c + 0.5) * s;
          const y = m + (r + 0.5) * s;
          const g = ctx.createRadialGradient(x, y - 2, 1, x, y, s * 0.17);
          g.addColorStop(0, '#05080b');
          g.addColorStop(1, '#122230');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, s * 0.16, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    const trayMat = kit.lacquer('#1d2c3b', { roughness: 0.5, clearcoat: 0.3 });
    const surfaceMat = new THREE.MeshStandardMaterial({ map: kit.texture(holesCanvas), roughness: 0.55, envMapIntensity: 0.6 });
    [-1, 1].forEach((side) => {
      const tray = new THREE.Mesh(geo.slab(BOARD, BOARD, 0.3, { bevel: 0.05, radius: 0.18 }), trayMat);
      tray.position.set(side * CX, -0.15, 0);
      tray.castShadow = true;
      tray.receiveShadow = true;
      root.add(tray);
      const surface = new THREE.Mesh(new THREE.PlaneGeometry(BOARD - 0.1, BOARD - 0.1).rotateX(-Math.PI / 2), surfaceMat);
      surface.position.set(side * CX, 0.002, 0);
      surface.receiveShadow = true;
      root.add(surface);
    });

    st.label('自分の海域', { className: 'is-plain' }).at(-CX, 0, -BOARD / 2 - 0.35);
    st.label('相手の海域', { className: 'is-plain' }).at(CX, 0, -BOARD / 2 - 0.35);

    const cellPos = (cx, r, c) => ({ x: cx + (c - (N - 1) / 2) * SP, z: (r - (N - 1) / 2) * SP });

    // ---- ピン・艦体 ----
    const pegGeo = geo.cached('bs-peg', () => geo.lathe([[0, 0], [0.07, 0], [0.07, 0.2], [0.11, 0.23], [0.11, 0.27], [0.08, 0.3], [0, 0.31]], 24));
    const hitMat = kit.lacquer('#a8281f', { roughness: 0.35 });
    const missMat = kit.lacquer('#e2ddd2', { roughness: 0.4 });
    const hullMat = new THREE.MeshPhysicalMaterial({ color: kit.color('#6d757c'), roughness: 0.45, metalness: 0.35, clearcoat: 0.3, envMapIntensity: 0.9 });
    const deckMat = kit.matte('#545b61', { roughness: 0.6 });

    function hull(len, vertical) {
      const g = new THREE.Group();
      const L = len * SP - 0.12;
      const body = new THREE.Mesh(geo.slab(vertical ? 0.4 : L, vertical ? L : 0.4, 0.2, { bevel: 0.05, radius: 0.19 }), hullMat);
      body.position.y = 0.1;
      body.castShadow = true;
      body.receiveShadow = true;
      body.userData.sharedMaterial = true;
      g.add(body);
      const deckL = Math.max(0.3, L * 0.38);
      const deck = new THREE.Mesh(geo.slab(vertical ? 0.22 : deckL, vertical ? deckL : 0.22, 0.12, { bevel: 0.02, radius: 0.04 }), deckMat);
      deck.position.y = 0.26;
      deck.castShadow = true;
      g.add(deck);
      return g;
    }

    // ---- 攻撃側のホバー・クリック ----
    const hoverRing = markers.ring(0.17, 0.22, '#f4ede1', 0.85);
    hoverRing.visible = false;
    root.add(hoverRing);
    const oppCells = () => oppGridEl.querySelectorAll('.bs-cell');
    const isOpen = (r, c) => {
      const cell = oppCells()[r * N + c];
      return !!cell && !cell.classList.contains('hit') && !cell.classList.contains('miss');
    };
    const picker = st.gridPicker({
      rows: N,
      cols: N,
      step: SP,
      x: CX,
      y: 0.01,
      clickable: isOpen,
      onHover: (r, c) => {
        hoverRing.visible = isOpen(r, c);
        const p = cellPos(CX, r, c);
        hoverRing.position.set(p.x, 0.006, p.z);
      },
      onLeave: () => { hoverRing.visible = false; },
      onClick: (r, c) => {
        const cell = oppCells()[r * N + c];
        if (cell) cell.click();
      }
    });

    // ---- 同期 ----
    const shipGroup = new THREE.Group();
    root.add(shipGroup);
    let shipSig = '';
    const pegs = { my: new Map(), opp: new Map() };
    let first = true;

    function syncShips(cells) {
      const ship = cells.map((el) => el.classList.contains('ship') || el.classList.contains('hit'));
      const sig = ship.map((v) => (v ? 1 : 0)).join('');
      if (sig === shipSig) return;
      shipSig = sig;
      st.clearGroup(shipGroup);
      const used = new Array(N * N).fill(false);
      const run = (r, c, dr, dc) => {
        let n = 0;
        while (r + dr * n < N && c + dc * n < N && ship[(r + dr * n) * N + c + dc * n] && !used[(r + dr * n) * N + c + dc * n]) n++;
        return n;
      };
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          if (!ship[i] || used[i]) continue;
          const h = run(r, c, 0, 1);
          const v = run(r, c, 1, 0);
          const vertical = v > h;
          const len = Math.max(h, v);
          for (let k = 0; k < len; k++) used[(r + (vertical ? k : 0)) * N + c + (vertical ? 0 : k)] = true;
          const g = hull(len, vertical);
          const a = cellPos(-CX, r, c);
          const b = cellPos(-CX, r + (vertical ? len - 1 : 0), c + (vertical ? 0 : len - 1));
          g.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
          shipGroup.add(g);
        }
      }
    }

    function syncPegs(cells, cx, store, onShips) {
      const seen = new Set();
      cells.forEach((el, i) => {
        const type = el.classList.contains('hit') ? 'hit' : el.classList.contains('miss') ? 'miss' : null;
        if (!type) return;
        const key = `${i}:${type}`;
        seen.add(key);
        if (store.has(key)) return;
        const p = cellPos(cx, Math.floor(i / N), i % N);
        const peg = new THREE.Mesh(pegGeo, type === 'hit' ? hitMat : missMat);
        peg.castShadow = true;
        const y = onShips && type === 'hit' ? 0.3 : 0;
        peg.position.set(p.x, y, p.z);
        root.add(peg);
        store.set(key, peg);
        if (!first) {
          peg.position.y = y + 1.6;
          st.animate(peg, { position: { y } }, { duration: 420, ease: 'outBounce' });
        }
      });
      store.forEach((peg, key) => {
        if (!seen.has(key)) {
          st.removeObject(peg);
          store.delete(key);
        }
      });
    }

    function sync() {
      const my = Array.from(myGridEl.querySelectorAll('.bs-cell'));
      const opp = Array.from(oppCells());
      if (my.length < N * N || opp.length < N * N) return;
      syncShips(my);
      syncPegs(my, -CX, pegs.my, true);
      syncPegs(opp, CX, pegs.opp, false);
      const h = picker.hovered;
      hoverRing.visible = !!h && isOpen(h.r, h.c);
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
