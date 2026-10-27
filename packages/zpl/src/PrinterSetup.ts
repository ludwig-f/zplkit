import ZplContent from "./ZplContent.js";
import ZplError from "./ZplError.js";
import type { StorageDevice } from "./ast.js";
import type { StoreFontOptions, StoreGraphicOptions } from "./options.js";

class PrinterSetup extends ZplContent {
  /**
   * Set the darkness of the printer
   * @param darkness Darkness from 0 to 30
   */
  public setDarkness(darkness: number): this {
    if (darkness < 0 || darkness > 30) {
      throw new ZplError("Darkness must be between 0 and 30");
    }

    return this.add({ type: "SetDarkness", darkness: Math.round(darkness) });
  }

  /**
   * Store a graphic on the printer, to be drawn with Label.storedGraphic
   */
  public storeGraphic(options: StoreGraphicOptions): this {
    const { name, graphic, device = "R" } = options;

    if (name.length < 1 || name.length > 8) {
      throw new ZplError("Name must be between 1 and 8 characters long");
    }

    return this.add({
      type: "DownloadGraphic",
      device,
      name,
      totalBytes: graphic.totalBytes,
      bytesPerRow: graphic.bytesPerRow,
      data: graphic.data,
    });
  }

  /**
   * Store a TrueType font on the printer, to be used with
   * `text({ font: { file: "R:NAME.TTF" } })`
   */
  public storeFont(options: StoreFontOptions): this {
    const { name, data, device = "R" } = options;

    if (name.length < 1 || name.length > 8) {
      throw new ZplError("Name must be between 1 and 8 characters long");
    }

    let hex = "";
    for (const byte of data) hex += byte.toString(16).padStart(2, "0");

    return this.add({
      type: "DownloadFont",
      bounded: false,
      device,
      name,
      extension: "TTF",
      size: data.length,
      data: hex.toUpperCase(),
    });
  }

  /**
   * Delete a stored graphic from the printer
   * @param name Name of the graphic
   * @param device Device the graphic is stored on - defaults to "R" (DRAM)
   */
  public deleteGraphic(name: string, device: StorageDevice = "R"): this {
    return this.add({ type: "DeleteObject", device, name, extension: "GRF" });
  }
}

export default PrinterSetup;
