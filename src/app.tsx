import { InfiniteCanvas } from "~/src/infinite-canvas";

const media = [
  { seed: "0", width: 1200, height: 800 },
  { seed: "1", width: 800, height: 1200 },
  { seed: "2", width: 1600, height: 900 },
  { seed: "3", width: 900, height: 1600 },
  { seed: "4", width: 1400, height: 1400 },
  { seed: "5", width: 1280, height: 720 },
  { seed: "6", width: 1024, height: 1365 },
  { seed: "7", width: 1365, height: 1024 },
  { seed: "8", width: 1100, height: 733 },
  { seed: "9", width: 733, height: 1100 },
  { seed: "10", width: 1500, height: 1000 },
  { seed: "11", width: 1000, height: 1500 },
  { seed: "12", width: 1920, height: 1080 },
  { seed: "13", width: 1080, height: 1920 },
  { seed: "14", width: 1300, height: 900 },
  { seed: "15", width: 900, height: 1300 },
  { seed: "16", width: 1800, height: 1200 },
  { seed: "17", width: 1200, height: 1800 },
  { seed: "18", width: 2048, height: 1365 },
  { seed: "19", width: 1365, height: 2048 },
].map(({ seed, width, height }) => ({
  url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
  type: "image" as const,
}));

export function App() {
  return <InfiniteCanvas media={media} />;
}
