import ZplContent from "./ZplContent.js";
import ZplError from "./ZplError.js";
import type { StorageDevice } from "./ast.js";
import type { StoreFontOptions, StoreGraphicOptions } from "./options.js";

/**
 * Commands that change the printer itself rather than one label. They stay
 * in effect for every label printed after, also labels sent later from
 * other software, until they're changed again. Send them before the labels
 * they're for, for example in a PrintJob.
 */
class PrinterSetup extends ZplContent {
  /**
   * Set the printer's darkness (~SD) for every label printed after, until
   * it's set again. For one label only, use the label's `darkness` option.
   * @param darkness Darkness from 0 to 30
   */
  public setDarkness(darkness: number): this {
    if (darkness < 0 || darkness > 30) {
      throw new ZplError("Darkness must be between 0 and 30");
    }

    return this.add({ type: "SetDarkness", darkness: Math.round(darkness) });
  }

  /**
   * Move every field of the labels that follow left, or right when
   * negative (^LS), for a printer whose labels sit a little off. The
   * printer keeps it until it's set again.
   * @param dots Dots to move, -9999 to 9999
   */
  public setLabelShift(dots: number): this {
    if (!Number.isInteger(dots) || Math.abs(dots) > 9999) {
      throw new ZplError(
        `Label shift must be a whole number of dots from -9999 to 9999, got ${dots}`
      );
    }
    return this.add(
      { type: "StartFormat" },
      { type: "LabelShift", shift: dots },
      { type: "EndFormat" }
    );
  }

  /**
   * Move every field of the labels that follow down, or up when negative
   * (^LT). The printer keeps it until it's set again.
   * @param dots Dots to move, -120 to 120
   */
  public setLabelTop(dots: number): this {
    if (!Number.isInteger(dots) || Math.abs(dots) > 120) {
      throw new ZplError(
        `Label top must be a whole number of dots from -120 to 120, got ${dots}`
      );
    }
    return this.add(
      { type: "StartFormat" },
      { type: "LabelTop", offset: dots },
      { type: "EndFormat" }
    );
  }

  /**
   * Print the labels that follow as their mirror image (^PM), for clear
   * media printed from the back. The printer keeps it until it's set again.
   * @param mirror Whether to mirror labels
   */
  public setMirror(mirror: boolean): this {
    return this.add(
      { type: "StartFormat" },
      { type: "PrintMirror", mirror },
      { type: "EndFormat" }
    );
  }

  /**
   * Store a graphic on the printer (~DG), to be drawn with
   * Label.storedGraphic. It stays until it's deleted with deleteGraphic:
   * on R: (memory) until the printer turns off, on E: (flash) for good.
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
   * Store a TrueType font on the printer (~DU), to be used with
   * `text({ font: { file: "R:NAME.TTF" } })`. It stays on R: (memory) until
   * the printer turns off, and on E: (flash) for good.
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
   * Delete a stored graphic from the printer (^ID)
   * @param name Name of the graphic
   * @param device Device the graphic is stored on - defaults to "R" (DRAM)
   */
  public deleteGraphic(name: string, device: StorageDevice = "R"): this {
    return this.add({ type: "DeleteObject", device, name, extension: "GRF" });
  }
}

export default PrinterSetup;
