/** Normalize Wails / bridge byte payloads into Uint8Array. */
export function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  }
  if (Array.isArray(data)) return Uint8Array.from(data)
  if (typeof data === 'string') {
    // Wails usually sends []byte as base64; some bridges pass raw binary strings.
    try {
      const bin = atob(data)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    } catch {
      const out = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) out[i] = data.charCodeAt(i) & 0xff
      return out
    }
  }
  throw new Error('Unable to parse file bytes')
}
