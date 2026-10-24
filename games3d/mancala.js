/**
 * マンカラの3D表示 — くり抜いたポケットのある木の盤に、ガラス玉の石。
 * 2D盤面: .mancala-board-frame / #pit-0..13 (.selectable) と #count-0..13
 *   0..5 = 手前の列 (左→右)、6 = 右のストア、7..12 = 奥の列 (右→左)、13 = 左のストア
 */
(function () {
  const PIT_R = 0.58;
  const PIT_D = 0.34;
  const STORE_RX = 0.72;
  const STORE_RZ = 1.75;
  const BOARD_W = 12.6;
  const BOARD_D = 4.9;
  const BOARD_H = 0.62;
  const BEVEL = 0.05;
  const BEAD_R = 0.13;
  const COLORS = ['#3f6f8f', '#8f3b32', '#c49a3c', '#4f7a4a', '#6f5a8a'];

  function pitPos(i) {
    if (i === 6) return { x: 4.95, z: 0, store: true };
    if (i === 13) return { x: -4.95, z: 0, store: true };
    if (i <= 5) return { x: (i - 2.5) * 1.42, z: 1.15, store: false };
    return { x: (12 - i - 2.5) * 1.42, z: -1.15, store: false };
  }

  window.BoardArena3D.registerAdapter('mancala', (THREE, container, api) => {
    const frameEl = container.querySelector('.mancala-board-frame');
    if (!frameEl) return null;

    const st = api.createStage(THREE, frameEl, { radius: 13.6, phi: 0.74, extent: 6.6, tableY: -BOARD_H - 0.02 });
    const { kit, geo, root, markers } = st;

    // ---- 盤 (穴をくり抜いた板 + 椀状のポケット) ----
    const holes = [];
    for (let i = 0; i < 14; i++) {
      const p = pitPos(i);
      holes.push(p.store ? geo.ellipsePath(p.x, -p.z, STORE_RX, STORE_RZ) : geo.circlePath(p.x, -p.z, PIT_R));
    }
    const boardMat = kit.wood('walnut', { repeat: 0.16, seed: 12 });
    const board = new THREE.Mesh(geo.slab(BOARD_W, BOARD_D, BOARD_H, { bevel: BEVEL, radius: 1.2, holes, curveSegments: 24 }), boardMat);
    board.position.y = -BOARD_H / 2;
    board.castShadow = true;
    board.receiveShadow = true;
    root.add(board);

    const bowlProfile = (R, D) => {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = Math.PI / 2 - (k / 12) * (Math.PI / 2);
        pts.push([R * Math.sin(t), -D * Math.cos(t)]);
      }
      return pts;
    };
    const bowlMat = kit.wood('walnut', { repeat: 0.9, seed: 13, roughness: 0.6, clearcoat: 0.1 });
    const pitBowl = geo.cached('mcl-bowl', () => geo.lathe(bowlProfile(PIT_R - BEVEL, PIT_D), 48));
    const storeBowl = geo.cached('mcl-store', () => {
      const g = geo.lathe(bowlProfile(STORE_RX - BEVEL, PIT_D), 48);
      g.scale(1, 1, (STORE_RZ - BEVEL) / (STORE_RX - BEVEL));
      return g;
    });
    for (let i = 0; i < 14; i++) {
      const p = pitPos(i);
      const bowl = new THREE.Mesh(p.store ? storeBowl : pitBowl, bowlMat);
      bowl.position.set(p.x, -BEVEL, p.z);
      bowl.receiveShadow = true;
      root.add(bowl);
    }

    // ---- 石 (ガラス玉) ----
    const beadGeo = geo.cached('mcl-bead', () => {
      const g = new THREE.SphereGeometry(BEAD_R, 24, 16);
      g.scale(1, 0.62, 1);
      return g;
    });
    const beadMats = COLORS.map((c) => new THREE.MeshPhysicalMaterial({
      color: kit.color(c),
      roughness: 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 1.2
    }));

    // ポケット内での石の位置 (同じ番号の石は毎回同じ場所)
    function beadSpot(i, k) {
      const p = pitPos(i);
      const rng = api.mulberry32(i * 997 + k * 131);
      const perLayer = p.store ? 14 : 7;
      const layer = Math.floor(k / perLayer);
      const idx = k % perLayer;
      const R = (p.store ? STORE_RX : PIT_R) - 0.2;
      const ang = idx * 2.399 + layer * 0.9 + rng() * 0.3;
      const rad = Math.min(R, Math.sqrt((idx + 0.5) / perLayer) * R);
      const zScale = p.store ? STORE_RZ / STORE_RX : 1;
      const lx = Math.cos(ang) * rad;
      const lz = Math.sin(ang) * rad * zScale;
      const nr = Math.min(1, rad / (R + 0.2));
      const floorY = -BEVEL - PIT_D * Math.sqrt(Math.max(0, 1 - nr * nr));
      return {
        x: p.x + lx,
        y: floorY + BEAD_R * 0.62 + layer * BEAD_R * 1.1,
        z: p.z + lz,
        ry: rng() * Math.PI
      };
    }

    const beads = Array.from({ length: 14 }, () => []);

    function setCount(i, count, delay) {
      const list = beads[i];
      while (list.length > count) {
        const b = list.pop();
        st.animate(b, { scale: 0.01, position: { y: b.position.y + 0.4 } }, { duration: 220, complete: () => st.removeObject(b) });
      }
      while (list.length < count) {
        const k = list.length;
        const s = beadSpot(i, k);
        const b = new THREE.Mesh(beadGeo, beadMats[(i * 3 + k) % COLORS.length]);
        b.userData.sharedMaterial = true;
        b.castShadow = true;
        b.rotation.y = s.ry;
        b.position.set(s.x, s.y, s.z);
        root.add(b);
        list.push(b);
        if (delay !== null) {
          b.position.y = s.y + 1.4;
          st.animate(b, { position: { y: s.y } }, { duration: 380, delay: delay + (k % 3) * 25, ease: 'outBounce' });
        }
      }
    }

    // ---- 個数ラベル ----
    const labels = [];
    for (let i = 0; i < 14; i++) {
      const p = pitPos(i);
      const lb = st.label('0', { className: 'is-plain' });
      if (p.store) lb.at(p.x, 0.05, p.z + STORE_RZ + 0.42);
      else lb.at(p.x, 0.05, p.z + (p.z > 0 ? 0.92 : -0.92));
      labels.push(lb);
    }

    // ---- 選べるポケット ----
    const ringGroup = new THREE.Group();
    root.add(ringGroup);
    let hoverIdx = null;
    const pitEl = (i) => container.querySelector(`#pit-${i}`);
    const hitGeo = geo.cached('mcl-hit', () => new THREE.CylinderGeometry(PIT_R, PIT_R, 0.3, 24));
    for (let i = 0; i < 14; i++) {
      const p = pitPos(i);
      if (p.store) continue;
      const hit = new THREE.Mesh(hitGeo, kit.invisible());
      hit.position.set(p.x, 0, p.z);
      root.add(hit);
      st.pick(hit, {
        clickable: () => !!pitEl(i) && pitEl(i).classList.contains('selectable'),
        onHover: () => { hoverIdx = i; drawRings(); },
        onLeave: () => { if (hoverIdx === i) hoverIdx = null; drawRings(); },
        onClick: () => { const el = pitEl(i); if (el) el.click(); }
      });
    }

    function drawRings() {
      st.clearGroup(ringGroup);
      for (let i = 0; i < 14; i++) {
        const el = pitEl(i);
        if (!el || !el.classList.contains('selectable')) continue;
        const p = pitPos(i);
        const ring = markers.ring(PIT_R + 0.04, PIT_R + (hoverIdx === i ? 0.12 : 0.08), i === hoverIdx ? '#f4ede1' : '#e2b867', i === hoverIdx ? 0.95 : 0.6);
        ring.position.set(p.x, 0.006, p.z);
        ringGroup.add(ring);
      }
    }

    // ---- 同期 ----
    let counts = null;

    function sync() {
      const next = [];
      for (let i = 0; i < 14; i++) {
        const el = container.querySelector(`#count-${i}`);
        next[i] = el ? parseInt(el.textContent, 10) || 0 : 0;
      }
      if (!counts) {
        next.forEach((n, i) => setCount(i, n, null));
      } else {
        // 空になったポケットから反時計回りに撒くように、増えた石を順に落とす
        const source = next.findIndex((n, i) => n === 0 && counts[i] > 0 && i !== 6 && i !== 13);
        next.forEach((n, i) => {
          if (n === counts[i]) return;
          const d = source >= 0 ? (i - source + 14) % 14 : 0;
          setCount(i, n, n > counts[i] ? 80 + d * 110 : null);
        });
      }
      counts = next;
      next.forEach((n, i) => labels[i].set(n));
      drawRings();
    }

    sync();
    return { st, sync };
  });
})();
