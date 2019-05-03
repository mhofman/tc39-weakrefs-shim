import makePrivates from "../utils/privates.js";
import isObject from "../utils/lodash/isObject.js";
import { Agent } from "./Agent.js";

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
    readonly cellsPerTarget = new Map<ObjectInfo, number>();
    constructor(
        public readonly cleanupCallback: FinalizationGroup.CleanupCallback<
            Holdings
        >
    ) {}
}

export function createFinalizationGroupClassShim<ObjectInfo>(
    agent: Pick<
        Agent<ObjectInfo>,
        "registerFinalizationGroup" | "unregisterFinalizationGroup"
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
        const cellsForTarget = slots.cellsPerTarget.get(cell.info)! - 1;
        if (!cellsForTarget) {
            slots.cellsPerTarget.delete(cell.info);
            agent.unregisterFinalizationGroup(group, cell.info);
        } else {
            slots.cellsPerTarget.set(cell.info, cellsForTarget);
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

            slots.cells.add(
                new FinalizationGroupCell(objectInfo, holdings, unregisterToken)
            );
            const cellsForTarget = slots.cellsPerTarget.get(objectInfo) || 0;
            if (!cellsForTarget) {
                agent.registerFinalizationGroup(this, objectInfo);
            }
            slots.cellsPerTarget.set(objectInfo, cellsForTarget + 1);
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
            if (!cleanupCallback) cleanupCallback = slots.cleanupCallback;

            const iteratorFunction = function*() {
                for (const cell of slots.cells) {
                    if (isAlive(cell.info)) continue;
                    const holding = cell.holdings;
                    unregisterCell(group, cell);
                    yield holding;
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

            cleanupCallback(iterator);
        }
    }

    return FinalizationGroup;
}
