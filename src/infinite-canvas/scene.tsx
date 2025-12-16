import { useProgress } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import * as THREE from "three";
import { useIsTouchDevice } from "~/src/use-is-touch-device";
import { clamp, lerp, run } from "~/src/utils";
import {
  CHUNK_FADE_MARGIN,
  CHUNK_OFFSETS,
  CHUNK_SIZE,
  DEPTH_FADE_END,
  DEPTH_FADE_EXTRA,
  DEPTH_FADE_START,
  DPR_MAX_DESKTOP,
  DPR_MAX_TOUCH,
  DRIFT_LERP_NORMAL,
  DRIFT_LERP_ZOOMING,
  FPS_UPDATE_INTERVAL,
  FULL_OPACITY_THRESHOLD,
  INITIAL_CAMERA_Z,
  INVIS_THRESHOLD,
  KEYBOARD_SPEED,
  MAX_DRIFT,
  MAX_VELOCITY,
  MOUSE_DRAG_SENSITIVITY,
  READY_DELAY,
  RENDER_DISTANCE,
  SCROLL_ACCUM_DECAY,
  SPACE_SPEED_MULTIPLIER,
  TOUCH_DRAG_SENSITIVITY,
  TOUCH_PINCH_SENSITIVITY,
  VELOCITY_DECAY,
  VELOCITY_LERP,
  VISIBILITY_LERP,
  WHEEL_SCROLL_SENSITIVITY,
  ZOOM_FACTOR_BASE,
  ZOOM_FACTOR_MAX,
  ZOOM_FACTOR_MIN,
  ZOOMING_THRESHOLD,
} from "./constants";
import styles from "./style.module.css";
import { getTexture } from "./texture-manager";
import type { ChunkData, InfiniteCanvasProps, MediaItem, PlaneData } from "./types";
import { generateChunkPlanesCached, getChunkUpdateThrottleMs, getMediaDimensions, shouldThrottleUpdate } from "./utils";

const PLANE_GEOMETRY = new THREE.PlaneGeometry(1, 1);

const getTouchDistance = (touches: Touch[]) => {
  if (touches.length < 2) return 0;
  const [t1, t2] = touches;
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

type CameraGridState = {
  cx: number;
  cy: number;
  cz: number;
  camZ: number;
};

function MediaPlane({
  position,
  scale,
  media,
  chunkCx,
  chunkCy,
  chunkCz,
  cameraGridRef,
}: {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  media: MediaItem;
  chunkCx: number;
  chunkCy: number;
  chunkCz: number;
  cameraGridRef: React.RefObject<CameraGridState>;
}) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const materialRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const localState = React.useRef({ opacity: 0, frame: 0, ready: false });

  const [texture, setTexture] = React.useState<THREE.Texture | null>(null);
  const [isReady, setIsReady] = React.useState(false);

  useFrame(() => {
    const material = materialRef.current;
    const mesh = meshRef.current;
    const state = localState.current;
    if (!material || !mesh) return;

    // Frame skip for invisible planes
    state.frame = (state.frame + 1) & 1;
    if (state.opacity < INVIS_THRESHOLD && !mesh.visible && state.frame === 0) return;

    const cam = cameraGridRef.current;
    const dist = Math.max(Math.abs(chunkCx - cam.cx), Math.abs(chunkCy - cam.cy), Math.abs(chunkCz - cam.cz));
    const absDepth = Math.abs(position.z - cam.camZ);

    // Early exit for far-away planes
    if (absDepth > DEPTH_FADE_END + DEPTH_FADE_EXTRA) {
      state.opacity = 0;
      material.opacity = 0;
      material.depthWrite = false;
      mesh.visible = false;
      return;
    }

    // Calculate target visibility from grid distance and depth
    const gridFade =
      dist <= RENDER_DISTANCE ? 1 : Math.max(0, 1 - (dist - RENDER_DISTANCE) / Math.max(CHUNK_FADE_MARGIN, 0.0001));

    const depthFade =
      absDepth <= DEPTH_FADE_START
        ? 1
        : Math.max(0, 1 - (absDepth - DEPTH_FADE_START) / Math.max(DEPTH_FADE_END - DEPTH_FADE_START, 0.0001));

    const target = Math.min(gridFade, depthFade * depthFade);

    // Lerp opacity toward target
    state.opacity =
      target < INVIS_THRESHOLD && state.opacity < INVIS_THRESHOLD ? 0 : lerp(state.opacity, target, VISIBILITY_LERP);

    // Apply to material
    const isFullyOpaque = state.opacity > FULL_OPACITY_THRESHOLD;
    material.opacity = isFullyOpaque ? 1 : state.opacity;
    material.depthWrite = isFullyOpaque;
    mesh.visible = state.opacity > INVIS_THRESHOLD;
  });

  const displayScale = run(() => {
    if (media.width && media.height) {
      const aspect = media.width / media.height || 1;
      return new THREE.Vector3(scale.y * aspect, scale.y, 1);
    }
    if (!texture) return scale;

    const { width, height } = getMediaDimensions(texture.image as HTMLImageElement | undefined);
    if (!width || !height) return scale;

    return new THREE.Vector3(scale.y * (width / height), scale.y, 1);
  });

  React.useEffect(() => {
    const state = localState.current;
    state.ready = false;
    state.opacity = 0;
    setIsReady(false);

    const material = materialRef.current;
    if (material) {
      material.opacity = 0;
      material.depthWrite = false;
      material.map = null;
    }

    const tex = getTexture(media);
    setTexture(tex);

    const img = tex?.image as HTMLImageElement | undefined;
    const markReady = () => {
      state.ready = true;
      setIsReady(true);
    };

    if (!(img instanceof HTMLImageElement)) {
      markReady();
      return;
    }

    if (img.complete && img.naturalWidth > 0) {
      markReady();
    } else {
      img.addEventListener("load", markReady, { once: true });
      return () => img.removeEventListener("load", markReady);
    }
  }, [media]);

  React.useEffect(() => {
    const material = materialRef.current;
    const mesh = meshRef.current;
    const state = localState.current;
    if (!material || !mesh || !texture || !isReady || !state.ready) return;

    material.map = texture;
    material.opacity = state.opacity;
    material.depthWrite = state.opacity >= 1;
    mesh.scale.copy(displayScale);
  }, [displayScale, texture, isReady]);

  if (!texture || !isReady) return null;

  return (
    <mesh ref={meshRef} position={position} scale={displayScale} visible={false} geometry={PLANE_GEOMETRY}>
      <meshBasicMaterial ref={materialRef} transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Chunk({
  cx,
  cy,
  cz,
  media,
  cameraGridRef,
}: {
  cx: number;
  cy: number;
  cz: number;
  media: MediaItem[];
  cameraGridRef: React.RefObject<CameraGridState>;
}) {
  const [planes, setPlanes] = React.useState<PlaneData[] | null>(null);

  React.useEffect(() => {
    let canceled = false;
    const run = () => !canceled && setPlanes(generateChunkPlanesCached(cx, cy, cz));

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 100 });
      return () => {
        canceled = true;
        cancelIdleCallback(id);
      };
    }

    const id = setTimeout(run, 0);
    return () => {
      canceled = true;
      clearTimeout(id);
    };
  }, [cx, cy, cz]);

  if (!planes) return null;

  return (
    <group>
      {planes.map((plane) => {
        const mediaItem = media[plane.mediaIndex % media.length];
        if (!mediaItem) return null;
        return (
          <MediaPlane
            key={plane.id}
            position={plane.position}
            scale={plane.scale}
            media={mediaItem}
            chunkCx={cx}
            chunkCy={cy}
            chunkCz={cz}
            cameraGridRef={cameraGridRef}
          />
        );
      })}
    </group>
  );
}

// Consolidated input + motion state
type ControllerState = {
  velocity: { x: number; y: number; z: number };
  targetVel: { x: number; y: number; z: number };
  basePos: { x: number; y: number; z: number };
  drift: { x: number; y: number };
  mouse: { x: number; y: number };
  lastMouse: { x: number; y: number };
  scrollAccum: number;
  keys: Set<string>;
  isDragging: boolean;
  lastTouches: Touch[];
  lastTouchDist: number;
  lastChunkKey: string;
  lastChunkUpdate: number;
  pendingChunk: { cx: number; cy: number; cz: number } | null;
  fpsFrames: number;
  fpsTime: number;
};

const createInitialState = (camZ: number): ControllerState => ({
  velocity: { x: 0, y: 0, z: 0 },
  targetVel: { x: 0, y: 0, z: 0 },
  basePos: { x: 0, y: 0, z: camZ },
  drift: { x: 0, y: 0 },
  mouse: { x: 0, y: 0 },
  lastMouse: { x: 0, y: 0 },
  scrollAccum: 0,
  keys: new Set(),
  isDragging: false,
  lastTouches: [],
  lastTouchDist: 0,
  lastChunkKey: "",
  lastChunkUpdate: 0,
  pendingChunk: null,
  fpsFrames: 0,
  fpsTime: performance.now(),
});

function SceneController({
  media,
  onFpsUpdate,
  onReady,
  onTextureProgress,
}: {
  media: MediaItem[];
  onFpsUpdate?: (fps: number) => void;
  onReady?: () => void;
  onTextureProgress?: (progress: number) => void;
}) {
  const { camera, gl } = useThree();
  const isTouchDevice = useIsTouchDevice();

  const state = React.useRef<ControllerState>(createInitialState(INITIAL_CAMERA_Z));
  const cameraGridRef = React.useRef<CameraGridState>({ cx: 0, cy: 0, cz: 0, camZ: camera.position.z });

  const [chunks, setChunks] = React.useState<ChunkData[]>([]);

  const { active, progress } = useProgress();
  const readySent = React.useRef(false);
  const maxProgress = React.useRef(0);

  React.useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl]);

  React.useEffect(() => {
    const rounded = Math.round(progress);
    if (rounded > maxProgress.current) {
      maxProgress.current = rounded;
      onTextureProgress?.(rounded);
    }
  }, [progress, onTextureProgress]);

  React.useEffect(() => {
    if (chunks.length > 0 && !readySent.current && !active && progress === 100) {
      const t = setTimeout(() => {
        if (!readySent.current) {
          readySent.current = true;
          onReady?.();
        }
      }, READY_DELAY);
      return () => clearTimeout(t);
    }
  }, [chunks, onReady, active, progress]);

  // Input event handlers
  React.useEffect(() => {
    const canvas = gl.domElement;
    const s = state.current;
    canvas.style.cursor = "grab";

    const setCursor = (cursor: string) => {
      canvas.style.cursor = cursor;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      s.keys.add(e.key.toLowerCase());
      if (e.key === " ") e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => s.keys.delete(e.key.toLowerCase());

    const onMouseDown = (e: MouseEvent) => {
      s.isDragging = true;
      s.lastMouse = { x: e.clientX, y: e.clientY };
      setCursor("grabbing");
    };

    const onMouseUp = () => {
      s.isDragging = false;
      setCursor("grab");
    };

    const onMouseLeave = () => {
      s.mouse = { x: 0, y: 0 };
      s.isDragging = false;
      setCursor("grab");
    };

    const onMouseMove = (e: MouseEvent) => {
      s.mouse = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
      if (s.isDragging) {
        s.targetVel.x -= (e.clientX - s.lastMouse.x) * MOUSE_DRAG_SENSITIVITY;
        s.targetVel.y += (e.clientY - s.lastMouse.y) * MOUSE_DRAG_SENSITIVITY;
        s.lastMouse = { x: e.clientX, y: e.clientY };
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      s.scrollAccum += e.deltaY * WHEEL_SCROLL_SENSITIVITY;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      s.lastTouches = Array.from(e.touches) as Touch[];
      s.lastTouchDist = getTouchDistance(s.lastTouches);
      setCursor("grabbing");
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touches = Array.from(e.touches) as Touch[];

      if (touches.length === 1 && s.lastTouches.length >= 1) {
        const [touch] = touches;
        const [last] = s.lastTouches;
        if (touch && last) {
          s.targetVel.x -= (touch.clientX - last.clientX) * TOUCH_DRAG_SENSITIVITY;
          s.targetVel.y += (touch.clientY - last.clientY) * TOUCH_DRAG_SENSITIVITY;
        }
      } else if (touches.length === 2 && s.lastTouchDist > 0) {
        const dist = getTouchDistance(touches);
        s.scrollAccum += (s.lastTouchDist - dist) * TOUCH_PINCH_SENSITIVITY;
        s.lastTouchDist = dist;
      }

      s.lastTouches = touches;
    };

    const onTouchEnd = (e: TouchEvent) => {
      s.lastTouches = Array.from(e.touches) as Touch[];
      s.lastTouchDist = getTouchDistance(s.lastTouches);
      setCursor("grab");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl]);

  useFrame(() => {
    const s = state.current;
    const now = performance.now();

    // FPS counter
    s.fpsFrames++;
    if (now - s.fpsTime >= FPS_UPDATE_INTERVAL) {
      onFpsUpdate?.(Math.round(s.fpsFrames / ((now - s.fpsTime) / 1000)));
      s.fpsFrames = 0;
      s.fpsTime = now;
    }

    // Keyboard input
    const k = s.keys;
    if (k.has("w") || k.has("arrowup")) s.targetVel.z -= KEYBOARD_SPEED;
    if (k.has("s") || k.has("arrowdown")) s.targetVel.z += KEYBOARD_SPEED;
    if (k.has("a") || k.has("arrowleft")) s.targetVel.x -= KEYBOARD_SPEED;
    if (k.has("d") || k.has("arrowright")) s.targetVel.x += KEYBOARD_SPEED;
    if (k.has("q")) s.targetVel.y -= KEYBOARD_SPEED;
    if (k.has("e")) s.targetVel.y += KEYBOARD_SPEED;
    if (k.has(" ")) s.targetVel.z -= KEYBOARD_SPEED * SPACE_SPEED_MULTIPLIER;

    // Drift calculation
    const isZooming = Math.abs(s.velocity.z) > ZOOMING_THRESHOLD;
    const zoomFactor = clamp(s.basePos.z / ZOOM_FACTOR_BASE, ZOOM_FACTOR_MIN, ZOOM_FACTOR_MAX);
    const driftAmount = MAX_DRIFT * zoomFactor;
    const driftLerp = isZooming ? DRIFT_LERP_ZOOMING : DRIFT_LERP_NORMAL;

    if (!s.isDragging && !isTouchDevice) {
      s.drift.x = lerp(s.drift.x, s.mouse.x * driftAmount, driftLerp);
      s.drift.y = lerp(s.drift.y, s.mouse.y * driftAmount, driftLerp);
    } else {
      s.drift.x = lerp(s.drift.x, 0, driftLerp);
      s.drift.y = lerp(s.drift.y, 0, driftLerp);
    }

    // Apply scroll and clamp velocity
    s.targetVel.z += s.scrollAccum;
    s.scrollAccum *= SCROLL_ACCUM_DECAY;

    s.targetVel.x = clamp(s.targetVel.x, -MAX_VELOCITY, MAX_VELOCITY);
    s.targetVel.y = clamp(s.targetVel.y, -MAX_VELOCITY, MAX_VELOCITY);
    s.targetVel.z = clamp(s.targetVel.z, -MAX_VELOCITY, MAX_VELOCITY);

    // Lerp and apply velocity
    s.velocity.x = lerp(s.velocity.x, s.targetVel.x, VELOCITY_LERP);
    s.velocity.y = lerp(s.velocity.y, s.targetVel.y, VELOCITY_LERP);
    s.velocity.z = lerp(s.velocity.z, s.targetVel.z, VELOCITY_LERP);

    s.basePos.x += s.velocity.x;
    s.basePos.y += s.velocity.y;
    s.basePos.z += s.velocity.z;

    camera.position.set(s.basePos.x + s.drift.x, s.basePos.y + s.drift.y, s.basePos.z);

    // Decay
    s.targetVel.x *= VELOCITY_DECAY;
    s.targetVel.y *= VELOCITY_DECAY;
    s.targetVel.z *= VELOCITY_DECAY;

    // Update camera grid state
    const cx = Math.floor(s.basePos.x / CHUNK_SIZE);
    const cy = Math.floor(s.basePos.y / CHUNK_SIZE);
    const cz = Math.floor(s.basePos.z / CHUNK_SIZE);

    cameraGridRef.current = { cx, cy, cz, camZ: s.basePos.z };

    // Chunk updates with throttling
    const key = `${cx},${cy},${cz}`;
    if (key !== s.lastChunkKey) {
      s.pendingChunk = { cx, cy, cz };
      s.lastChunkKey = key;
    }

    const throttleMs = getChunkUpdateThrottleMs(isZooming, Math.abs(s.velocity.z));
    if (s.pendingChunk && shouldThrottleUpdate(s.lastChunkUpdate, throttleMs, now)) {
      const { cx: ucx, cy: ucy, cz: ucz } = s.pendingChunk;
      s.pendingChunk = null;
      s.lastChunkUpdate = now;

      setChunks(
        CHUNK_OFFSETS.map((o) => ({
          key: `${ucx + o.dx},${ucy + o.dy},${ucz + o.dz}`,
          cx: ucx + o.dx,
          cy: ucy + o.dy,
          cz: ucz + o.dz,
        }))
      );
    }
  });

  // Initialize chunks on mount
  React.useEffect(() => {
    const s = state.current;
    s.basePos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

    setChunks(
      CHUNK_OFFSETS.map((o) => ({
        key: `${o.dx},${o.dy},${o.dz}`,
        cx: o.dx,
        cy: o.dy,
        cz: o.dz,
      }))
    );
  }, [camera]);

  return (
    <>
      {chunks.map((chunk) => (
        <Chunk key={chunk.key} cx={chunk.cx} cy={chunk.cy} cz={chunk.cz} media={media} cameraGridRef={cameraGridRef} />
      ))}
    </>
  );
}

export function InfiniteCanvasScene({
  media,
  onReady,
  onTextureProgress,
  showFps = true,
  showControls = true,
  cameraFov = 60,
  cameraNear = 1,
  cameraFar = 500,
  fogNear = 120,
  fogFar = 320,
  backgroundColor = "#ffffff",
  fogColor = "#ffffff",
}: InfiniteCanvasProps) {
  const [fps, setFps] = React.useState(0);
  const isTouchDevice = useIsTouchDevice();

  const dpr = Math.min(window.devicePixelRatio || 1, isTouchDevice ? DPR_MAX_TOUCH : DPR_MAX_DESKTOP);

  if (!media.length) return null;

  return (
    <div className={styles.container}>
      <Canvas
        camera={{ position: [0, 0, INITIAL_CAMERA_Z], fov: cameraFov, near: cameraNear, far: cameraFar }}
        dpr={dpr}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        className={styles.canvas}
      >
        <color attach="background" args={[backgroundColor]} />
        <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
        <SceneController media={media} onFpsUpdate={setFps} onReady={onReady} onTextureProgress={onTextureProgress} />
      </Canvas>

      {showFps && (
        <div className={styles.infoPanel}>
          <b>{fps} FPS</b> | {media.length} Artworks
        </div>
      )}

      {showControls && (
        <div className={styles.controlsPanel}>
          {isTouchDevice ? (
            <>
              <b>Drag</b> Pan · <b>Pinch</b> Zoom
            </>
          ) : (
            <>
              <b>WASD</b> Move · <b>QE</b> Up/Down · <b>Scroll</b> Zoom
            </>
          )}
        </div>
      )}
    </div>
  );
}
