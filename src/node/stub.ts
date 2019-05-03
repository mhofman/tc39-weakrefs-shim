// @ts-ignore
import WeakTag from "@mhofman/weak-napi-native/weak-tag.js";
// @ts-ignore
import ObjectInfo from "@mhofman/weak-napi-native/object-info.js";

const map = new WeakMap<object, Set<WeakTag>>();

import { FinalizationGroup, WeakRef } from "../weakrefs.js";

// stub FinalizationGroup that calls the callback directly for each
// registered target
// No holding or unregister
class FinalizationGroupNodeStub implements FinalizationGroup<ObjectInfo> {
    private finalizedCallback: ObjectInfo.FinalizedCallback;
    static get [Symbol.species]() {
        return FinalizationGroupNodeStub;
    }
    constructor(callback: FinalizationGroup.CleanupCallback<any>) {
        this.finalizedCallback = function(this: ObjectInfo) {
            callback(([this] as unknown) as FinalizationGroup.CleanupIterator<
                ObjectInfo
            >);
        };
    }
    register(
        target: object,
        holdingsIgnored: any,
        unregisterTokenIgnored?: any
    ): ObjectInfo {
        let tagSet = map.get(target);
        if (!tagSet) {
            tagSet = new Set();
            map.set(target, tagSet);
        }
        const info = new ObjectInfo(target, this.finalizedCallback);
        tagSet.add(new WeakTag(info));
        return info;
    }

    unregister(unregisterToken?: any): boolean {
        return false;
    }
    cleanupSome(
        cleanupCallback?: FinalizationGroup.CleanupCallback<any> | undefined
    ): void {}
}

class WeakRefNodeStub<T extends object = object> implements WeakRef<T> {
    private readonly info: ObjectInfo;

    static get [Symbol.species]() {
        return WeakRefNodeStub;
    }
    constructor(target: T) {
        this.info = new ObjectInfo(target, () => {});
    }

    deref(): T | undefined {
        return this.info.target as T | undefined;
    }
}

export {
    FinalizationGroupNodeStub as FinalizationGroup,
    WeakRefNodeStub as WeakRef,
};
