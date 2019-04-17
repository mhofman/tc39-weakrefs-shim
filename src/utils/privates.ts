export interface Privates<T, U extends object> {
    (instance: U): T;
    <V extends T>(instance: U): V;
    init(instance: U, privates: T): void;
    init<V extends T>(instance: U, privates: V): void;
}

export default function makePrivates<T, U extends object>(): Privates<T, U> {
    const privates = new WeakMap<U, T>();
    function get<V extends T>(instance: U): V {
        if (!privates.has(instance)) throw new Error("Invalid object");
        return (privates.get(instance)! as unknown) as V;
    }
    get.init = function init<V extends T>(instance: U, data: V): void {
        if (privates.has(instance)) throw new Error("Invalid object");
        privates.set(instance, data);
    };
    return get;
}
