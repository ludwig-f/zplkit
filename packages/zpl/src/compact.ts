/**
 * Remove undefined properties, so command nodes have one canonical shape
 * whether an optional parameter was left out or set to undefined
 */
const compact = <T extends object>(value: T): T =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;

export { compact };
