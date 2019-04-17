export type immediateId = any;

declare function setImmediate(
    callback: (...args: any[]) => void,
    ...args: any[]
): immediateId;
declare function clearImmediate(immediateId: immediateId): void;

export const available = typeof setImmediate == "function";

export function shim() {
    const globalSetImmediate = available ? setImmediate : undefined!;
    const globalClearImmediate = available ? clearImmediate : undefined!;

    return {
        setImmediate: globalSetImmediate,
        clearImmediate: globalClearImmediate,
    };
}
