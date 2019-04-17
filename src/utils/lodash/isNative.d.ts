/**
 * Checks if value is a native function.
 * @param value The value to check.
 *
 * @return Returns true if value is a native function, else false.
 */
declare function isNative(value: any): value is (...args: any[]) => any;

export default isNative;
