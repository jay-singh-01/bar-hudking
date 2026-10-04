// A zero-JS-library location preview: a 3x3 grid of map tiles
// positioned so the pin sits dead center. The grid (768px square) always
// covers the frame for containers up to 512px wide and 344px tall.
import { TILE_CLASS, tileUrl } from "../lib/tiles";

const Z = 16;
const TILE = 256;

function project(lat: number, lng: number) {
  const n = 2 ** Z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export default function MiniMap({ lat, lng, emoji, color }: { lat: number; lng: number; emoji: string; color: string }) {
  const { x, y } = project(lat, lng);
  const xi = Math.floor(x) - 1;
  const yi = Math.floor(y) - 1;
  const px = (x - xi) * TILE;
  const py = (y - yi) * TILE;

  return (
    <div className="relative h-44 w-full overflow-hidden rounded-2xl bg-surface-2">
      <div
        className={`absolute grid grid-cols-3 ${TILE_CLASS}`}
        style={{ width: TILE * 3, left: `calc(50% - ${px}px)`, top: `calc(50% - ${py}px)` }}
      >
        {[0, 1, 2].flatMap((row) =>
          [0, 1, 2].map((col) => (
            <img
              key={`${row}-${col}`}
              src={tileUrl(Z, xi + col, yi + row)}
              alt=""
              loading="lazy"
              width={TILE}
              height={TILE}
              className="block"
            />
          )),
        )}
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[85%]">
        <div
          className="flex h-11 w-11 rotate-45 items-center justify-center rounded-full rounded-br-none border-2 border-white text-xl shadow-xl"
          style={{ background: color }}
        >
          <span className="-rotate-45">{emoji}</span>
        </div>
      </div>
      <span className="absolute right-2 bottom-1 text-[9px] text-white/50">© OpenStreetMap</span>
    </div>
  );
}
