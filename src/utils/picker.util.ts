/**
 * Picker utility function to extract specific keys from an object
 * @param obj - The source object
 * @param keys - Array of keys to extract
 * @returns Partial object with only the specified keys
 */
const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Partial<T> => {
  const finalObj: Partial<T> = {};

  for (const key of keys) {
    if (obj && Object.hasOwnProperty.call(obj, key)) {
      if (obj[key]) {
        finalObj[key] = obj[key];
      }
    }
  }
  return finalObj;
};

export default pick;
