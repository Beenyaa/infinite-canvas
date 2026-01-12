import React, { useEffect, useRef, useCallback } from 'react';
import {
    CHUNK_SIZE,
    RENDER_RADIUS,
    FOCAL_LENGTH,
    VELOCITY_LERP,
    VELOCITY_DECAY,
    INITIAL_CAMERA_Z,
    FADE_START_Z,
    FADE_END_Z,
} from './constants';
import type { PlaneData, Chunk, CameraState, MediaItem } from './types';
import { hashString, seededRandom, project, lerp } from './utils';
import { mediaLoader } from '../loader';

interface InfiniteCanvasProps {
    media: MediaItem[];
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({ media }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // physics and camera state kept in refs for performance
    const cameraRef = useRef<CameraState>({
        pos: { x: 0, y: 0, z: INITIAL_CAMERA_Z },
        velocity: { x: 0, y: 0, z: 0 },
        targetVel: { x: 0, y: 0, z: 0 },
        mouse: { x: 0, y: 0 },
        drift: { x: 0, y: 0 }
    });

    // track pinch
    const lastTouchDistRef = useRef<number>(0);

    const lastMouseRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const mouseDownPosRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const chunksRef = useRef<Map<string, Chunk>>(new Map());
    const keysRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
        const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    // deterministic chunk generation
    const generateChunk = useCallback((cx: number, cy: number, cz: number): Chunk => {
        const key = `${cx},${cy},${cz}`;
        const seedBase = hashString(key);
        const planes: PlaneData[] = [];

        for (let i = 0; i < 2; i++) {
            const seed = seedBase + i * 1337;
            const r = (offset: number) => seededRandom(seed + offset);

            // width is our primary scale factor
            const width = 500 + r(10) * 600;
            // default height for placeholder (4:5 ratio)
            const height = width * 1.25;

            planes.push({
                id: `${key}-${i}`,
                position: {
                    x: cx * CHUNK_SIZE + r(1) * CHUNK_SIZE,
                    y: cy * CHUNK_SIZE + r(2) * CHUNK_SIZE,
                    z: cz * CHUNK_SIZE + r(3) * CHUNK_SIZE
                },
                width,
                height,
                mediaIndex: Math.floor(r(4) * media.length),
                opacity: 0
            });
        }

        return { key, cx, cy, cz, planes };
    }, []);

    const updateChunks = useCallback(() => {
        const cam = cameraRef.current.pos;
        const cx = Math.floor(cam.x / CHUNK_SIZE);
        const cy = Math.floor(cam.y / CHUNK_SIZE);
        const cz = Math.floor(cam.z / CHUNK_SIZE);

        const newChunkKeys = new Set<string>();

        for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
            for (let dy = -RENDER_RADIUS; dy <= RENDER_RADIUS; dy++) {
                for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
                    const kx = cx + dx;
                    const ky = cy + dy;
                    const kz = cz + dz;
                    const key = `${kx},${ky},${kz}`;
                    newChunkKeys.add(key);

                    if (!chunksRef.current.has(key)) {
                        chunksRef.current.set(key, generateChunk(kx, ky, kz));
                    }
                }
            }
        }

        for (const key of chunksRef.current.keys()) {
            if (!newChunkKeys.has(key)) {
                chunksRef.current.delete(key);
            }
        }
    }, [generateChunk]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const cam = cameraRef.current;
            const keys = keysRef.current;

            // physics update
            if (keys.has('KeyW')) cam.targetVel.z += 5.0; // Inward
            if (keys.has('KeyS')) cam.targetVel.z -= 5.0; // Outward
            if (keys.has('KeyA')) cam.targetVel.x -= 3.0;
            if (keys.has('KeyD')) cam.targetVel.x += 3.0;
            if (keys.has('KeyQ')) cam.targetVel.y += 3.0; // Down (Swapped)
            if (keys.has('KeyE')) cam.targetVel.y -= 3.0; // Up (Swapped)
            if (keys.has('ShiftLeft')) cam.targetVel.z += 3.0;

            cam.velocity.x = lerp(cam.velocity.x, cam.targetVel.x, VELOCITY_LERP);
            cam.velocity.y = lerp(cam.velocity.y, cam.targetVel.y, VELOCITY_LERP);
            cam.velocity.z = lerp(cam.velocity.z, cam.targetVel.z, VELOCITY_LERP);

            cam.pos.x += cam.velocity.x;
            cam.pos.y += cam.velocity.y;
            cam.pos.z += cam.velocity.z;

            cam.targetVel.x *= VELOCITY_DECAY;
            cam.targetVel.y *= VELOCITY_DECAY;
            cam.targetVel.z *= VELOCITY_DECAY;

            // drift
            if (!isDraggingRef.current) {
                // only drift if not dragging
                const driftAmount = 80.0;
                cam.drift.x = lerp(cam.drift.x, cam.mouse.x * driftAmount, 0.05);
                cam.drift.y = lerp(cam.drift.y, cam.mouse.y * driftAmount, 0.05);
            } else {
                // return to center
                cam.drift.x = lerp(cam.drift.x, 0, 0.1);
                cam.drift.y = lerp(cam.drift.y, 0, 0.1);
            }

            // effective position
            const effectiveCamPos = {
                x: cam.pos.x + cam.drift.x,
                y: cam.pos.y + cam.drift.y,
                z: cam.pos.z
            };

            updateChunks();

            ctx.fillStyle = '#ffffffff';
            ctx.fillRect(0, 0, width, height);

            const visiblePlanes: Array<{ plane: PlaneData, proj: { x: number, y: number, scale: number }, dist: number }> = [];

            for (const chunk of chunksRef.current.values()) {
                for (const plane of chunk.planes) {
                    const proj = project(plane.position, effectiveCamPos, width, height, FOCAL_LENGTH);

                    if (proj && proj.scale > 0) {
                        const dist = plane.position.z - effectiveCamPos.z;
                        const margin = (plane.width * proj.scale) / 2;

                        if (proj.x + margin < 0 || proj.x - margin > width ||
                            proj.y + margin < 0 || proj.y - margin > height) {
                            continue;
                        }

                        visiblePlanes.push({ plane, proj, dist });
                    }
                }
            }

            visiblePlanes.sort((a, b) => b.dist - a.dist);

            visiblePlanes.forEach(({ plane, proj, dist }) => {
                let opacity = 1.0;
                if (dist > FADE_START_Z) {
                    opacity = Math.max(0, 1 - (dist - FADE_START_Z) / (FADE_END_Z - FADE_START_Z));
                }
                if (dist < 100) {
                    opacity *= Math.max(0, dist / 100);
                }

                if (opacity <= 0) return;

                const asset = media[plane.mediaIndex];
                const loadedMedia = mediaLoader.getCached(asset.url);

                let w = plane.width * proj.scale;
                let h = plane.height * proj.scale;

                // correct aspect ratio if media is loaded
                if (loadedMedia) {
                    const mWidth = (loadedMedia as HTMLImageElement).naturalWidth;
                    const mHeight = (loadedMedia as HTMLImageElement).naturalHeight;
                    if (mWidth && mHeight) {
                        const aspect = mWidth / mHeight;
                        h = w / aspect;
                    }
                }

                const x = proj.x - w / 2;
                const y = proj.y - h / 2;

                ctx.globalAlpha = opacity;

                ctx.save();
                ctx.beginPath();
                ctx.rect(x, y, w, h);
                ctx.clip();

                if (loadedMedia) {
                    ctx.drawImage(loadedMedia, x, y, w, h);
                } else {
                    ctx.fillStyle = '#111';
                    ctx.fillRect(x, y, w, h);
                    mediaLoader.getMedia(asset);
                }
                ctx.restore();

                // stroke border
                ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.15})`;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, w, h);
            });

            ctx.globalAlpha = 1;
            animationFrameId = requestAnimationFrame(render);
        };

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap dpr
            const width = window.innerWidth;
            const height = window.innerHeight;

            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        };

        window.addEventListener('resize', resize);
        resize();
        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [updateChunks]);



    const onMouseDown = (e: React.MouseEvent) => {
        isDraggingRef.current = true;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
    };

    const onMouseMove = (e: React.MouseEvent) => {
        // normalized mouse
        cameraRef.current.mouse = {
            x: (e.clientX / window.innerWidth) * 2 - 1,
            y: -(e.clientY / window.innerHeight) * 2 + 1
        };

        if (!isDraggingRef.current) return;
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;

        // sensitivity
        cameraRef.current.targetVel.x -= dx * 0.5;
        cameraRef.current.targetVel.y -= dy * 0.5;

        lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = (_: React.MouseEvent) => {
        isDraggingRef.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    };

    const onWheel = (e: React.WheelEvent) => {
        cameraRef.current.targetVel.z -= e.deltaY * 0.5;
    };

    const getTouchDistance = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            isDraggingRef.current = true;
            lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            mouseDownPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        } else if (e.touches.length === 2) {
            // start pinch
            lastTouchDistRef.current = getTouchDistance(e.touches);
            isDraggingRef.current = false; // pinch overrides drag
        }
    };

    const onTouchMove = (e: React.TouchEvent) => {
        // pinch zoom
        if (e.touches.length === 2) {
            const dist = getTouchDistance(e.touches);
            const delta = dist - lastTouchDistRef.current;

            // speed
            cameraRef.current.targetVel.z += delta * 2.0;

            lastTouchDistRef.current = dist;
            return;
        }

        if (!isDraggingRef.current || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - lastMouseRef.current.x;
        const dy = e.touches[0].clientY - lastMouseRef.current.y;
        cameraRef.current.targetVel.x -= dx * 0.8;
        cameraRef.current.targetVel.y -= dy * 0.8;
        lastMouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = (_: React.TouchEvent) => {
        isDraggingRef.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
    };

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => isDraggingRef.current = false}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="w-full h-full block touch-none cursor-grab"
            style={{ touchAction: 'none' }}
        />
    );
};
