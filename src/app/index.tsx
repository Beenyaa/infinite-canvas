import React from 'react';
import { Frame } from '../frame';
import { InfiniteCanvas } from '../infinite-canvas';
import { MIXED_MEDIA } from '../artworks';

export const App: React.FC = () => {
    return (
        <div className="relative w-full h-screen overflow-hidden select-none bg-black">
            <InfiniteCanvas media={MIXED_MEDIA} />
            <Frame />
        </div>
    );
};
