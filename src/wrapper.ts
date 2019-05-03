import { Agent } from "./internal/Agent.js";
import { makeAgentFinalizationJobScheduler } from "./internal/AgentFinalizationJobScheduler.js";
import { setImmediate, clearImmediate } from "./utils/tasks/setImmediate.js";
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
    let finalizedRefs = new Set<WeakRef>();

    const finalizationGroup = new FinalizationGroup(items => {
        for (const item of items) {
            if (aliveRefs.has(item)) {
                finalizedRefs.add(item);
                aliveRefs.delete(item);
            }
        }
        updatePendingTask(true);
    });

    function getRef(target: object) {
        let ref = refCollector.get(target);
        if (!ref) {
            ref = new WeakRef(target);
            refCollector.set(target, ref);
        }
        return ref;
    }

    const agent = new Agent<WeakRef>(
        () => {
            const finalized = finalizedRefs;
            finalizedRefs = new Set();
            return finalized;
        },
        {
            registerObjectInfo: ref => {
                finalizationGroup.register(ref.deref()!, ref, ref);
                aliveRefs.add(ref);
            },
            unregisterObjectInfo: ref => {
                finalizationGroup.unregister(ref);
                aliveRefs.delete(ref);
            },
            holdObject: () => {
                updatePendingTask();
            },
            releaseObject: () => {
                if (!agent.isKeepingObjects) updatePendingTask();
            },
        }
    );

    const updatePendingTask = makeAgentFinalizationJobScheduler(
        agent,
        setImmediate,
        clearImmediate
    );

    const [WrappedWeakRef] = createWeakRefClassShim(agent, getRef, ref =>
        ref.deref()
    );

    return {
        WeakRef: WrappedWeakRef,
        FinalizationGroup: createFinalizationGroupClassShim(
            agent,
            getRef,
            ref => aliveRefs.has(ref)
        ),
    };
}
