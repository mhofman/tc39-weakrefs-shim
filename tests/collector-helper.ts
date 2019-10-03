import { setImmediate } from "../src/utils/tasks/setImmediate.js";

import { FinalizationGroup } from "../src/weakrefs.js";

export function clearKeptObjects(): Promise<undefined> {
    return new Promise(resolve => setImmediate(resolve));
}

/**
 * Trigger an asynchronous garbage collection and wait until a target is collected
 *
 * The garbage collection is never executed synchronously. It is performed
 * on the next micro-task of after a user-specified trigger.
 *
 * The function completes after the garbage collection was performed.
 *
 * @remarks
 * The function verifies collection immediately after triggering collection
 * and will complete without the microtask queue draining.
 *
 * @param target - The object whose collection to determine. If not provided,
 *                 collection is determined by a placeholder object.
 * @param trigger - Wait for the specified trigger before triggering collection.
 *                  If not provided, collection is triggered on the next microtask.
 * @returns `true` if the target was collected, `false` if it wasn't
 * @throws         if collection couldn't be performed
 */
export interface AsyncGc {
    (target?: object, trigger?: Promise<any>): Promise<boolean>;
}

export function makeAsyncGc(
    gc: () => Promise<any> | void,
    FinalizationGroup: FinalizationGroup.Constructor
): AsyncGc | undefined {
    type Holdings = { collected: boolean };

    function makeFinalizationGroup() {
        try {
            return new FinalizationGroup<Holdings>(holdings => {
                for (const holding of holdings) {
                    holding.collected = true;
                }
            });
        } catch (error) {
            return undefined;
        }
    }

    const finalizationGroup = makeFinalizationGroup();

    return !finalizationGroup
        ? undefined
        : function asyncGc(
              target?: object,
              trigger?: Promise<any>
          ): Promise<boolean> {
              let checker = {};

              const checkerHolding = {
                  collected: false,
              };

              const holding =
                  target != null ? { collected: false } : checkerHolding;
              finalizationGroup.register(target || checker, holding, holding);
              finalizationGroup.register(
                  checker,
                  checkerHolding,
                  checkerHolding
              );

              target = checker = undefined!;

              return Promise.resolve(trigger)
                  .then(() => {
                      // gc() may return a promise that signals asynchronous completion
                      return gc();
                  })
                  .then(() => {
                      try {
                          finalizationGroup.cleanupSome();

                          finalizationGroup.unregister(checkerHolding);
                          finalizationGroup.unregister(holding);
                      } catch (err) {}

                      if (!checkerHolding.collected) {
                          return Promise.reject(
                              new Error("Couldn't collect checker")
                          );
                      }

                      return holding.collected;
                  });
          };
}
