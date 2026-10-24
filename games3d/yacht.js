/**
 * ヨットの3D表示 — フェルト張りの木のダイストレイと、角の丸い象牙色のサイコロ。
 * 2D盤面: .yct-dice-tray > #dice-container > .yct-die(5) (目は ⚀..⚅、.kept)、#btn-roll-dice
 */
(function () {
  const SIZE = 0.9;
  const TRAY_W = 8.2;
  const TRAY_D = 5.0;
  const KEEP_Z = 1.55;
  const ROLL_Z = -0.6;
  const FACE_MAP = { '⚀': 1, '⚁': 2, '⚂': 3, '⚃': 4, '⚄': 5, '⚅': 6 };
  // BoxGeometry の面順 (+X, -X, +Y, -Y, +Z, -Z) に割り当てる目
  const FACE_VALUES = [3, 4, 1, 6, 2, 5];
  // その目を真上に向ける回転 (回転順 YXZ)
  const UP_ROT = { 1: [0, 0], 6: [Math.PI, 0], 2: [-Math.PI / 2, 0], 5: [Math.PI / 2, 0], 3: [0, Math.PI / 2], 4: [0, -Math.PI / 2] };
  const PIPS = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.27, 0.23], [0.73, 0.23], [0.27, 0.5], [0.73, 0.5], [0.27, 0.77], [0.73, 0.77]]
  };

  window.BoardArena3D.registerAdapter('yacht', (THREE, container, api) => {
    const diceContainer = container.querySelector('#dice-container');
    const rollBtn = container.querySelector('#btn-roll-dice');
    if (!diceContainer) return null;

    const st = api.createStage(THREE, diceContainer, {
      radius: 9.4, phi: 0.62, extent: 4.4, tableY: -0.3, height: 'clamp(300px, 42vh, 420px)'
    });
    const { kit, geo, root, markers } = st;

    // ---- トレイ ----
    const floor = new THREE.Mesh(geo.slab(TRAY_W, TRAY_D, 0.12, { bevel: 0.02, radius: 0.3 }), kit.felt('#1f4a39', { repeat: 0.5 }));
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    root.add(floor);
    const wallMat = kit.wood('walnut', { repeat: 0.25, seed: 71 });
    const wall = new THREE.Mesh(
      geo.slab(TRAY_W + 0.6, TRAY_D + 0.6, 0.62, { bevel: 0.06, radius: 0.55, holes: [geo.roundedRectShape(TRAY_W + 0.12, TRAY_D + 0.12, 0.36)] }),
      wallMat
    );
    wall.position.y = 0.19;
    wall.castShadow = true;
    wall.receiveShadow = true;
    root.add(wall);
    const divider = new THREE.Mesh(geo.cached('yct-divider', () => new THREE.PlaneGeometry(TRAY_W - 0.6, 0.03).rotateX(-Math.PI / 2)), kit.ghost('#c9a35a', 0.55));
    divider.position.set(0, 0.002, (KEEP_Z + ROLL_Z) / 2 + 0.35);
    root.add(divider);
    st.label('キープ', { className: 'is-plain' }).at(-TRAY_W / 2 + 0.75, 0.01, KEEP_Z + 0.75);

    // ---- サイコロ ----
    function faceCanvas(v, bump) {
      return api.canvas.cached(`yct-face:${v}:${bump}`, 256, 256, (ctx, w) => {
        if (bump) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, w);
        } else {
          api.canvas.paintNoise(ctx, w, w, '#ece4d4', 6, 200 + v, 0);
        }
        PIPS[v].forEach(([px, py]) => {
          const r = v === 1 ? 34 : 21;
          const x = px * w;
          const y = py * w;
          if (bump) {
            ctx.fillStyle = '#000';
          } else {
            const g = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
            g.addColorStop(0, v === 1 ? '#7d1a14' : '#121110');
            g.addColorStop(1, v === 1 ? '#b0291f' : '#2e2a25');
            ctx.fillStyle = g;
          }
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    }
    const dieMats = FACE_VALUES.map((v) => new THREE.MeshPhysicalMaterial({
      map: kit.texture(faceCanvas(v, false)),
      bumpMap: kit.texture(faceCanvas(v, true), { srgb: false }),
      bumpScale: 0.012,
      roughness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.8
    }));
    const dieGeo = geo.cached('yct-die', () => geo.roundedBox(SIZE, SIZE, SIZE, 0.14, 4));

    const dice = [];
    const keepRings = [];
    const slotX = (i) => (i - 2) * 1.45;
    for (let i = 0; i < 5; i++) {
      const holder = new THREE.Group();
      const die = new THREE.Mesh(dieGeo, dieMats);
      die.userData.sharedMaterial = true;
      die.castShadow = true;
      die.receiveShadow = true;
      die.rotation.order = 'YXZ';
      die.position.y = SIZE / 2;
      const shadow = markers.contact(SIZE * 1.7, SIZE * 1.7, 0.45);
      shadow.position.y = 0.004;
      holder.add(shadow, die);
      holder.position.set(slotX(i), 0, ROLL_Z);
      root.add(holder);
      holder.userData.die = die;
      dice.push(holder);
      st.pick(die, {
        onHover: () => { if (!die.userData._tween) die.position.y = SIZE / 2 + 0.08; },
        onLeave: () => { if (!die.userData._tween) die.position.y = SIZE / 2; },
        onClick: () => {
          const els = diceContainer.querySelectorAll('.yct-die');
          if (els[i]) els[i].click();
        }
      });

      const ring = markers.ring(0.66, 0.72, '#e2b867', 0.85);
      ring.visible = false;
      root.add(ring);
      keepRings.push(ring);
    }

    // ---- 振る ----
    let rollPending = false;
    if (rollBtn) rollBtn.addEventListener('click', () => { rollPending = true; });

    // ---- 同期 ----
    const state = dice.map(() => ({ value: 0, kept: false }));

    function sync() {
      const els = diceContainer.querySelectorAll('.yct-die');
      if (els.length < 5) return;
      const rolling = rollPending;
      rollPending = false;

      els.forEach((el, i) => {
        const value = FACE_MAP[el.textContent.trim()] || 0;
        const kept = el.classList.contains('kept');
        const holder = dice[i];
        const die = holder.userData.die;
        const prev = state[i];
        const changedValue = value !== prev.value;
        const changedKeep = kept !== prev.kept;
        state[i] = { value, kept };
        if (!changedValue && !changedKeep) return;

        const rng = api.mulberry32((Date.now() + i * 7919) % 100000);
        const x = kept ? slotX(i) : slotX(i) + (rng() - 0.5) * 0.35;
        const z = kept ? KEEP_Z : ROLL_Z + (rng() - 0.5) * 0.7;
        const [rx, rz] = UP_ROT[value || 1];
        const yaw = kept ? 0 : (rng() - 0.5) * 0.9;

        if (rolling && !kept && changedValue) {
          // 転がす: 何回転かしながら放物線を描いて着地
          const turns = (n) => Math.round(n / (Math.PI * 2)) * Math.PI * 2;
          st.animate(holder, { position: { x, z } }, { duration: 820, ease: 'outCubic' });
          st.animate(die, {
            rotation: {
              x: turns(die.rotation.x) + rx + Math.PI * 2 * (2 + Math.floor(rng() * 2)),
              y: yaw + (rng() - 0.5) * Math.PI,
              z: turns(die.rotation.z) + rz + Math.PI * 2 * (1 + Math.floor(rng() * 2))
            },
            position: { y: SIZE / 2 }
          }, { duration: 820, delay: i * 40, arc: 1.4, ease: 'outCubic' });
        } else {
          st.animate(holder, { position: { x, z } }, { duration: 360, arc: 0.5, ease: 'inOutCubic' });
          st.animate(die, { rotation: { x: rx, y: yaw, z: rz }, position: { y: SIZE / 2 } }, { duration: 360, ease: 'inOutCubic' });
        }
        keepRings[i].visible = kept;
        keepRings[i].position.set(x, 0.006, z);
      });
    }

    sync();
    return { st, sync };
  });
})();
