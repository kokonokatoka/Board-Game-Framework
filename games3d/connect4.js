/**
 * コネクトフォーの3D表示 — 穴あきの木製スタンドに、赤と黄のコインを落とす。
 * 2D盤面: .c4-board-frame / #c4-board > .c4-cell(42) > .c4-coin(.p1|.p2, .win)
 *         #c4-drop-guide > .c4-drop-preview(.p1|.p2) で手番の色が分かる
 */
(function () {
  const COLS = 7;
  const ROWS = 6;
  const S = 0.96;
  const HOLE_R = 0.37;
  const COIN_R = 0.42;
  const COIN_T = 0.2;
  const Y0 = 1.0;
  const PANEL_T = 0.14;
  const GAP = COIN_T + 0.04;

  const colX = (c) => (c - (COLS - 1) / 2) * S;
  const rowY = (r) => Y0 + (ROWS - 1 - r) * S;

  window.BoardArena3D.registerAdapter('connect4', (THREE, container, api) => {
    const frameEl = container.querySelector('.c4-board-frame');
    const boardEl = container.querySelector('#c4-board');
    const guideEl = container.querySelector('#c4-drop-guide');
    if (!frameEl || !boardEl) return null;
    if (guideEl) guideEl.classList.add('ba3d-hidden-2d');

    const st = api.createStage(THREE, frameEl, {
      radius: 15.6, phi: 1.1, theta: 0.3, lookY: Y0 + 2.5, extent: 5,
      tableY: 0, minPhi: 0.5, maxPhi: 1.42
    });
    const { kit, geo, root, markers } = st;
    const frameMat = kit.wood('oak', { repeat: 0.18, vertical: true, clearcoat: 0.3 });

    // ---- 前後の穴あきパネル ----
    const panelW = COLS * S + 0.55;
    const panelH = ROWS * S + 0.45;
    const panelCY = Y0 + ((ROWS - 1) * S) / 2;

    function panelGeometry() {
      const shape = geo.roundedRectShape(panelW, panelH, 0.12);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          shape.holes.push(geo.circlePath(colX(c), rowY(r) - panelCY, HOLE_R));
        }
      }
      const bevel = 0.025;
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: PANEL_T - bevel * 2,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 3,
        curveSegments: 20
      });
      g.translate(0, 0, -(PANEL_T - bevel * 2) / 2);
      return g;
    }
    const panelGeo = panelGeometry();
    [1, -1].forEach((side) => {
      const panel = new THREE.Mesh(panelGeo, frameMat);
      panel.position.set(0, panelCY, side * (GAP / 2 + PANEL_T / 2));
      panel.castShadow = true;
      panel.receiveShadow = true;
      root.add(panel);
    });

    // 列の仕切り・左右の柱・脚
    const divGeo = geo.cached('c4-divider', () => new THREE.BoxGeometry(0.06, panelH - 0.2, GAP));
    for (let c = 0; c <= COLS; c++) {
      const d = new THREE.Mesh(divGeo, frameMat);
      d.position.set(colX(c) - S / 2, panelCY, 0);
      root.add(d);
    }
    const postGeo = geo.slab(0.34, GAP + PANEL_T * 2 + 0.12, panelH + 0.6, { bevel: 0.04, radius: 0.06 });
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(postGeo, frameMat);
      post.position.set(side * (panelW / 2 + 0.17), panelCY + 0.05, 0);
      post.castShadow = true;
      root.add(post);
      const foot = new THREE.Mesh(geo.cached('c4-foot', () => geo.slab(0.5, 2.6, 0.22, { bevel: 0.05, radius: 0.12 })), frameMat);
      foot.position.set(side * (panelW / 2 + 0.17), 0.11, 0);
      foot.castShadow = true;
      foot.receiveShadow = true;
      root.add(foot);
    });
    const bottomRail = new THREE.Mesh(geo.slab(panelW, GAP + PANEL_T * 2, 0.2, { bevel: 0.04, radius: 0.04 }), frameMat);
    bottomRail.position.set(0, Y0 - S / 2 - 0.12, 0);
    bottomRail.castShadow = true;
    root.add(bottomRail);

    const baseShadow = markers.contact(panelW + 1.6, 3.4, 0.6);
    baseShadow.position.y = 0.003;
    root.add(baseShadow);

    // ---- コイン ----
    const coinGeo = geo.cached('c4-coin', () => {
      const h = COIN_T / 2;
      const g = geo.lathe([
        [0, -h + 0.03], [COIN_R * 0.62, -h + 0.03], [COIN_R * 0.68, -h], [COIN_R - 0.03, -h],
        [COIN_R, -h + 0.03], [COIN_R, h - 0.03], [COIN_R - 0.03, h], [COIN_R * 0.68, h],
        [COIN_R * 0.62, h - 0.03], [0, h - 0.03]
      ], 48);
      g.rotateX(Math.PI / 2);
      return g;
    });
    const redMat = kit.lacquer('#9f2a22', { roughness: 0.38, clearcoat: 0.6 });
    const yellowMat = kit.lacquer('#d39b2a', { roughness: 0.38, clearcoat: 0.6 });
    const winMat = (isP1) => kit.lacquer(isP1 ? '#d2463a' : '#f0c04e', { roughness: 0.25, clearcoat: 1 });

    function createCoin(isP1) {
      const m = new THREE.Mesh(coinGeo, isP1 ? redMat : yellowMat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }

    // ---- 列のホバー・クリック ----
    const ghost = new THREE.Mesh(coinGeo, kit.ghostSolid('#ffffff', 0.4));
    ghost.visible = false;
    root.add(ghost);
    const topY = rowY(0) + S + 0.35;

    const cells = () => boardEl.querySelectorAll('.c4-cell');
    const columnFull = (c) => !!(cells()[c] && cells()[c].querySelector('.c4-coin'));
    const turnIsP1 = () => {
      const p = guideEl && guideEl.querySelector('.c4-drop-preview');
      return !p || p.classList.contains('p1');
    };

    let hoveredCol = null;
    function showGhost(c) {
      hoveredCol = c;
      if (c === null || columnFull(c)) {
        ghost.visible = false;
        return;
      }
      ghost.material = kit.ghostSolid(turnIsP1() ? '#c0392b' : '#e1b04a', 0.55);
      ghost.position.set(colX(c), topY, 0);
      ghost.visible = true;
    }

    const colHitGeo = new THREE.BoxGeometry(S, ROWS * S + 1.4, GAP + PANEL_T * 2 + 0.2);
    for (let c = 0; c < COLS; c++) {
      const hit = new THREE.Mesh(colHitGeo, kit.invisible());
      hit.position.set(colX(c), panelCY + 0.5, 0);
      root.add(hit);
      st.pick(hit, {
        clickable: () => !columnFull(c),
        onHover: () => showGhost(c),
        onLeave: () => showGhost(null),
        onClick: () => {
          const cell = cells()[c];
          if (cell) cell.click();
        }
      });
    }

    // ---- 同期 ----
    const coins = Array.from({ length: ROWS * COLS }, () => null);
    let first = true;

    function sync() {
      const list = cells();
      if (list.length < ROWS * COLS) return;
      list.forEach((cell, i) => {
        const coinEl = cell.querySelector('.c4-coin');
        const r = Math.floor(i / COLS);
        const c = i % COLS;
        if (!coinEl) {
          if (coins[i]) {
            st.removeObject(coins[i]);
            coins[i] = null;
          }
          return;
        }
        const isP1 = coinEl.classList.contains('p1');
        let m = coins[i];
        if (m && m.userData.isP1 !== isP1) {
          st.removeObject(m);
          m = null;
        }
        if (!m) {
          m = createCoin(isP1);
          m.userData.isP1 = isP1;
          m.position.set(colX(c), rowY(r), 0);
          root.add(m);
          coins[i] = m;
          if (!first) {
            m.position.y = topY;
            const fall = Math.max(0.25, Math.sqrt((topY - rowY(r)) / 9.8)) * 1000;
            st.animate(m, { position: { y: rowY(r) } }, { duration: fall * 1.35, ease: 'outBounce' });
          }
        }
        if (coinEl.classList.contains('win')) m.material = winMat(isP1);
      });
      first = false;
      showGhost(hoveredCol);
    }

    sync();
    return { st, sync };
  });
})();
