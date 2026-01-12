import type { Vector3 } from './types';

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash;
};

// seeded random number generator
export const seededRandom = (seed: number): number => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

export const project = (
    pos: Vector3,
    camera: Vector3,
    width: number,
    height: number,
    focalLength: number
) => {
    const relativeZ = pos.z - camera.z;

    // culling for items behind camera or too far
    if (relativeZ <= 10) return null;

    const scale = focalLength / relativeZ;
    const x = (pos.x - camera.x) * scale + width / 2;
    const y = (pos.y - camera.y) * scale + height / 2;

    return { x, y, scale };
};
