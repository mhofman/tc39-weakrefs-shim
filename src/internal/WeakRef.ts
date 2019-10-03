import makePrivates, { Privates } from "../utils/privates.js";
import isObject from "../utils/lodash/isObject.js";
import { WeakRefJobs } from "./WeakRefJobs.js";
import { WeakRefsGetObjectInfo } from "./FinalizationGroup.js";

import { WeakRef } from "../weakrefs.js";

export interface WeakRefsGetTarget<ObjectInfo> {
    (info: ObjectInfo): object | undefined;
}

export interface WeakRefsGetObjectInfo<ObjectInfo> {
    (target: object): ObjectInfo;
}

export class WeakRefSlots<ObjectInfo> {
    constructor(public readonly targetInfo: ObjectInfo) {}
}

export function createWeakRefClassShim<
    ObjectInfo,
    Slots extends WeakRefSlots<ObjectInfo> = WeakRefSlots<ObjectInfo>
>(
    jobs: Pick<WeakRefJobs, "keepDuringJob">,
    getInfo: WeakRefsGetObjectInfo<ObjectInfo>,
    getTarget: WeakRefsGetTarget<ObjectInfo>,
    initSlots: (target: object, self: WeakRef) => Slots = target =>
        new WeakRefSlots<ObjectInfo>(getInfo(target)) as Slots
): [WeakRef.Constructor, Privates<Slots, import("../weakrefs.js").WeakRef>] {
    const privates = makePrivates<Slots, WeakRef>();

    class WeakRef<U extends object = object> {
        constructor(target: U) {
            if (!isObject(target)) throw new TypeError();
            jobs.keepDuringJob(target);
            privates.init(this, initSlots(target, this));
        }

        deref(): U | undefined {
            const slots = privates<Slots>(this);
            const target = getTarget(slots.targetInfo) as U | undefined;
            if (target) jobs.keepDuringJob(target);
            return target;
        }
    }

    return [WeakRef, privates];
}
