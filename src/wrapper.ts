import { createWeakRefJobsForTaskQueue } from "./internal/WeakRefJobs.js";
import { createFinalizationGroupJobsForTaskQueue } from "./internal/FinalizationGroupJobs.js";
import { setImmediate } from "./utils/tasks/setImmediate.js";
import { createWeakRefClassShim } from "./internal/WeakRef.js";
import { createFinalizationGroupClassShim } from "./internal/FinalizationGroup.js";

import { FinalizationGroup, WeakRef } from "./weakrefs.js";

class ObjectInfo {
    ref: WeakRef | undefined;
    alive: boolean | undefined;
}

export function wrap(
    WeakRef: WeakRef.Constructor,
    FinalizationGroup: FinalizationGroup.Constructor
): {
    WeakRef: WeakRef.Constructor;
    FinalizationGroup: FinalizationGroup.Constructor;
} {
    const infos = new WeakMap<object, ObjectInfo>();

    const finalizationGroup = new FinalizationGroup<ObjectInfo, ObjectInfo>(
        items => {
            for (const item of items) {
                if (item.alive) {
                    item.alive = false;
                    finalizationGroupJobs.setFinalized(item);
                }
            }
        }
    );

    function getInfo(target: object) {
        let info = infos.get(target);
        if (!info) {
            info = new ObjectInfo();
            infos.set(target, info);
        }
        return info;
    }

    function getInfoWithRef(target: object) {
        let info = getInfo(target);
        if (!info.ref) {
            info.ref = new WeakRef(target);
        }
        return info;
    }

    function getInfoWithRegistration(target: object) {
        let info = getInfo(target);
        if (info.alive === undefined) {
            finalizationGroup.register(target, info, info);
            info.alive = true;
        }
        return info;
    }

    const finalizationGroupJobs = createFinalizationGroupJobsForTaskQueue<
        ObjectInfo
    >(setImmediate, {
        unregisterObjectInfo: info => {
            if (info.alive) finalizationGroup.unregister(info);
            info.alive = undefined;
        },
    });

    const [WrappedWeakRef] = createWeakRefClassShim(
        createWeakRefJobsForTaskQueue(setImmediate),
        getInfoWithRef,
        info => info.ref!.deref()
    );

    return {
        WeakRef: WrappedWeakRef,
        FinalizationGroup: createFinalizationGroupClassShim(
            finalizationGroupJobs,
            getInfoWithRegistration,
            info => info.alive === true
        ),
    };
}
