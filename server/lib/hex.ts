export const encodeHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex')
export const decodeHex = (hex: string) => new Uint8Array(Buffer.from(hex, 'hex'))
