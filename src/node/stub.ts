import { WeakTag, ObjectInfo } from "./weak-napi.js";

const map = new WeakMap<object, Set<WeakTag>>();

// stub FinalizationGroup that calls the callback directly for each
// registered target
// No holding or unregister
class FinalizationGroupNodeStub
    implements FinalizationGroup<WeakTag.ObjectInfo> {
    private finalizedCallback: WeakTag.FinalizedCallback;
    static get [Symbol.species]() {
        return FinalizationGroupNodeStub;
    }
    constructor(
        callback: FinalizationGroup.CleanupCallback<WeakTag.ObjectInfo>
    ) {
        this.finalizedCallback = function(this: WeakTag.ObjectInfo) {
            callback(([this] as unknown) as FinalizationGroup.CleanupIterator<
                WeakTag.ObjectInfo
            >);
        };
    }
    register(
        target: object,
        holdings: WeakTag.ObjectInfo,
        unregisterToken?: any
    ): WeakTag.ObjectInfo {
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
        cleanupCallback?:
            | FinalizationGroup.CleanupCallback<WeakTag.ObjectInfo>
            | undefined
    ): void {}
}

class WeakRefNodeStub<T extends object = object> implements WeakRef<T> {
    private readonly info: WeakTag.ObjectInfo;

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
