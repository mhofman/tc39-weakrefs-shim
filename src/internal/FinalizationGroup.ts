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

class FinalizationGroupCell<ObjectInfo, Holdings> {
    constructor(
        public readonly info: ObjectInfo,
        public readonly holdings: Holdings,
        public readonly unregisterTokenSiblings:
            | Set<FinalizationGroupCell<ObjectInfo, Holdings>>
            | undefined
    ) {}
}

class FinalizationGroupSlots<
    ObjectInfo,
    Holdings,
    Token extends object = object
> {
    readonly cellsForTarget = new Map<
        ObjectInfo,
        Set<FinalizationGroupCell<ObjectInfo, Holdings>>
    >();
    readonly cellsForToken = new WeakMap<
        Token,
        Set<FinalizationGroupCell<ObjectInfo, Holdings>>
    >();
    isCleanupJobActive = false;
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

    type Slots<Holdings> = FinalizationGroupSlots<ObjectInfo, Holdings>;
    type Cell<Holdings> = FinalizationGroupCell<ObjectInfo, Holdings>;

    type IteratorContext<Holdings> = {
        cells: Iterable<Cell<Holdings>>;
        group: FinalizationGroup<Holdings>;
    };

    function* getEmptyCells<Holdings>(context: {
        finalized: Iterable<ObjectInfo> | undefined;
        cellsForInfo: Map<ObjectInfo, Iterable<Cell<Holdings>>>;
    }) {
        for (const info of context.finalized!) {
            const cells = context.cellsForInfo.get(info);
            if (!cells) continue;
            for (const cell of cells) {
                if (!context.finalized) throw new TypeError();
                yield cell;
            }
        }
    }

    const CleanupIterator: <Holdings>(
        context: IteratorContext<Holdings>
    ) => FinalizationGroup.CleanupIterator<
        Holdings
    > = function* CleanupIterator<Holdings>(
        context: IteratorContext<Holdings>
    ) {
        for (const cell of context.cells) {
            if (isAlive(cell.info)) continue;
            const holding = cell.holdings;
            unregisterCell(context.group, cell);
            yield holding;
        }
    } as <Holdings>(
        context: IteratorContext<Holdings>
    ) => FinalizationGroup.CleanupIterator<Holdings>;

    Object.defineProperty(
        Object.getPrototypeOf(CleanupIterator.prototype),
        Symbol.toStringTag,
        {
            value: "FinalizationGroup Cleanup Iterator",
            configurable: true,
        }
    );

    function unregisterCell<Holdings>(
        group: FinalizationGroup<Holdings>,
        cell: Cell<Holdings>
    ) {
        const slots = privates<Slots<Holdings>>(group);
        if (cell.unregisterTokenSiblings) {
            cell.unregisterTokenSiblings.delete(cell);
        }

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
            unregisterToken: Token | undefined = undefined
        ): void {
            if (!isObject(target) || (target as any) === holdings)
                throw new TypeError();
            if (unregisterToken !== undefined && !isObject(unregisterToken))
                throw TypeError();

            const slots = privates<Slots<Holdings>>(this);
            const objectInfo = getInfo(target);

            let cellsForToken;
            if (unregisterToken) {
                cellsForToken = slots.cellsForToken.get(unregisterToken);
                if (!cellsForToken) {
                    cellsForToken = new Set<Cell<Holdings>>();
                    slots.cellsForToken.set(unregisterToken, cellsForToken);
                }
            }

            const cell = new FinalizationGroupCell(
                objectInfo,
                holdings,
                cellsForToken
            );

            let cellsForTarget = slots.cellsForTarget.get(objectInfo);
            if (!cellsForTarget) {
                jobs.registerFinalizationGroup(this, objectInfo);
                cellsForTarget = new Set();
                slots.cellsForTarget.set(objectInfo, cellsForTarget);
            }
            cellsForTarget.add(cell);

            if (cellsForToken) cellsForToken.add(cell);
        }

        unregister(unregisterToken: Token): boolean {
            if (!isObject(unregisterToken)) throw new TypeError();
            const slots = privates<Slots<Holdings>>(this);
            let removed = false;
            const cellsForToken = slots.cellsForToken.get(unregisterToken);
            if (!cellsForToken) return removed;
            for (const cell of cellsForToken) {
                unregisterCell(this, cell);
                removed = true;
            }
            return removed;
        }

        cleanupSome(
            cleanupCallback:
                | FinalizationGroup.CleanupCallback<Holdings>
                | undefined = undefined
        ): void {
            let slots = privates<Slots<Holdings>>(this);
            if (slots.isCleanupJobActive) {
                throw new TypeError();
            }
            if (cleanupCallback === undefined) {
                cleanupCallback = slots.cleanupCallback;
            } else if (typeof cleanupCallback != "function") {
                throw new TypeError();
            }

            const getEmptyCellsContext = {
                finalized: jobs.getFinalizedInFinalizationGroup(this),
                cellsForInfo: slots.cellsForTarget,
            };

            if (getEmptyCellsContext.finalized.size == 0) return;

            const cleanupIteratorContext = {
                group: this,
                cells: getEmptyCells(getEmptyCellsContext),
            };

            const iterator = CleanupIterator(cleanupIteratorContext);

            try {
                slots.isCleanupJobActive = true;
                cleanupCallback(iterator);
            } finally {
                slots.isCleanupJobActive = false;
                cleanupIteratorContext.group = undefined!;
                getEmptyCellsContext.finalized = undefined!;
                getEmptyCellsContext.cellsForInfo = undefined!;
            }
        }
    }

    return FinalizationGroup;
}
