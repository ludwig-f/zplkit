import ZplError from "./ZplError.js";
import { unknownCommands } from "./commands.js";
import { serialize } from "./serialize.js";
import { compact } from "./compact.js";
import type { Command } from "./ast.js";

/**
 * Base class for all ZPL content
 */
abstract class ZplContent {
  protected readonly nodes: Command[] = [];
  protected readonly minify: boolean;

  constructor(options?: { minify?: boolean }) {
    this.minify = options?.minify ?? true;
  }

  /**
   * The content as ZPL command nodes
   */
  public get commands(): readonly Command[] {
    return [...this.nodes];
  }

  /**
   * Add command nodes. Undefined parameters are dropped.
   * @param commands Commands to add
   */
  public add(...commands: Command[]): this {
    this.nodes.push(...commands.map(compact));

    return this;
  }

  /**
   * Add a raw ZPL command
   * @param zpl Any valid ZPL command
   */
  public raw(zpl: string): this {
    return this.add({ type: "Raw", zpl });
  }

  /**
   * @returns The generated ZPL
   */
  public toZPL(): string {
    return serialize(this.nodes, { minify: this.minify });
  }

  /**
   * Validate the generated ZPL
   * @param strict Whether to throw an error if using an unknown ZPL command. Set to `false` if you want to use commands that are not yet supported in this library.
   */
  public validate(strict = true): void {
    if (this.nodes.length === 0) {
      throw new ZplError("ZPL content is empty");
    }

    if (!strict) {
      return;
    }

    for (const node of this.nodes) {
      if (node.type !== "Raw") {
        continue;
      }

      const [unknown] = unknownCommands(node.zpl);

      if (unknown) {
        throw new ZplError(`Invalid ZPL command: ${unknown}`);
      }
    }
  }
}

export default ZplContent;
