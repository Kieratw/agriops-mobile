export type Position = [number, number];
export type Polygon = { type: 'Polygon'; coordinates: Position[][] };
export type MultiPolygon = { type: 'MultiPolygon'; coordinates: Position[][][] };
export type FieldGeometry = Polygon | MultiPolygon;

// GeoJSON z API używa WGS84: [długość, szerokość].
export function parseFieldGeometry(value: unknown): FieldGeometry | null {
  if (typeof value !== 'string' || !value || value.length > 2_000_000) return null;
  let data: unknown;
  try { data = JSON.parse(value); } catch { return null; }
  if (!data || typeof data !== 'object' || !('type' in data) || !('coordinates' in data)) return null;

  let points = 0;
  function polygon(input: unknown): Position[][] | null {
    if (!Array.isArray(input) || !input.length || input.length > 256) return null;
    const rings: Position[][] = [];
    for (const ring of input) {
      if (!Array.isArray(ring) || ring.length < 4 || points + ring.length > 50_000) return null;
      const positions: Position[] = [];
      for (const point of ring) {
        if (!Array.isArray(point) || point.length < 2) return null;
        const [lon, lat] = point;
        if (typeof lon !== 'number' || typeof lat !== 'number' ||
          !Number.isFinite(lon) || !Number.isFinite(lat) ||
          lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
        positions.push([lon, lat]);
      }
      const first = positions[0];
      const last = positions[positions.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) return null;
      points += positions.length;
      rings.push(positions);
    }
    return rings;
  }

  if (data.type === 'Polygon') {
    const coordinates = polygon(data.coordinates);
    return coordinates ? { type: 'Polygon', coordinates } : null;
  }
  if (data.type === 'MultiPolygon') {
    if (!Array.isArray(data.coordinates) || !data.coordinates.length || data.coordinates.length > 128) return null;
    const coordinates: Position[][][] = [];
    for (const part of data.coordinates) {
      const parsed = polygon(part);
      if (!parsed) return null;
      coordinates.push(parsed);
    }
    return { type: 'MultiPolygon', coordinates };
  }
  return null;
}

const earthRadiusMeters = 6_378_137;

function toLocalMeters(lon: number, lat: number, originLon: number, originLat: number): [number, number] {
  const x = earthRadiusMeters * ((lon - originLon) * Math.PI / 180) * Math.cos(originLat * Math.PI / 180);
  const y = earthRadiusMeters * ((lat - originLat) * Math.PI / 180);
  return [x, y];
}

function pointInRing(x: number, y: number, ring: Position[], originLon: number, originLat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = toLocalMeters(ring[i][0], ring[i][1], originLon, originLat);
    const [xj, yj] = toLocalMeters(ring[j][0], ring[j][1], originLon, originLat);
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToRingMeters(ring: Position[], originLon: number, originLat: number): number {
  let minDistanceSq = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = toLocalMeters(ring[i][0], ring[i][1], originLon, originLat);
    const [bx, by] = toLocalMeters(ring[i + 1][0], ring[i + 1][1], originLon, originLat);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((-ax * dx) + (-ay * dy)) / lengthSq)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    const distSq = px * px + py * py;
    if (distSq < minDistanceSq) minDistanceSq = distSq;
  }
  return Math.sqrt(minDistanceSq);
}

function pointInPolygonRings(rings: Position[][], lat: number, lon: number, toleranceMeters: number): boolean {
  const [outer, ...holes] = rings;
  if (!outer) return false;
  const inOuter = pointInRing(0, 0, outer, lon, lat);
  if (inOuter) {
    for (const hole of holes) {
      if (pointInRing(0, 0, hole, lon, lat) && distanceToRingMeters(hole, lon, lat) > toleranceMeters) {
        return false;
      }
    }
    return true;
  }
  return distanceToRingMeters(outer, lon, lat) <= toleranceMeters;
}

export function isPointInsideField(
  geometry: FieldGeometry | null,
  latitude: number,
  longitude: number,
  toleranceMeters = 5,
): boolean {
  if (!geometry || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }
  if (geometry.type === 'Polygon') {
    return pointInPolygonRings(geometry.coordinates, latitude, longitude, toleranceMeters);
  }
  return geometry.coordinates.some(rings => pointInPolygonRings(rings, latitude, longitude, toleranceMeters));
}
