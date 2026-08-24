import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  TILE_SIZE,
  lonToX,
  latToY,
  xToLon,
  yToLat,
  wrapLon,
} from "../lib/mercator";

// 开源栅格地图 —— OpenStreetMap 官方瓦片,免密钥。
//
// 为什么手写而不是引 leaflet / maplibre:本机没有可用的包管理器(npm / pnpm /
// corepack 都不存在),装不了新依赖;而 AGENTS.md §6 也要求引入新依赖前先确认。
// 瓦片地图本身就是"按 z/x/y 拼图片"这一件事,一个 <img> 网格就够,不值得为它
// 卡住整条功能。要换成 leaflet 的话,只需替换这个组件,调用方不用动。
//
// 注意 OSM 瓦片使用条款:官方瓦片仅供轻量使用,上线前应自建瓦片服务或改用
// 商业供应商。归属声明是硬性要求,固定显示在右下角。

const MIN_ZOOM = 2;
const MAX_ZOOM = 18;

type LatLon = { lat: number; lon: number };

type Props = {
  /** 地图中心。外部改变它(例如选中搜索结果)会重新定位。 */
  center: LatLon;
  /** 初始缩放级别;之后由用户操作接管。 */
  zoom?: number;
  /** 目的地标记;没有选中地点时不传。 */
  marker?: LatLon | null;
  /** 无障碍标签,说明这张地图显示的是什么。 */
  label: string;
};

export default function MapView({ center, zoom = 5, marker, label }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ ...center, zoom });

  // 外部中心变了就跟过去(选了搜索结果时),并采用调用方给的缩放级别 ——
  // 从"看世界"跳到"看一座城"需要同时改中心和 zoom,只改中心会停在世界视图。
  // 用户自己拖动/缩放不会触发这里,因为那只改 view,不改 props。
  useEffect(() => {
    setView({ lat: center.lat, lon: center.lon, zoom });
  }, [center.lat, center.lon, zoom]);

  // 瓦片网格的行列数由容器尺寸决定,所以必须实测,不能假设。
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const z = view.zoom;
  const tileCount = 2 ** z;

  // 视口左上角在"世界像素"里的位置 —— 所有瓦片和标记的定位都以它为原点。
  const centerX = lonToX(view.lon, z);
  const centerY = latToY(view.lat, z);
  const originX = centerX - w / 2;
  const originY = centerY - h / 2;

  /** 屏幕像素位移 → 新的中心经纬度。 */
  function panBy(dx: number, dy: number) {
    setView((v) => {
      const zz = v.zoom;
      const nx = lonToX(v.lon, zz) - dx;
      const ny = latToY(v.lat, zz) - dy;
      return {
        zoom: zz,
        lon: wrapLon(xToLon(nx, zz)),
        // 纬度夹住,免得拖出世界顶/底之后满屏空白。
        lat: Math.max(-85, Math.min(85, yToLat(ny, zz))),
      };
    });
  }

  function zoomBy(delta: number) {
    setView((v) => ({
      ...v,
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom + delta)),
    }));
  }

  // 拖动:指针按下后捕获,移动时按位移平移。用 pointer 事件一并覆盖鼠标和触屏。
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const from = dragRef.current;
    if (!from) return;
    panBy(e.clientX - from.x, e.clientY - from.y);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  // 键盘操作:方向键平移,+/- 缩放。地图不能只能靠拖动(无障碍要求)。
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = 80;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      panBy(move[0], move[1]);
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(1);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomBy(-1);
    }
  }

  // 覆盖视口所需的瓦片:左上角那张的索引,加上向右/下各铺一张余量。
  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  if (w > 0 && h > 0) {
    const firstX = Math.floor(originX / TILE_SIZE);
    const firstY = Math.floor(originY / TILE_SIZE);
    const cols = Math.ceil(w / TILE_SIZE) + 1;
    const rows = Math.ceil(h / TILE_SIZE) + 1;

    for (let row = 0; row < rows; row++) {
      const ty = firstY + row;
      // 纵向没有环绕:超出世界范围的行不存在,跳过。
      if (ty < 0 || ty >= tileCount) continue;
      for (let col = 0; col < cols; col++) {
        const tx = firstX + col;
        // 横向环绕,跨日期变更线时右边接上世界另一头的瓦片。
        const wrapped = ((tx % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${z}/${tx}/${ty}`,
          src: `https://tile.openstreetmap.org/${z}/${wrapped}/${ty}.png`,
          left: tx * TILE_SIZE - originX,
          top: ty * TILE_SIZE - originY,
        });
      }
    }
  }

  // 标记的屏幕位置。跨环绕时选离视口中心最近的那个世界副本,免得标记跑到屏幕外。
  let pin: { left: number; top: number } | null = null;
  if (marker) {
    const world = TILE_SIZE * tileCount;
    let mx = lonToX(marker.lon, z);
    const my = latToY(marker.lat, z);
    while (mx - centerX > world / 2) mx -= world;
    while (centerX - mx > world / 2) mx += world;
    pin = { left: mx - originX, top: my - originY };
  }

  return (
    <div className="mapview">
      <div
        ref={boxRef}
        className="mapview-canvas"
        role="application"
        aria-label={label}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {tiles.map((t) => (
          <img
            key={t.key}
            className="mapview-tile"
            src={t.src}
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="lazy"
            style={{ left: t.left, top: t.top }}
          />
        ))}

        {pin && (
          <span
            className="mapview-pin"
            aria-hidden="true"
            style={{ left: pin.left, top: pin.top }}
          />
        )}
      </div>

      <div className="mapview-zoom">
        <button
          type="button"
          onClick={() => zoomBy(1)}
          disabled={z >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          disabled={z <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* OSM 使用条款要求保留归属声明。 */}
      <p className="mapview-credit">
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
      </p>
    </div>
  );
}
