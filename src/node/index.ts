import { WeakTag, ObjectInfo } from "./weak-napi.js";

import { createWeakRefClassShim } from "../internal/WeakRef.js";
import { createFinalizationGroupClassShim } from "../internal/FinalizationGroup.js";
import { Agent } from "../internal/Agent.js";
import { makeAgentFinalizationJobScheduler } from "../internal/AgentFinalizationJobScheduler.js";
import { setImmediate, clearImmediate } from "../utils/tasks/setImmediate.js";

const tagCollector = new WeakMap<
    object,
    {
        info: WeakTag.ObjectInfo;
        tag: WeakTag;
    }
>();

const observedInfos = new Set<WeakTag.ObjectInfo>();
let finalizedInfos = new Set<WeakTag.ObjectInfo>();

function finalizedCallback(this: WeakTag.ObjectInfo) {
    if (!observedInfos.has(this)) return;
    observedInfos.delete(this);
    finalizedInfos.add(this);
    updatePendingTask(true);
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

const agent = new Agent<WeakTag.ObjectInfo>(
    () => {
        const finalized = finalizedInfos;
        finalizedInfos = new Set();
        return finalized;
    },
    {
        registerObjectInfo: info => {
            observedInfos.add(info);
        },
        unregisterObjectInfo: info => {
            observedInfos.delete(info);
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

export const [WeakRef] = createWeakRefClassShim(
    agent,
    getInfo,
    info => info.target
);

export const FinalizationGroup = createFinalizationGroupClassShim(
    agent,
    getInfo,
    info => observedInfos.has(info)
);
