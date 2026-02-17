/**
 * Deep merges `source` into `target`, returning a new object.
 * - `null` values in source delete the corresponding key.
 * - Nested objects are merged recursively.
 * - Arrays are NOT supported (replaced as-is, per WebSim spec).
 */
export function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>
): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === null) {
      delete result[key];
    } else if (
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
