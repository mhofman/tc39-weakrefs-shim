import { createWeakRefJobsForTaskQueue } from "./internal/WeakRefJobs.js";
import { createFinalizationGroupJobsForTaskQueue } from "./internal/FinalizationGroupJobs.js";
import { setImmediate } from "./utils/tasks/setImmediate.js";
import { createWeakRefClassShim } from "./internal/WeakRef.js";
import { createFinalizationGroupClassShim } from "./internal/FinalizationGroup.js";

import { FinalizationGroup, WeakRef } from "./weakrefs.js";

export function wrap(
    WeakRef: WeakRef.Constructor,
    FinalizationGroup: FinalizationGroup.Constructor
): {
    WeakRef: WeakRef.Constructor;
    FinalizationGroup: FinalizationGroup.Constructor;
} {
    const refCollector = new WeakMap<object, WeakRef>();

    // Track the alive refs to avoid unnecessary deref() calls
    // which make the agent keep the object for the job
    // Also used in case unregister doesn't work
    const aliveRefs = new Set<WeakRef>();

    const finalizationGroup = new FinalizationGroup(items => {
        for (const item of items) {
            if (aliveRefs.has(item)) {
                finalizationGroupJobs.setFinalized(item);
                aliveRefs.delete(item);
            }
        }
    });

    function getRef(target: object) {
        let ref = refCollector.get(target);
        if (!ref) {
            ref = new WeakRef(target);
            refCollector.set(target, ref);
        }
        return ref;
    }

    const finalizationGroupJobs = createFinalizationGroupJobsForTaskQueue<
        WeakRef
    >(setImmediate, {
        registerObjectInfo: ref => {
            finalizationGroup.register(ref.deref()!, ref, ref);
            aliveRefs.add(ref);
        },
        unregisterObjectInfo: ref => {
            finalizationGroup.unregister(ref);
            aliveRefs.delete(ref);
        },
    });

    const [WrappedWeakRef] = createWeakRefClassShim(
        createWeakRefJobsForTaskQueue(setImmediate),
        getRef,
        ref => ref.deref()
    );

    return {
        WeakRef: WrappedWeakRef,
        FinalizationGroup: createFinalizationGroupClassShim(
            finalizationGroupJobs,
            getRef,
            ref => aliveRefs.has(ref)
        ),
    };
}
