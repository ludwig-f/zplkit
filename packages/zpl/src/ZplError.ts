class ZplError extends Error {
  constructor(message: string) {
    super(`[ZPL Error]: ${message}`);
    this.name = "ZplError";
  }
}

export default ZplError;
