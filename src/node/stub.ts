// @ts-ignore
import WeakTag from "@mhofman/weak-napi-native/weak-tag.js";
// @ts-ignore
import ObjectInfo from "@mhofman/weak-napi-native/object-info.js";

import { gc } from "./gc.js";

import { FinalizationGroup, WeakRef } from "../weakrefs.js";
import isObject from "../utils/lodash/isObject.js";
import { setImmediate } from "../utils/tasks/setImmediate.js";

type Cell = {
    holdings: any;
    registrationSet: Set<ObjectInfo> | undefined;
};

const map = new WeakMap<object, Set<WeakTag>>();

const registrations = new WeakMap<object, Set<ObjectInfo>>();

type Entries = Iterable<[ObjectInfo, Cell]>;

function hasEmptyCell(context: { cells: Map<ObjectInfo, Cell> }): boolean {
    for (const info of context.cells.keys()) {
        if (!info.target) return true;
    }
    return false;
}

function* getEmptyCellEntries(context: {
    cells: Map<ObjectInfo, Cell>;
}): Entries {
    for (const [info, cell] of context.cells.entries()) {
        if (!context.cells) throw new TypeError();
        if (info.target) continue;
        context.cells.delete(info);
        yield [info, cell];
    }
}

function* getCellEntry(context: {
    info: ObjectInfo;
    cells: Map<ObjectInfo, Cell>;
}): Entries {
    const cell = context.cells.get(context.info)!;
    context.cells.delete(context.info);
    yield [context.info, cell];
}

const CleanupIterator: <Holdings>(
    entries: Iterable<[ObjectInfo, Cell]>
) => FinalizationGroup.CleanupIterator<Holdings> = function* CleanupIterator(
    entries: Iterable<[ObjectInfo, Cell]>
) {
    for (const [info, cell] of entries) {
        if (cell.registrationSet) cell.registrationSet.delete(info);
        yield cell.holdings;
    }
} as <Holdings>(
    entries: Iterable<[ObjectInfo, Cell]>
) => FinalizationGroup.CleanupIterator<Holdings>;

Object.defineProperty(
    Object.getPrototypeOf(CleanupIterator.prototype),
    Symbol.toStringTag,
    {
        value: "FinalizationGroup Cleanup Iterator",
        configurable: true,
    }
);

class FinalizationGroupNodeStub<Holdings>
    implements FinalizationGroup<Holdings> {
    private readonly finalizedCallback: ObjectInfo.FinalizedCallback;
    private readonly cells: Map<ObjectInfo, Cell>;

    constructor(
        private readonly cleanupCallback: FinalizationGroup.CleanupCallback<
            Holdings
        >
    ) {
        if (typeof cleanupCallback != "function") throw new TypeError();
        const cells = (this.cells = new Map());
        this.finalizedCallback = function(this: ObjectInfo) {
            if (!cells.get(this)) return;
            const context = { info: this, cells };
            try {
                cleanupCallback(CleanupIterator(getCellEntry(context)));
            } catch (error) {
                setImmediate(() => {
                    throw error;
                });
            }
            context.info = context.cells = undefined!;
        };
    }

    register(
        target: object,
        holdings: Holdings,
        unregisterToken?: object
    ): void {
        if (!this.cells) throw new TypeError();
        let tagSet = map.get(target);
        if (!tagSet) {
            tagSet = new Set();
            map.set(target, tagSet);
        }
        let registrationSet = unregisterToken
            ? registrations.get(unregisterToken)
            : undefined;
        if (!registrationSet && unregisterToken !== undefined) {
            if (!isObject(unregisterToken)) throw new TypeError();
            registrationSet = new Set();
            registrations.set(unregisterToken, registrationSet);
        }
        const info = new ObjectInfo(target, this.finalizedCallback);
        this.cells.set(info, {
            holdings,
            registrationSet,
        });
        tagSet.add(new WeakTag(info));
        if (registrationSet) registrationSet.add(info);
    }

    unregister(unregisterToken: object): boolean {
        if (!this.cells) throw new TypeError();
        const registrationSet = registrations.get(unregisterToken);
        if (!registrationSet) {
            if (!isObject(unregisterToken)) throw new TypeError();
            return false;
        }

        let removed = false;
        for (const info of registrationSet) {
            const cell = this.cells.get(info)!;

            if (!cell) continue;

            this.cells.delete(info);
            registrationSet.delete(info);
            removed = true;
        }

        return removed;
    }

    cleanupSome(
        cleanupCallback?:
            | FinalizationGroup.CleanupCallback<Holdings>
            | undefined
    ): void {
        if (!this.cells) throw new TypeError();
        const context = { cells: this.cells };
        const emptyObjectInfos = getEmptyCellEntries(context);

        if (cleanupCallback === undefined) {
            cleanupCallback = this
                .cleanupCallback as FinalizationGroup.CleanupCallback<Holdings>;
        }

        if (hasEmptyCell(context)) {
            cleanupCallback(CleanupIterator(emptyObjectInfos));
        } else if (typeof cleanupCallback != "function") {
            throw new TypeError();
        }

        context.cells = undefined!;
    }
}

class WeakRefNodeStub<T extends object = object> implements WeakRef<T> {
    private readonly info: ObjectInfo;

    constructor(target: T) {
        if (!isObject(target)) throw new TypeError();
        this.info = new ObjectInfo(target, () => {});
    }

    deref(): T | undefined {
        return this.info.target as T | undefined;
    }
}

export {
    FinalizationGroupNodeStub as FinalizationGroup,
    WeakRefNodeStub as WeakRef,
    gc,
};
