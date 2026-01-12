import manifest from '../../public/artworks/manifest.json';
import type { MediaItem } from '../infinite-canvas/types';

export const MIXED_MEDIA: MediaItem[] = manifest.map(item => ({
    type: 'image',
    url: item.url,
}));

export type { MediaItem };
