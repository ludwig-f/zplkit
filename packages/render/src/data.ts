/**
 * Decoding object data from ~DY, ~DU and ~DT: ASCII hex, or base64 as
 * :B64:data:crc, or base64 of zlib-compressed data as :Z64:data:crc. The CRC
 * isn't checked: a preview should show what was meant, and lint can flag it.
 */
import { unzlibSync } from "fflate";

const decodeBase64 = (data: string): Uint8Array | undefined => {
  try {
    return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
  } catch {
    return undefined;
  }
};

const decodeObjectData = (data: string): Uint8Array | undefined => {
  const encoded = /^:([BZ])64:([^:]*)/.exec(data);
  if (encoded) {
    const bytes = decodeBase64(encoded[2]);
    if (!bytes || encoded[1] === "B") return bytes;
    try {
      return unzlibSync(bytes);
    } catch {
      return undefined;
    }
  }

  const hex = data.replace(/\s/g, "");
  if (hex.length % 2 || /[^0-9A-Fa-f]/.test(hex)) return undefined;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  }
  return bytes;
};

export { decodeObjectData };
