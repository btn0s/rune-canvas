import { Analytics } from "@vercel/analytics/react";
import { Canvas } from "./components/Canvas";

export function App() {
  return (
    <div className="dark h-full w-full overflow-hidden">
      <Canvas />
      <Analytics />
    </div>
  );
}


