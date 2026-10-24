/**
 * コリドールの3D表示 — 溝で区切った木のマス目に、旋盤で削った駒と板の壁。
 * 2D盤面: .qd-board-container / #qd-board の 17×17 グリッド
 *   .qd-cell(.valid-move) > .qd-pawn(.p1|.p2)、.qd-wall-h-slot / .qd-wall-v-slot / .qd-wall-cross-slot (.placed, .preview)
 *   壁スロットは mouseenter でプレビュー、click で設置する。
 */
(function () {
  const N = 9;
  const SP = 1.04;
  const CELL = 0.84;
  const WALL_H = 0.46;
  const WALL_T = 0.15;

  window.BoardArena3D.registerAdapter('quoridor', (THREE, container, api) => {
    const boardContainer = container.querySelector('.qd-board-container');
    const boardEl = container.querySelector('#qd-board');
    if (!boardContainer || !boardEl) return null;

    const st = api.createStage(THREE, boardContainer, { radius: 17, phi: 0.72, extent: 6, tableY: -0.5 });
    const { kit, geo, root, markers } = st;

    // ---- 盤 ----
    const size = N * SP + 0.6;
    const base = new THREE.Mesh(geo.slab(size, size, 0.4, { bevel: 0.06, radius: 0.24 }), kit.wood('darkWalnut', { repeat: 0.14 }));
    base.position.y = -0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const cellGeo = geo.cached('qd-cell', () => geo.slab(CELL, CELL, 0.12, { bevel: 0.025, radius: 0.04 }));
    const cellMats = [kit.wood('maple', { repeat: 0.5, seed: 21 }), kit.wood('maple', { repeat: 0.5, seed: 22, vertical: true })];
    const pos = (r, c) => ({ x: (c - (N - 1) / 2) * SP, z: (r - (N - 1) / 2) * SP });
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const tile = new THREE.Mesh(cellGeo, cellMats[(r + c) % 2]);
        const p = pos(r, c);
        tile.position.set(p.x, 0.06, p.z);
        tile.receiveShadow = true;
        root.add(tile);
      }
    }
    const TOP = 0.12;

    // ゴール列の印 (相手側の辺)
    [-1, 1].forEach((side) => {
      const strip = new THREE.Mesh(
        geo.cached('qd-goal', () => new THREE.PlaneGeometry(N * SP - 0.2, 0.05).rotateX(-Math.PI / 2)),
        kit.ghost(side < 0 ? '#5d7fb8' : '#b5544a', 0.85)
      );
      strip.position.set(0, 0.002, side * (N * SP / 2 + 0.12));
      root.add(strip);
    });

    // ---- 駒 ----
    const pawnGeo = geo.cached('qd-pawn', () => geo.lathe([
      [0, 0], [0.32, 0], [0.34, 0.03], [0.32, 0.07], [0.22, 0.12], [0.15, 0.3], [0.13, 0.42],
      [0.2, 0.46], [0.2, 0.5], [0.12, 0.53], [0.17, 0.6], [0.2, 0.7], [0.17, 0.8], [0.09, 0.86], [0, 0.875]
    ], 48));
    const pawnMats = { p1: kit.lacquer('#2d4c84', { roughness: 0.35 }), p2: kit.lacquer('#8e2a22', { roughness: 0.35 }) };
    const pawns = {};

    function ensurePawn(key) {
      if (pawns[key]) return pawns[key];
      const holder = new THREE.Group();
      const body = new THREE.Mesh(pawnGeo, pawnMats[key]);
      body.castShadow = true;
      body.receiveShadow = true;
      const shadow = markers.contact(0.9, 0.9, 0.55);
      shadow.position.y = 0.003;
      holder.add(shadow, body);
      root.add(holder);
      pawns[key] = holder;
      return holder;
    }

    // ---- 壁 ----
    const wallMat = kit.wood('cherry', { repeat: 0.6, seed: 41 });
    const ghostMat = kit.ghostSolid('#f4ede1', 0.4);
    const hWallGeo = geo.cached('qd-wall-h', () => geo.slab(SP, WALL_T, WALL_H, { bevel: 0.02, radius: 0.02 }));
    const vWallGeo = geo.cached('qd-wall-v', () => geo.slab(WALL_T, SP, WALL_H, { bevel: 0.02, radius: 0.02 }));
    const crossGeo = geo.cached('qd-wall-x', () => geo.slab(WALL_T, WALL_T, WALL_H, { bevel: 0.02, radius: 0.02 }));
    const slotHitH = geo.cached('qd-hit-h', () => new THREE.BoxGeometry(SP, 0.3, 0.28));
    const slotHitV = geo.cached('qd-hit-v', () => new THREE.BoxGeometry(0.28, 0.3, SP));

    const wallGroup = new THREE.Group();
    const hintGroup = new THREE.Group();
    root.add(wallGroup, hintGroup);
    const placedKeys = new Set();
    let hoverSlot = null;

    // ---- マスのクリック ----
    let validCells = new Map();
    const hoverSquare = markers.square(CELL, '#f4ede1', 0.16);
    hoverSquare.visible = false;
    root.add(hoverSquare);

    const picker = st.gridPicker({
      rows: N,
      cols: N,
      step: SP,
      y: TOP + 0.005,
      clickable: (r, c) => validCells.has(`${r},${c}`),
      onHover: (r, c) => {
        const ok = validCells.has(`${r},${c}`);
        hoverSquare.visible = ok;
        const p = pos(r, c);
        hoverSquare.position.set(p.x, TOP + 0.004, p.z);
      },
      onLeave: () => { hoverSquare.visible = false; },
      onClick: (r, c) => {
        const el = validCells.get(`${r},${c}`);
        if (el) el.click();
      }
    });

    // ---- 同期 ----
    let first = true;

    function sync() {
      const children = Array.from(boardEl.children);
      if (!children.length) return;

      st.clearGroup(hintGroup);
      validCells = new Map();
      const seenPlaced = new Set();
      const previews = [];
      const slots = [];

      children.forEach((el) => {
        const gr = parseInt(el.style.gridRow, 10) - 1;
        const gc = parseInt(el.style.gridColumn, 10) - 1;
        if (isNaN(gr) || isNaN(gc)) return;

        if (el.classList.contains('qd-cell')) {
          const r = gr / 2;
          const c = gc / 2;
          const p = pos(r, c);
          const pawnEl = el.querySelector('.qd-pawn');
          if (pawnEl) {
            const key = pawnEl.classList.contains('p1') ? 'p1' : 'p2';
            const holder = ensurePawn(key);
            const prev = holder.userData.cell;
            if (!prev) {
              holder.position.set(p.x, TOP, p.z);
            } else if (prev !== `${r},${c}`) {
              st.animate(holder, { position: { x: p.x, z: p.z } }, { duration: 480, arc: 0.8, ease: 'inOutCubic' });
            }
            holder.userData.cell = `${r},${c}`;
          }
          if (el.classList.contains('valid-move')) {
            validCells.set(`${r},${c}`, el);
            const dot = markers.dot(0.13, '#f4ede1', 0.5);
            dot.position.set(p.x, TOP + 0.004, p.z);
            hintGroup.add(dot);
          }
          return;
        }

        const isH = el.classList.contains('qd-wall-h-slot');
        const isV = el.classList.contains('qd-wall-v-slot');
        const isX = el.classList.contains('qd-wall-cross-slot');
        if (!isH && !isV && !isX) return;

        const x = ((gc / 2) - (N - 1) / 2) * SP;
        const z = ((gr / 2) - (N - 1) / 2) * SP;
        const key = `${gr},${gc}`;
        if (el.classList.contains('placed')) {
          seenPlaced.add(key);
          if (!placedKeys.has(key)) {
            placedKeys.add(key);
            const wall = new THREE.Mesh(isH ? hWallGeo : isV ? vWallGeo : crossGeo, wallMat);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.userData.key = key;
            wall.position.set(x, WALL_H / 2 + 0.02, z);
            wallGroup.add(wall);
            if (!first) {
              wall.position.y += 1.2;
              st.animate(wall, { position: { y: WALL_H / 2 + 0.02 } }, { duration: 420, ease: 'outBounce' });
            }
          }
        } else if (el.classList.contains('preview')) {
          previews.push({ x, z, g: isH ? hWallGeo : isV ? vWallGeo : crossGeo });
        }
        if (isH || isV) slots.push({ el, x, z, isH });
      });

      // 取り除かれた壁 (新しいゲーム)
      wallGroup.children.slice().forEach((w) => {
        if (!seenPlaced.has(w.userData.key)) {
          placedKeys.delete(w.userData.key);
          st.removeObject(w);
        }
      });

      // プレビュー
      previews.forEach(({ x, z, g }) => {
        const ghost = new THREE.Mesh(g, ghostMat);
        ghost.position.set(x, WALL_H / 2 + 0.02, z);
        hintGroup.add(ghost);
      });

      // 壁スロットの当たり判定 (DOM が描き直されるたびに作り直す)
      slots.forEach(({ el, x, z, isH }) => {
        if (el.classList.contains('placed')) return;
        const hit = new THREE.Mesh(isH ? slotHitH : slotHitV, kit.invisible());
        hit.position.set(x, TOP + 0.15, z);
        hintGroup.add(hit);
        st.pick(hit, {
          onHover: () => {
            hoverSlot = el;
            el.dispatchEvent(new MouseEvent('mouseenter'));
          },
          onLeave: () => {
            if (hoverSlot === el) hoverSlot = null;
            el.dispatchEvent(new MouseEvent('mouseleave'));
          },
          clickable: () => el.classList.contains('preview'),
          onClick: () => el.click()
        });
      });

      const h = picker.hovered;
      hoverSquare.visible = !!h && validCells.has(`${h.r},${h.c}`);
      first = false;
    }

    sync();
    return { st, sync };
  });
})();
