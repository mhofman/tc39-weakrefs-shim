// @ts-ignore
import WeakTag from "@mhofman/weak-napi-native/weak-tag.js";
// @ts-ignore
import ObjectInfo from "@mhofman/weak-napi-native/object-info.js";

import { createWeakRefClassShim } from "../internal/WeakRef.js";
import { createFinalizationGroupClassShim } from "../internal/FinalizationGroup.js";
import { createWeakRefJobsForTaskQueue } from "../internal/WeakRefJobs.js";
import { createFinalizationGroupJobsForTaskQueue } from "../internal/FinalizationGroupJobs.js";
import { setImmediate } from "../utils/tasks/setImmediate.js";

export { gc } from "./gc.js";

const tagCollector = new WeakMap<
    object,
    {
        info: ObjectInfo;
        tag: WeakTag;
    }
>();

const observedInfos = new Set<ObjectInfo>();

function finalizedCallback(this: ObjectInfo) {
    if (!observedInfos.has(this)) return;
    observedInfos.delete(this);
    finalizationGroupJobs.setFinalized(this);
}

function getInfo(target: object) {
    let objectDetails = tagCollector.get(target);
    if (!objectDetails) {
        const info = new ObjectInfo(target, finalizedCallback);
        objectDetails = { info, tag: new WeakTag(info) };
        tagCollector.set(target, objectDetails);
    }
    return objectDetails.info;
}

const finalizationGroupJobs = createFinalizationGroupJobsForTaskQueue<
    ObjectInfo
>(setImmediate, {
    registerObjectInfo: info => {
        observedInfos.add(info);
    },
    unregisterObjectInfo: info => {
        observedInfos.delete(info);
    },
});

export const [WeakRef] = createWeakRefClassShim(
    createWeakRefJobsForTaskQueue(setImmediate),
    getInfo,
    info => info.target
);

export const FinalizationGroup = createFinalizationGroupClassShim(
    finalizationGroupJobs,
    getInfo,
    info => observedInfos.has(info)
);
