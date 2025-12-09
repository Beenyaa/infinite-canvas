"use client";

import * as React from "react";
import type { InfiniteCanvasProps } from "./scene";

const LazyInfiniteCanvasScene = React.lazy(() => import("./scene").then((mod) => ({ default: mod.InfiniteCanvasScene })));

export function InfiniteCanvas(props: InfiniteCanvasProps) {
  return (
    <React.Suspense fallback={null}>
      <LazyInfiniteCanvasScene {...props} />
    </React.Suspense>
  );
}
