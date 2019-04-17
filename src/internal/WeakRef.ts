import makePrivates, { Privates } from "../utils/privates.js";
import isObject from "../utils/lodash/isObject.js";
import { Agent } from "./Agent.js";
import { WeakRefsGetObjectInfo } from "./FinalizationGroup.js";

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
    agent: Pick<Agent<ObjectInfo>, "keepDuringJob">,
    getInfo: WeakRefsGetObjectInfo<ObjectInfo>,
    getTarget: WeakRefsGetTarget<ObjectInfo>,
    initSlots: (target: object, self: WeakRef) => Slots = target =>
        new WeakRefSlots<ObjectInfo>(getInfo(target)) as Slots
): [WeakRef.Constructor, Privates<Slots, WeakRef<object>>] {
    const privates = makePrivates<Slots, WeakRef<object>>();

    class WeakRef<U extends object> {
        constructor(target: U) {
            if (!isObject(target)) throw new TypeError();
            agent.keepDuringJob(target);
            privates.init(this, initSlots(target, this));
        }

        deref(): U | undefined {
            const slots = privates<Slots>(this);
            const target = getTarget(slots.targetInfo) as U | undefined;
            if (target) agent.keepDuringJob(target);
            return target;
        }
    }

    return [WeakRef, privates];
}
