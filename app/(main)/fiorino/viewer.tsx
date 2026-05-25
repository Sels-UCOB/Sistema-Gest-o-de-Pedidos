"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";

export interface PlacedBox {
  id: string;
  size: "P" | "M" | "G";
  orientation: "vertical" | "horizontal";
  label: string;
  color: string;
  col: number;
  row: number;
  level: number;
}

export const BOX_CONFIGS: Record<
  PlacedBox["size"],
  Record<PlacedBox["orientation"], { cols: number; rows: number; levels: number }>
> = {
  P: {
    vertical:   { cols: 1, rows: 1, levels: 1 },
    horizontal: { cols: 1, rows: 1, levels: 1 },
  },
  M: {
    vertical:   { cols: 1, rows: 2, levels: 1 },
    horizontal: { cols: 2, rows: 1, levels: 1 },
  },
  G: {
    vertical:   { cols: 2, rows: 2, levels: 3 },
    horizontal: { cols: 2, rows: 3, levels: 2 },
  },
};

export function getBoxConfig(s: PlacedBox["size"], o: PlacedBox["orientation"]) {
  return BOX_CONFIGS[s][o];
}

// Fiorino 2025: 1.32 m wide × 1.85 m long × 1.36 m tall
// 4 cols × 6 rows × 4 levels
const COLS = 4;
const ROWS = 6;
const LEVELS = 4;
const CX = 1.0;      // col width
const CZ = 0.926;    // row depth
const CY = 1.030;    // level height

const W = COLS * CX;
const D = ROWS * CZ;
const H = LEVELS * CY;

const DEFAULT_ROT  = { x: 0.32, y: 0.60 };
const ROT_STEP     = Math.PI / 10;   // ~18° por clique
const ZOOM_DEFAULT = 1.0;
const ZOOM_MIN     = 0.35;
const ZOOM_MAX     = 3.2;
const ZOOM_STEP    = 0.20;

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

  const resetView = useCallback(() => {
    target.current = { ...DEFAULT_ROT };
    zoom.current = ZOOM_DEFAULT;
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
    const dist = Math.max(W, D, H) * 2.0;
    camera.position.set(dist * 0.65, dist * 0.60, dist * 0.95);
    const lookAtPt = new THREE.Vector3(W / 2, H / 2, D / 2);
    camera.lookAt(lookAtPt);

    // Direção e distância base para o sistema de zoom
    const camDir  = camera.position.clone().sub(lookAtPt).normalize();
    const baseDist = camera.position.distanceTo(lookAtPt);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(8, 14, 10);
    scene.add(sun);

    const pivot = new THREE.Group();
    pivot.position.set(-W / 2, -H / 2, -D / 2);
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

    wall(new THREE.PlaneGeometry(D, H), 0,     H / 2, D / 2,  0,             Math.PI / 2);  // left
    wall(new THREE.PlaneGeometry(D, H), W,     H / 2, D / 2,  0,            -Math.PI / 2);  // right
    wall(new THREE.PlaneGeometry(W, H), W / 2, H / 2, 0,      0,             0);             // front cab
    wall(new THREE.PlaneGeometry(W, D), W / 2, H,     D / 2,  Math.PI / 2,  0);             // roof

    // Rear opening frame
    const rf = [0,0,D, W,0,D,  W,0,D, W,H,D,  W,H,D, 0,H,D,  0,H,D, 0,0,D];
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.Float32BufferAttribute(rf, 3));
    pivot.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x94a3b8 })));

    // Corner verticals
    const cv = [0,0,0, 0,H,0,  W,0,0, W,H,0,  0,0,D, 0,H,D,  W,0,D, W,H,D];
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", new THREE.Float32BufferAttribute(cv, 3));
    pivot.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x64748b })));

    // Floor grid
    const gv: number[] = [];
    for (let c = 0; c <= COLS; c++) gv.push(c * CX, 0.04, 0, c * CX, 0.04, D);
    for (let r = 0; r <= ROWS; r++) gv.push(0, 0.04, r * CZ, W, 0.04, r * CZ);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
    pivot.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x334155 })));

    // Column labels A–D
    ["A","B","C","D"].forEach((lbl, c) => {
      const s = makeLabel(lbl, 80); s.scale.set(0.55, 0.55, 1);
      s.position.set(c * CX + CX / 2, 0.05, D + 0.45);
      pivot.add(s);
    });
    // Row labels 1–6
    for (let r = 0; r < ROWS; r++) {
      const s = makeLabel(String(r + 1), 64); s.scale.set(0.42, 0.42, 1);
      s.position.set(-0.5, 0.20, r * CZ + CZ / 2);
      pivot.add(s);
    }

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
      const cfg = getBoxConfig(box.size, box.orientation);
      const bw = cfg.cols * CX, bh = cfg.levels * CY, bd = cfg.rows * CZ;
      const geo = new THREE.BoxGeometry(bw - 0.04, bh - 0.04, bd - 0.04);
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
        color: new THREE.Color(box.color), transparent: true, opacity: 0.90, shininess: 60,
      }));
      mesh.position.set(box.col * CX + bw / 2, box.level * CY + bh / 2, box.row * CZ + bd / 2);
      boxGroup.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
      );
      edges.position.copy(mesh.position);
      boxGroup.add(edges);
    }
  }, [boxes]);

  const CtrlBtn = ({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title?: string }) => (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 active:bg-slate-800 transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="relative w-full h-full select-none">
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      />

      {/* Controles de rotação — só mobile (desktop usa mouse) */}
      <div className="md:hidden absolute bottom-3 right-3 flex flex-col items-center gap-1">
        <CtrlBtn onClick={() => applyDelta(0, -ROT_STEP)} title="Girar cima">
          <ChevronUp className="w-4 h-4" />
        </CtrlBtn>
        <div className="flex items-center gap-1">
          <CtrlBtn onClick={() => applyDelta(-ROT_STEP, 0)} title="Girar esquerda">
            <ChevronLeft className="w-4 h-4" />
          </CtrlBtn>
          <CtrlBtn onClick={resetView} title="Resetar vista">
            <RotateCcw className="w-3.5 h-3.5" />
          </CtrlBtn>
          <CtrlBtn onClick={() => applyDelta(ROT_STEP, 0)} title="Girar direita">
            <ChevronRight className="w-4 h-4" />
          </CtrlBtn>
        </div>
        <CtrlBtn onClick={() => applyDelta(0, ROT_STEP)} title="Girar baixo">
          <ChevronDown className="w-4 h-4" />
        </CtrlBtn>
      </div>

      {/* Controles de zoom — só mobile (desktop usa scroll) */}
      <div className="md:hidden absolute bottom-3 left-3 flex flex-col items-start gap-1">
        <div className="flex gap-1">
          <CtrlBtn onClick={() => applyZoom(ZOOM_STEP)} title="Aproximar">
            <Plus className="w-4 h-4" />
          </CtrlBtn>
          <CtrlBtn onClick={() => applyZoom(-ZOOM_STEP)} title="Afastar">
            <Minus className="w-4 h-4" />
          </CtrlBtn>
        </div>
        <span className="text-[10px] text-slate-600 pointer-events-none leading-tight">
          Arraste · Pinça p/ zoom
        </span>
      </div>
    </div>
  );
}
