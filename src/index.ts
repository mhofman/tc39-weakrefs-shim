import globalAvailable from "./global/available.js";
import nodeAvailable from "./node/available.js";
import spidermonkeyAvailable from "./spidermonkey/available.js";

import { FinalizationGroup, WeakRef } from "./weakrefs.js";

function testKnownImplementationIssues(
    WeakRef: WeakRef.Constructor,
    FinalizationGroup: FinalizationGroup.Constructor
): boolean {
    try {
        const finalizationGroup = new FinalizationGroup(() => {});
        if (finalizationGroup.unregister({}) !== false) return false;
        try {
            finalizationGroup.cleanupSome(
                {} as FinalizationGroup.CleanupCallback
            );
            return false;
        } catch (err) {}
    } catch (err) {
        return false;
    }
    return true;
}

export interface Exports {
    readonly WeakRef: WeakRef.Constructor;
    readonly FinalizationGroup: FinalizationGroup.Constructor;
    readonly gc?: () => Promise<void> | void;
}

export const available =
    globalAvailable || spidermonkeyAvailable || nodeAvailable;

export async function shim(
    wrapBrokenImplementation: boolean = true
): Promise<Exports> {
    let implementation: Exports;

    if (globalAvailable) {
        implementation = await import("./global/index.js");

        if (
            wrapBrokenImplementation &&
            !testKnownImplementationIssues(
                implementation.WeakRef,
                implementation.FinalizationGroup
            )
        ) {
            implementation = (await import("./wrapper.js")).wrap(
                implementation.WeakRef,
                implementation.FinalizationGroup,
                implementation.gc
            );
        }
    } else if (spidermonkeyAvailable) {
        implementation = await import("./spidermonkey/index.js");
    } else if (nodeAvailable) {
        implementation = await import("./node/index.js");
    } else {
        implementation = { WeakRef: undefined!, FinalizationGroup: undefined! };
    }

    return implementation;
}

export interface AsyncExports extends Exports {
    readonly shim: typeof shim;
    readonly available: typeof available;
}

let asyncImportPromise: Promise<AsyncExports>;

// Easy use of the shim with dynamic import
export function then(
    onfulfilled?:
        | ((value: AsyncExports) => AsyncExports | PromiseLike<AsyncExports>)
        | null
        | undefined,
    onrejected?: ((reason: any) => PromiseLike<never>) | null | undefined
) {
    if (!asyncImportPromise)
        asyncImportPromise = shim().then(exports => ({
            shim,
            available,
            ...exports,
        }));

    return asyncImportPromise.then(onfulfilled, onrejected);
}
