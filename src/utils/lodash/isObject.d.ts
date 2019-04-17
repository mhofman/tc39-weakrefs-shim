/**
 * Checks if value is the language type of Object. (e.g. arrays, functions, objects, regexes, new Number(0),
 * and new String(''))
 *
 * @param value The value to check.
 * @return Returns true if value is an object, else false.
 */
declare function isObject(value?: any): value is object;

export default isObject;
