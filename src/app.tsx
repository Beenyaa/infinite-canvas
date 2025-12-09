import { InfiniteCanvas } from "./infinite-canvas";

const media = [
  { seed: "next-starter-0", width: 1200, height: 800 },
  { seed: "next-starter-1", width: 800, height: 1200 },
  { seed: "next-starter-2", width: 1600, height: 900 },
  { seed: "next-starter-3", width: 900, height: 1600 },
  { seed: "next-starter-4", width: 1400, height: 1400 },
  { seed: "next-starter-5", width: 1280, height: 720 },
  { seed: "next-starter-6", width: 1024, height: 1365 },
  { seed: "next-starter-7", width: 1365, height: 1024 },
  { seed: "next-starter-8", width: 1100, height: 733 },
  { seed: "next-starter-9", width: 733, height: 1100 },
  { seed: "next-starter-10", width: 1500, height: 1000 },
  { seed: "next-starter-11", width: 1000, height: 1500 },
  { seed: "next-starter-12", width: 1920, height: 1080 },
  { seed: "next-starter-13", width: 1080, height: 1920 },
  { seed: "next-starter-14", width: 1300, height: 900 },
  { seed: "next-starter-15", width: 900, height: 1300 },
  { seed: "next-starter-16", width: 1800, height: 1200 },
  { seed: "next-starter-17", width: 1200, height: 1800 },
  { seed: "next-starter-18", width: 2048, height: 1365 },
  { seed: "next-starter-19", width: 1365, height: 2048 },
].map(({ seed, width, height }) => ({
  url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
  type: "image" as const,
}));

export function App() {
  return <InfiniteCanvas media={media} />;
}
