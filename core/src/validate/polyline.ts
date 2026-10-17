/** Number of vertices in an encoded polyline (precision does not change the count). */
export function polylineVertexCount(encoded: string): number {
  let index = 0;
  let count = 0;
  const readValue = (): boolean => {
    let shift = 0;
    let result = 0;
    for (;;) {
      if (index >= encoded.length) return false;
      const b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (b < 0x20) return true;
    }
  };
  while (index < encoded.length) {
    if (!readValue() || !readValue()) return -1;
    count++;
  }
  return count;
}
