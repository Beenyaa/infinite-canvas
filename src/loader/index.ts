import type { MediaItem } from '../infinite-canvas/types';

class MediaLoader {
    private cache: Map<string, HTMLImageElement> = new Map();
    private loading: Map<string, Promise<HTMLImageElement | null>> = new Map();
    private failed: Set<string> = new Set();

    async getMedia(asset: MediaItem): Promise<HTMLImageElement | null> {
        const url = asset.url;
        if (this.cache.has(url)) return this.cache.get(url)!;
        if (this.loading.has(url)) return this.loading.get(url)!;
        if (this.failed.has(url)) return null;

        const promise = (async () => {
            try {
                const result = await this.loadImage(url);

                this.cache.set(url, result);
                this.loading.delete(url);
                return result;
            } catch (err) {
                console.warn(`Failed to load image: ${url}`);
                this.loading.delete(url);
                this.failed.add(url);
                return null;
            }
        })();

        this.loading.set(url, promise);
        return promise;
    }

    private loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = (_) => reject(new Error(`Image load error for ${url}`));
            img.src = url;
        });
    }



    getCached(url: string): HTMLImageElement | null {
        return this.cache.get(url) || null;
    }
}

export const mediaLoader = new MediaLoader();
