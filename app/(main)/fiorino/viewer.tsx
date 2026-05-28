"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

export type BoxType        = "PA" | "MA" | "MB" | "G";
export type BoxOrientation = "vertical" | "horizontal";

// Box placed at real metre coordinates inside the cargo area
export interface PlacedBox {
  id:          string;
  size:        BoxType;
  orientation: BoxOrientation;
  label:       string;
  color:       string;
  x:           number;  // metres from left wall
  y:           number;  // metres from floor (auto-stacked)
  z:           number;  // metres from cab partition
}

// Real physical dimensions: [width(X), height(Y), depth(Z)] in metres
export const BOX_DIMS_M: Record<BoxType, [number, number, number]> = {
  PA: [0.30, 0.21, 0.25],
  MA: [0.44, 0.21, 0.30],
  MB: [0.26, 0.38, 0.36],
  G:  [0.75, 0.56, 0.43],
};

// Returns real dimensions in metres (swapping W↔D for horizontal)
export function getBoxDimsM(type: BoxType, orientation: BoxOrientation) {
  const [wm, hm, dm] = BOX_DIMS_M[type];
  return orientation === "vertical"
    ? { w: wm, h: hm, d: dm }
    : { w: dm, h: hm, d: wm };
}

// Returns dimensions in Three.js units (SCALE applied)
export function getRealDims(type: BoxType, orientation: BoxOrientation) {
  const s = 4.0 / 1.32;
  const { w, h, d } = getBoxDimsM(type, orientation);
  return { w: w * s, h: h * s, d: d * s };
}

// ── Compartment constants (exported for canvas drawing) ─────────────────────
export const CARGO = { width: 1.32, length: 1.90, height: 1.34, opHeight: 1.10 } as const;

// Wheel arch volumes in real metres (origin = cab-left-floor corner)
// Both arches start 0.47 m from the door → z0 = 1.90 − 0.47 − 0.74 = 0.69 m from cab
export const ARCH_LEFT  = { x: 0,    z: 0.69, w: 0.12, d: 0.74, hMax: 0.43 } as const;
export const ARCH_RIGHT = { x: 1.20, z: 0.69, w: 0.12, d: 0.74, hMax: 0.32 } as const;

// Fiorino: 1.32 m wide × 1.90 m long × 1.34 m tall
// Grid: 4 cols × 6 rows × 5 levels (operational height 1.10 m)
// Scale: 4.0 ÷ 1.32 ≈ 3.03 Three.js units per metre
const SCALE  = 4.0 / 1.32;          // ≈ 3.030 u/m

const COLS   = 4;
const ROWS   = 6;
const LEVELS = 5;                    // 5 × 0.22 m = 1.10 m operational

const CX     = 1.0;                  // col width      (0.33 m)
const CZ     = 1.90 / 6 * SCALE;    // row depth      (0.317 m → 0.960 u)
const CY     = 1.10 / 5 * SCALE;    // level height   (0.22  m → 0.667 u)

const W      = COLS   * CX;         // 4.0  u = 1.32 m
const D      = ROWS   * CZ;         // 5.76 u = 1.90 m
const H      = LEVELS * CY;         // 3.33 u = 1.10 m  (operational / stack limit)
const HWALL  = 1.34   * SCALE;      // 4.06 u = 1.34 m  (actual compartment height)

// Arch geometry in Three.js units
// Arches start 0.47 m from door → Z from cab = D − 0.47·SCALE
const ARCH_ZL   = 0.74  * SCALE;          // arch depth = 2.24 u
const ARCH_Z1   = D - 0.47 * SCALE;       // near-door end  Z = 4.34 u
const ARCH_Z0   = ARCH_Z1 - ARCH_ZL;      // cab-side start Z = 2.09 u

// Left arch:  0.12 m wide, 0.43 m tall
const ARCH_L_W  = 0.12 * SCALE;           // 0.364 u
const ARCH_L_H  = 0.43 * SCALE;           // 1.303 u

// Right arch: 0.12 m wide, 0.32 m tall
const ARCH_R_W  = 0.12 * SCALE;           // 0.364 u  (same width)
const ARCH_R_H  = 0.32 * SCALE;           // 0.970 u

const DEFAULT_ROT  = { x: 0.32, y: 0.60 };
const ZOOM_DEFAULT = 1.0;
const ZOOM_MIN     = 0.35;
const ZOOM_MAX     = 3.2;

function makeLabel(text: string, px = 72): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = px; c.height = px;
  const ctx = c.getContext("2d")!;
  ctx.font = `bold ${px * 0.44}px sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(text, px / 2, px / 2);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false });
  return new THREE.Sprite(mat);
}

interface Props { boxes: PlacedBox[] }

export default function FiorinoViewer({ boxes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    pivot: THREE.Group;
    boxGroup: THREE.Group;
    frameId: number;
    camDir: THREE.Vector3;
    baseDist: number;
    lookAt: THREE.Vector3;
  } | null>(null);

  const rot   = useRef({ ...DEFAULT_ROT });
  const target = useRef({ ...DEFAULT_ROT });
  const drag  = useRef({ active: false, prevX: 0, prevY: 0 });

  // zoom: 1.0 = padrão, > 1 = mais perto (zoom in), < 1 = mais longe (zoom out)
  const zoom  = useRef(ZOOM_DEFAULT);
  const pinch = useRef({ active: false, startDist: 0, startZoom: 1.0 });

  const applyDelta = useCallback((dx: number, dy: number) => {
    target.current.y += dx;
    target.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, target.current.x + dy));
  }, []);

  const applyZoom = useCallback((delta: number) => {
    zoom.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom.current + delta));
  }, []);

// Init scene (runs once)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setClearColor(0x020617);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.1, 200);
    const dist = Math.max(W, D, HWALL) * 2.0;
    camera.position.set(dist * 0.65, dist * 0.60, dist * 0.95);
    const lookAtPt = new THREE.Vector3(W / 2, HWALL / 2, D / 2);
    camera.lookAt(lookAtPt);

    // Direção e distância base para o sistema de zoom
    const camDir  = camera.position.clone().sub(lookAtPt).normalize();
    const baseDist = camera.position.distanceTo(lookAtPt);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(8, 14, 10);
    scene.add(sun);

    const pivot = new THREE.Group();
    pivot.position.set(-W / 2, -HWALL / 2, -D / 2);
    pivot.rotation.x = DEFAULT_ROT.x;
    pivot.rotation.y = DEFAULT_ROT.y;
    scene.add(pivot);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.06, D),
      new THREE.MeshPhongMaterial({ color: 0x1e293b })
    );
    floor.position.set(W / 2, -0.03, D / 2);
    pivot.add(floor);

    // Wheel arch blocks — left and right have DIFFERENT heights
    const archMat     = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 10 });
    const archEdgeMat = new THREE.LineBasicMaterial({ color: 0x475569 });
    const archCenterZ = ARCH_Z0 + ARCH_ZL / 2;
    for (const [aw, ah, ax] of [
      [ARCH_L_W, ARCH_L_H, ARCH_L_W / 2],          // left  (col A)
      [ARCH_R_W, ARCH_R_H, W - ARCH_R_W / 2],       // right (col D)
    ] as [number, number, number][]) {
      const geo  = new THREE.BoxGeometry(aw, ah, ARCH_ZL);
      const mesh = new THREE.Mesh(geo, archMat);
      mesh.position.set(ax, ah / 2, archCenterZ);
      pivot.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), archEdgeMat);
      edges.position.copy(mesh.position);
      pivot.add(edges);
    }

    // Semi-transparent walls + edges
    const wallMat = () => new THREE.MeshPhongMaterial({
      color: 0xf1f5f9, transparent: true, opacity: 0.10,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const eMat = () => new THREE.LineBasicMaterial({ color: 0x64748b });

    function wall(geo: THREE.PlaneGeometry, x: number, y: number, z: number, rx = 0, ry = 0) {
      const m = new THREE.Mesh(geo, wallMat());
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
      pivot.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), eMat());
      e.position.copy(m.position); e.rotation.copy(m.rotation);
      pivot.add(e);
    }

    wall(new THREE.PlaneGeometry(D, HWALL), 0,       HWALL / 2, D / 2,  0,            Math.PI / 2);  // left
    wall(new THREE.PlaneGeometry(D, HWALL), W,       HWALL / 2, D / 2,  0,           -Math.PI / 2);  // right
    wall(new THREE.PlaneGeometry(W, HWALL), W / 2,   HWALL / 2, 0,      0,            0);             // front cab
    wall(new THREE.PlaneGeometry(W, D),     W / 2,   HWALL,     D / 2,  Math.PI / 2, 0);             // roof

    // Rear opening frame (uses actual height HWALL)
    const rf = [0,0,D, W,0,D,  W,0,D, W,HWALL,D,  W,HWALL,D, 0,HWALL,D,  0,HWALL,D, 0,0,D];
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(rf, 3));
    pivot.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x94a3b8 })));

    // Corner verticals (actual height)
    const cv = [0,0,0, 0,HWALL,0,  W,0,0, W,HWALL,0,  0,0,D, 0,HWALL,D,  W,0,D, W,HWALL,D];
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(cv, 3));
    pivot.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x64748b })));

    // Dashed operational-height line at H (1.10 m) — perimeter at that height
    const ophPts = [0,H,0, W,H,0,  W,H,0, W,H,D,  W,H,D, 0,H,D,  0,H,D, 0,H,0];
    const ophGeo = new THREE.BufferGeometry();
    ophGeo.setAttribute("position", new THREE.Float32BufferAttribute(ophPts, 3));
    const ophLine = new THREE.LineSegments(ophGeo,
      new THREE.LineDashedMaterial({ color: 0x475569, dashSize: 0.18, gapSize: 0.10 }));
    ophLine.computeLineDistances();
    pivot.add(ophLine);

    // Floor grid
    const gv: number[] = [];
    for (let c = 0; c <= COLS; c++) gv.push(c * CX, 0.04, 0, c * CX, 0.04, D);
    for (let r = 0; r <= ROWS; r++) gv.push(0, 0.04, r * CZ, W, 0.04, r * CZ);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
    pivot.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x334155 })));

    const boxGroup = new THREE.Group();
    pivot.add(boxGroup);

    // ── Eventos de mouse ─────────────────────────────────────────────────────
    const onMD = (e: MouseEvent) => {
      drag.current.active = true;
      drag.current.prevX = e.clientX;
      drag.current.prevY = e.clientY;
    };
    const onMM = (e: MouseEvent) => {
      if (!drag.current.active) return;
      applyDelta((e.clientX - drag.current.prevX) * 0.013, (e.clientY - drag.current.prevY) * 0.013);
      drag.current.prevX = e.clientX;
      drag.current.prevY = e.clientY;
    };
    const onMU = () => { drag.current.active = false; };

    // Scroll wheel zoom (desktop)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // deltaY > 0 → scroll pra baixo → zoom out; < 0 → scroll pra cima → zoom in
      applyZoom(-e.deltaY * 0.0012);
    };

    // ── Eventos de toque (mobile) ─────────────────────────────────────────────
    const onTS = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // 1 dedo → rotação
        drag.current.active = true;
        drag.current.prevX = e.touches[0].clientX;
        drag.current.prevY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        // 2 dedos → pinch zoom
        drag.current.active = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinch.current = {
          active: true,
          startDist: Math.sqrt(dx * dx + dy * dy),
          startZoom: zoom.current,
        };
      }
    };

    const onTM = (e: TouchEvent) => {
      if (e.touches.length === 1 && drag.current.active) {
        applyDelta(
          (e.touches[0].clientX - drag.current.prevX) * 0.013,
          (e.touches[0].clientY - drag.current.prevY) * 0.013
        );
        drag.current.prevX = e.touches[0].clientX;
        drag.current.prevY = e.touches[0].clientY;
      } else if (e.touches.length === 2 && pinch.current.active) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.sqrt(dx * dx + dy * dy);
        // Spread dedos (currentDist > startDist) → zoom in; fechar → zoom out
        const scale = currentDist / pinch.current.startDist;
        zoom.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinch.current.startZoom * scale));
      }
    };

    const onTE = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        drag.current.active = false;
        pinch.current.active = false;
      } else if (e.touches.length === 1) {
        // Voltou pra 1 dedo: reinicia drag
        pinch.current.active = false;
        drag.current.active = true;
        drag.current.prevX = e.touches[0].clientX;
        drag.current.prevY = e.touches[0].clientY;
      }
    };

    el.addEventListener("mousedown", onMD);
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onMU);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTS, { passive: true });
    el.addEventListener("touchmove", onTM, { passive: true });
    el.addEventListener("touchend", onTE);

    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);

      // Rotação suavizada
      rot.current.x += (target.current.x - rot.current.x) * 0.12;
      rot.current.y += (target.current.y - rot.current.y) * 0.12;
      pivot.rotation.x = rot.current.x;
      pivot.rotation.y = rot.current.y;

      // Zoom: move câmera ao longo da direção fixa
      // zoom > 1 = câmera mais perto (zoom in), < 1 = mais longe (zoom out)
      const zoomedDist = baseDist / zoom.current;
      camera.position.copy(lookAtPt).addScaledVector(camDir, zoomedDist);

      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { renderer, scene, camera, pivot, boxGroup, frameId, camDir, baseDist, lookAt: lookAtPt };

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      el.removeEventListener("mousedown", onMD);
      window.removeEventListener("mousemove", onMM);
      window.removeEventListener("mouseup", onMU);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTS);
      el.removeEventListener("touchmove", onTM);
      el.removeEventListener("touchend", onTE);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild boxes quando `boxes` muda
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;
    const { boxGroup } = refs;
    while (boxGroup.children.length) {
      const c = boxGroup.children[0] as THREE.Mesh;
      c.geometry?.dispose();
      (c.material as THREE.Material)?.dispose();
      boxGroup.remove(c);
    }
    for (const box of boxes) {
      // Render at real physical size — snap anchor stays at grid corner
      const { w: bw, h: bh, d: bd } = getRealDims(box.size, box.orientation);
      const gap = 0.02; // small inset so adjacent boxes don't z-fight
      const geo = new THREE.BoxGeometry(bw - gap, bh - gap, bd - gap);
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: new THREE.Color(box.color), transparent: true, opacity: 0.90, shininess: 60,
      }));
      mesh.position.set(
        box.x * SCALE + bw / 2,
        box.y * SCALE + bh / 2,
        box.z * SCALE + bd / 2,
      );
      boxGroup.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
      );
      edges.position.copy(mesh.position);
      boxGroup.add(edges);
    }
  }, [boxes]);

  return (
    <div className="relative w-full h-full select-none">
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
