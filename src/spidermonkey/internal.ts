import { createWeakRefJobsForTaskQueue } from "../internal/WeakRefJobs.js";
import { createFinalizationGroupJobsForTaskQueue } from "../internal/FinalizationGroupJobs.js";
import { createWeakRefClassShim } from "../internal/WeakRef.js";
import { createFinalizationGroupClassShim } from "../internal/FinalizationGroup.js";
import { setImmediate } from "../utils/tasks/setImmediate.js";

declare var nondeterministicGetWeakMapKeys: <T extends object = object>(
    weakMap: WeakMap<T, any>
) => Array<T>;

declare var finalizeCount: () => number;
declare var makeFinalizeObserver: () => object;

const targetToInfoMap = new WeakMap<object, ObjectInfo>();
export const observedAliveInfos = new Set<ObjectInfo>();
let knownFinalizeCount = 0;
let knownAliveObjectsCount = 0;

const gcCheckIntervalMin = 100;
const gcCheckIntervalMax = 5000;
let gcCheckInterval = gcCheckIntervalMin;
let gcCheckTaskId: number = 0;

export function stopCollectMonitor() {
    if (gcCheckTaskId === 0) return;
    console.log("Warn: Force stopping collection");
    clearTimeout(gcCheckTaskId);
    gcCheckTaskId = 0;
}

class ObjectInfo {
    private weakMap = new WeakMap<object, void>();
    private isAlive = true;

    constructor(target: object) {
        this.weakMap.set(target, undefined);
    }

    getTarget(): object | undefined {
        if (!this.isAlive) return undefined;
        const keys = nondeterministicGetWeakMapKeys(this.weakMap);
        if (keys.length === 0) {
            this.isAlive = false;
            return undefined;
        }
        return keys[0];
    }
}

function getInfo(target: object) {
    let info = targetToInfoMap.get(target);
    if (!info) {
        info = new ObjectInfo(target);
        targetToInfoMap.set(target, info);
        knownAliveObjectsCount++;
    }
    return info;
}

function checkOnKnownObjects() {
    let previousKnownAliveObjectCount = knownAliveObjectsCount;
    let aliveObjects;
    const previousFinalizeCount = knownFinalizeCount;
    knownFinalizeCount = finalizeCount();

    let start = gcCheckTaskId === 0;

    // If the marker is still there, assume no one else we track got collected
    if (!start && previousFinalizeCount != knownFinalizeCount) {
        if (knownFinalizeCount < previousFinalizeCount) {
            console.log("Warning: finalizeCount got reset");
        }

        // Record the fact our marker got collected
        knownAliveObjectsCount--;
        previousKnownAliveObjectCount = knownAliveObjectsCount;

        // let's see which of our objects are still around
        aliveObjects = nondeterministicGetWeakMapKeys(targetToInfoMap);
        knownAliveObjectsCount = aliveObjects.length;

        if (previousKnownAliveObjectCount != knownAliveObjectsCount) {
            if (previousKnownAliveObjectCount < knownAliveObjectsCount) {
                console.log("Warning: found more objects alive than expected");
            }

            const aliveInfos = new Set(
                aliveObjects.map(object => targetToInfoMap.get(object)!)
            );
            for (const info of observedAliveInfos) {
                if (aliveInfos.has(info)) continue;
                observedAliveInfos.delete(info);
                finalizationGroupJobs.setFinalized(info);
            }
        }
    }

    if (!start && previousKnownAliveObjectCount == knownAliveObjectsCount) {
        // Only our marker got collected, back off
        gcCheckInterval = Math.min(gcCheckInterval * 2, gcCheckIntervalMax);
    } else {
        gcCheckInterval = gcCheckIntervalMin;
    }

    if (observedAliveInfos.size > 0) {
        if (start || previousFinalizeCount != knownFinalizeCount) {
            getInfo(makeFinalizeObserver());
        }

        gcCheckTaskId = setTimeout(checkOnKnownObjects, gcCheckInterval);
    } else {
        clearTimeout(gcCheckTaskId);
        gcCheckTaskId = 0;
    }
}

const finalizationGroupJobs = createFinalizationGroupJobsForTaskQueue<
    ObjectInfo
>(setImmediate, {
    registerObjectInfo: info => {
        observedAliveInfos.add(info);
        if (observedAliveInfos.size == 1) checkOnKnownObjects();
    },
    unregisterObjectInfo: info => {
        const wasObserved = observedAliveInfos.delete(info);
        if (wasObserved && observedAliveInfos.size == 0) checkOnKnownObjects();
    },
});

export const [WeakRef] = createWeakRefClassShim(
    createWeakRefJobsForTaskQueue(setImmediate),
    getInfo,
    info => info.getTarget()
);

export const FinalizationGroup = createFinalizationGroupClassShim(
    finalizationGroupJobs,
    getInfo,
    info => observedAliveInfos.has(info) && info.getTarget !== undefined
);
