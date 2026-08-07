/** Normalize Wails / bridge byte payloads into Uint8Array. */
export function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data)) return Uint8Array.from(data)
  if (typeof data === 'string') {
    const bin = atob(data)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  throw new Error('Unable to parse file bytes')
}
