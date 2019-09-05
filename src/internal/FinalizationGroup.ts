import makePrivates from "../utils/privates.js";
import isObject from "../utils/lodash/isObject.js";
import { FinalizationGroupJobs } from "./FinalizationGroupJobs.js";

import { FinalizationGroup } from "../weakrefs.js";

export interface WeakRefsObjectInfoIsAlive<ObjectInfo> {
    (info: ObjectInfo): boolean;
}

export interface WeakRefsGetObjectInfo<ObjectInfo> {
    (target: object): ObjectInfo;
}

// Note: agent will hold FinalizationGroup instance until all registered targets have been collected

class FinalizationGroupCell<ObjectInfo, Holdings, Token> {
    constructor(
        public readonly info: ObjectInfo,
        public readonly holdings: Holdings,
        public readonly unregisterToken: Token | undefined
    ) {}
}

class FinalizationGroupSlots<ObjectInfo, Holdings, Token> {
    readonly cells = new Set<
        FinalizationGroupCell<ObjectInfo, Holdings, Token>
    >();
    readonly cellsForTarget = new Map<
        ObjectInfo,
        Set<FinalizationGroupCell<ObjectInfo, Holdings, Token>>
    >();
    constructor(
        public readonly cleanupCallback: FinalizationGroup.CleanupCallback<
            Holdings
        >
    ) {}
}

export function createFinalizationGroupClassShim<ObjectInfo>(
    jobs: Pick<
        FinalizationGroupJobs<ObjectInfo>,
        | "registerFinalizationGroup"
        | "unregisterFinalizationGroup"
        | "checkForEmptyCells"
        | "getFinalizedInFinalizationGroup"
    >,
    getInfo: WeakRefsGetObjectInfo<ObjectInfo>,
    isAlive: WeakRefsObjectInfoIsAlive<ObjectInfo>
): FinalizationGroup.Constructor {
    const privates = makePrivates<
        FinalizationGroupSlots<ObjectInfo, any, object>,
        FinalizationGroup<any>
    >();

    type Slots<Holdings> = FinalizationGroupSlots<ObjectInfo, Holdings, object>;

    function unregisterCell<Holdings>(
        group: FinalizationGroup<Holdings>,
        cell: FinalizationGroupCell<ObjectInfo, Holdings, object>
    ) {
        const slots = privates<Slots<Holdings>>(group);
        slots.cells.delete(cell);
        const cellsForTarget = slots.cellsForTarget.get(cell.info)!;
        cellsForTarget.delete(cell);
        if (cellsForTarget.size == 0) {
            slots.cellsForTarget.delete(cell.info);
            jobs.unregisterFinalizationGroup(group, cell.info);
        }
    }

    class FinalizationGroup<Holdings = any, Token extends object = object> {
        constructor(
            cleanupCallback: FinalizationGroup.CleanupCallback<Holdings>
        ) {
            if (typeof cleanupCallback != "function") throw new TypeError();
            privates.init(
                this,
                new FinalizationGroupSlots<ObjectInfo, Holdings, Token>(
                    cleanupCallback
                )
            );
        }

        register(
            target: object,
            holdings: Holdings,
            unregisterToken?: Token
        ): void {
            if (!isObject(target)) throw new TypeError();
            if (unregisterToken !== undefined && !isObject(unregisterToken))
                throw TypeError();

            const slots = privates<Slots<Holdings>>(this);
            const objectInfo = getInfo(target);

            const cell = new FinalizationGroupCell(
                objectInfo,
                holdings,
                unregisterToken
            );
            slots.cells.add(cell);
            let cellsForTarget = slots.cellsForTarget.get(objectInfo);
            if (!cellsForTarget) {
                cellsForTarget = new Set();
                slots.cellsForTarget.set(objectInfo, cellsForTarget);
                jobs.registerFinalizationGroup(this, objectInfo);
            }
            cellsForTarget.add(cell);
        }

        unregister(unregisterToken: Token): boolean {
            if (!isObject(unregisterToken)) throw new TypeError();
            const slots = privates<Slots<Holdings>>(this);
            let removed = false;
            for (const cell of slots.cells) {
                if (cell.unregisterToken !== unregisterToken) continue;
                unregisterCell(this, cell);
                removed = true;
            }
            return removed;
        }

        cleanupSome(
            cleanupCallback:
                | FinalizationGroup.CleanupCallback<Holdings>
                | undefined
        ): void {
            const group = this;
            const slots = privates<Slots<Holdings>>(group);
            if (!cleanupCallback) {
                cleanupCallback = slots.cleanupCallback;
            } else if (typeof cleanupCallback != "function") {
                throw new TypeError();
            }

            const finalized = jobs.getFinalizedInFinalizationGroup(this);
            if (finalized.size == 0) return;

            let isFinalizationGroupCleanupJobActive = true;
            function assertInsideCleanupJob() {
                if (!isFinalizationGroupCleanupJobActive) {
                    throw TypeError();
                }
            }

            const iteratorFunction = function*() {
                assertInsideCleanupJob();
                for (const info of finalized) {
                    const cells = slots.cellsForTarget.get(info);
                    if (!cells) continue;
                    for (const cell of cells) {
                        if (isAlive(cell.info)) continue;
                        const holding = cell.holdings;
                        unregisterCell(group, cell);
                        yield holding;
                        assertInsideCleanupJob();
                    }
                }
            };

            Object.defineProperty(
                Object.getPrototypeOf(iteratorFunction.prototype),
                Symbol.toStringTag,
                {
                    value: "FinalizationGroup Cleanup Iterator",
                    configurable: true,
                }
            );

            const iterator = iteratorFunction() as FinalizationGroup.CleanupIterator<
                Holdings
            >;

            try {
                cleanupCallback(iterator);
            } finally {
                isFinalizationGroupCleanupJobActive = false;
            }
        }
    }

    return FinalizationGroup;
}
