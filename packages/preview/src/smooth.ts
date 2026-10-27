/**
 * Blend an anti-aliased grayscale render with the printer's 1-bit version of
 * it, in place. The printer's dots are the grayscale image cut at 50%.
 *
 * @param data RGBA pixels of a grayscale image
 * @param amount 0 for the printer's dots, 1 for full anti-aliasing
 */
const smooth = (data: Uint8ClampedArray, amount: number): void => {
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index];
    const dot = gray < 128 ? 0 : 255;
    const value = amount * gray + (1 - amount) * dot;

    data[index] = data[index + 1] = data[index + 2] = value;
  }
};

/**
 * Apply smooth() to a base64 PNG using a canvas. Returns the image unchanged
 * where there is no canvas, or if it can't be decoded.
 */
const smoothPng = async (png: string, amount: number): Promise<string> => {
  const source = `data:image/png;base64,${png}`;

  try {
    const image = new Image();
    image.src = source;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");

    if (!context || !canvas.width || !canvas.height) {
      return source;
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    smooth(pixels.data, amount);
    context.putImageData(pixels, 0, 0);

    return canvas.toDataURL("image/png");
  } catch {
    return source;
  }
};

export { smooth, smoothPng };
