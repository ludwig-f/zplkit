import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import ZplError from "./ZplError.js";

/** Decoded pixels, four bytes (red, green, blue, alpha) each, like ImageData */
type Pixels = {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Red, green, blue and alpha for each pixel, row by row */
  data: ArrayLike<number>;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Decode a PNG or JPEG file into pixels */
const decode = (file: Uint8Array): Pixels => {
  const buffer = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (PNG_SIGNATURE.every((byte, i) => buffer[i] === byte)) {
    return PNG.sync.read(buffer);
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return jpeg.decode(buffer, { useTArray: true });
  }
  throw new ZplError("Images must be PNG or JPEG files");
};

const zplMapCodes = {
  1: "G",
  2: "H",
  3: "I",
  4: "J",
  5: "K",
  6: "L",
  7: "M",
  8: "N",
  9: "O",
  10: "P",
  11: "Q",
  12: "R",
  13: "S",
  14: "T",
  15: "U",
  16: "V",
  17: "W",
  18: "X",
  19: "Y",
  20: "g",
  40: "h",
  60: "i",
  80: "j",
  100: "k",
  120: "l",
  140: "m",
  160: "n",
  180: "o",
  200: "p",
  220: "q",
  240: "r",
  260: "s",
  280: "t",
  300: "u",
  320: "v",
  340: "w",
  360: "x",
  380: "y",
  400: "z",
} as const;

/** Converts PNG and JPEG images to ZPL graphics */
class ImageConverter {
  /** Compress the hex data with Zebra's run-length scheme, on by default */
  public compress = true;
  private blackLimit = 128;

  /** How dark a pixel must be to print, in percent; 50 by default */
  public get blacknessLimitPercentage(): number {
    return (this.blackLimit * 100) / 255;
  }

  public set blacknessLimitPercentage(blacknessLimitPercentage: number) {
    this.blackLimit = (blacknessLimitPercentage * 255) / 100;
  }

  /**
   * Convert an image to a ZPL graphic
   * @param image A PNG or JPEG file, or decoded pixels such as a canvas's ImageData
   */
  public async toZPL(image: Uint8Array | Pixels): Promise<ZplImage> {
    const pixels = image instanceof Uint8Array ? decode(image) : image;
    const { width, height } = pixels;
    const bytesPerRow = Math.ceil(width / 8);
    const totalBytes = bytesPerRow * height;

    let data = "";

    for (let y = 0; y < height; y++) {
      let rowByteString = "";
      for (let x = 0; x < width; x += 8) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          if (x + bit < width) {
            const i = (y * width + x + bit) * 4;
            const { data } = pixels;
            const grayscale =
              0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
            const isBlack = grayscale < this.blackLimit;
            const isTransparent = data[i + 3] === 0;
            if (isBlack && !isTransparent) {
              byte |= 1 << (7 - bit);
            }
          }
        }
        rowByteString += byte.toString(16).padStart(2, "0");
      }
      data += rowByteString + "\n";
    }

    return {
      width: width,
      height: height,
      totalBytes: totalBytes,
      bytesPerRow: bytesPerRow,
      data: this.compress ? this.encodeHexAscii(data) : data,
    };
  }

  private getEncodedString(counter: number, char: string): string {
    let encodedString = "";

    while (counter > 0) {
      // Find the largest number in zplMapCodes that's less than or equal to counter
      const keys = Object.keys(zplMapCodes)
        .map((k) => parseInt(k))
        .sort((a, b) => b - a);
      let key = keys.find((k) => k <= counter);
      if (!key) {
        key = 1;
      }

      const keyIsMapCode = (key: number): key is keyof typeof zplMapCodes =>
        key in zplMapCodes;

      if (!keyIsMapCode(key)) {
        throw new ZplError(`Key ${key} is not a valid map code`);
      }

      // Add the corresponding ZPL code to the encoded string
      encodedString += zplMapCodes[key];

      // Subtract the key from the counter
      counter -= key;
    }

    // Add the character to the encoded string
    encodedString += char;

    return encodedString;
  }

  private encodeHexAscii(code: string): string {
    let codeBuffer = "";
    let counter = 1;
    let currentChar = code.charAt(0);

    for (let i = 1; i < code.length; i++) {
      if (code.charAt(i) === "\n") {
        if (counter > 0) {
          codeBuffer += this.getEncodedString(counter, currentChar);
        }
        counter = 1;
        currentChar = code.charAt(i + 1);
        i++; // Skip the next character because we've already processed it
      } else if (currentChar === code.charAt(i)) {
        counter++;
      } else {
        codeBuffer += this.getEncodedString(counter, currentChar);
        counter = 1;
        currentChar = code.charAt(i);
      }
    }

    // Handle the last sequence of characters
    if (counter > 0) {
      codeBuffer += this.getEncodedString(counter, currentChar);
    }

    return codeBuffer;
  }
}

/** A ZPL graphic, ready for `graphic()` or `PrinterSetup.storeGraphic()` */
type ZplImage = {
  /** Width in dots */
  width: number;
  /** Height in dots */
  height: number;
  /** Size of the graphic data in bytes */
  totalBytes: number;
  /** Bytes in each row, 8 dots to a byte */
  bytesPerRow: number;
  /** The graphic as hex, compressed when `compress` is on */
  data: string;
};

export default ImageConverter;
export { zplMapCodes };
export type { Pixels, ZplImage };
