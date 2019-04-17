declare var nondeterministicGetWeakMapKeys: <T extends object = object>(
    weakMap: WeakMap<T, any>
) => Array<T>;

export default typeof nondeterministicGetWeakMapKeys == "function";
