import { setImmediate } from "../src/utils/tasks/setImmediate.js";
import { available as weakrefsAvailable } from "../src/index.js";
import globalWeakrefsAvailable from "../src/global/available.js";
import nodeStubAvailable from "../src/node/available.js";

import { FinalizationGroup } from "../src/weakrefs.js";

declare const gc: () => void;

function taskTurn(): Promise<undefined> {
    return new Promise(resolve => setImmediate(resolve));
}

export function getTimeoutCanceller(timeout: number): Promise<false> {
    return new Promise(resolve => setTimeout(() => resolve(false), timeout));
}

export function makeGcOf(
    gc: () => void,
    FinalizationGroup: FinalizationGroup.Constructor
) {
    function makeObserver(): [Promise<true>, FinalizationGroup<any>] {
        let resolve: (collected: true) => void;
        const collected = new Promise<true>(r => (resolve = r));
        const finalizationGroup = new FinalizationGroup<any>(items => {
            // Let's be nice and cleanup
            [...items];
            resolve(true);
        });
        return [collected, finalizationGroup];
    }

    return async function gcOfWithCancellation(
        target?: object,
        cancelPromise?: Promise<false>
    ): Promise<boolean> {
        // Avoid creating a closure which may captures target
        const [collected, finalizationGroup] = makeObserver();
        finalizationGroup.register(target || {}, 0);
        target = undefined;

        // Need to run gc on next task, as it often cannot run multiple times per task
        // Also need to allow caller to remove its own target references before calling gc
        await taskTurn();
        gc();
        return await Promise.race(
            cancelPromise ? [collected, cancelPromise] : [collected]
        );
    };
}

export function makeAggressiveGcOf(
    gc: () => void,
    FinalizationGroup: FinalizationGroup.Constructor
) {
    function makeObserver(): [Promise<true>, FinalizationGroup<any>] {
        let resolve: (collected: true) => void;
        const collected = new Promise<true>(r => (resolve = r));
        const finalizationGroup = new FinalizationGroup<any>(items => {
            // Let's be nice and cleanup
            [...items];
            resolve(true);
        });
        return [collected, finalizationGroup];
    }

    return async function gcOfWithCancellation(
        target?: object,
        cancelPromise?: Promise<false>
    ): Promise<boolean> {
        const [collected, finalizationGroup] = makeObserver();
        finalizationGroup.register(target || {}, 0);
        target = undefined;

        let result: boolean | undefined;
        // Careful to no move the await into the while body
        // see https://bugs.chromium.org/p/v8/issues/detail?id=9101
        while (
            (result = await Promise.race(
                cancelPromise
                    ? [collected, cancelPromise, taskTurn()]
                    : [collected, taskTurn()]
            )) === undefined
        ) {
            gc();
        }

        return result;
    };
}

export function gcTask() {
    return new Promise<void>(resolve =>
        setImmediate(() => {
            if (gcAvailable) gc();
            resolve();
        })
    );
}

export const gcAvailable = typeof gc == "function";

const globalGc = gcAvailable ? gc : undefined;
export { globalGc as gc };

// Uses any shim available
export const gcOfPromise =
    gcAvailable && weakrefsAvailable
        ? (async () => {
              const { FinalizationGroup } = await import("../src/index.js");

              return makeGcOf(gc, FinalizationGroup);
          })()
        : undefined;

// Uses the primitives of the platform
// Or the shim if available
export const gcOfRawPromise =
    weakrefsAvailable && gcAvailable
        ? (async () => {
              let weakrefs;
              if (globalWeakrefsAvailable) {
                  weakrefs = import("../src/global/index.js");
              } else if (nodeStubAvailable) {
                  weakrefs = import("../src/node/stub.js");
              } else if (weakrefsAvailable) {
                  weakrefs = import("../src/index.js");
              } else {
                  throw new Error("Implementation not available");
              }

              const { FinalizationGroup } = await weakrefs;

              return makeGcOf(gc, FinalizationGroup);
          })()
        : undefined;
