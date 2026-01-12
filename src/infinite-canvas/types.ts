export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

export type MediaType = 'image' | 'video';

export interface PlaneData {
    id: string;
    position: Vector3;
    width: number;
    height: number;
    mediaIndex: number;
    opacity: number;
}

export interface Chunk {
    key: string;
    cx: number;
    cy: number;
    cz: number;
    planes: PlaneData[];
}

export interface CameraState {
    pos: Vector3;
    velocity: Vector3;
    targetVel: Vector3;
    mouse: { x: number; y: number };
    drift: { x: number; y: number };
}
