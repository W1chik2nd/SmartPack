// Web Mercator 投影 —— 瓦片地图的坐标换算。
//
// 纯数学,没有 DOM 依赖,所以能单独推理和复用。OSM 栅格瓦片用的就是这套
// (EPSG:3857):世界在 zoom z 上被切成 2^z × 2^z 张 256px 瓦片。

export const TILE_SIZE = 256;

/** zoom 下整个世界的像素宽高。 */
export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/** 经度 → 世界像素 x。 */
export function lonToX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * worldSize(zoom);
}

/** 纬度 → 世界像素 y。 */
export function latToY(lat: number, zoom: number): number {
  // 墨卡托在极点发散,先夹到瓦片体系实际覆盖的 ±85.0511°。
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  const merc = Math.log(Math.tan(rad) + 1 / Math.cos(rad));
  return ((1 - merc / Math.PI) / 2) * worldSize(zoom);
}

/** 世界像素 x → 经度。 */
export function xToLon(x: number, zoom: number): number {
  return (x / worldSize(zoom)) * 360 - 180;
}

/** 世界像素 y → 纬度。 */
export function yToLat(y: number, zoom: number): number {
  const n = Math.PI * (1 - (2 * y) / worldSize(zoom));
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

/** 经度归一化到 (-180, 180],跨越日期变更线时用。 */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}
