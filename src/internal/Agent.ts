import { merge } from "../utils/set.js";

import { FinalizationGroup } from "../weakrefs.js";

interface ObjectInfoAgentHoldObject {
    (object: object): void;
}
interface ObjectInfoAgentReleaseObject {
    (object: object): void;
}
interface ObjectInfoAgentRegisterObjectInfo<T> {
    (info: T): void;
}
interface ObjectInfoAgentUnregisterObjectInfo<T> {
    (info: T): void;
}
interface ObjectInfoAgentGetDeadObjectInfo<T> {
    (): Set<T>;
}

export class Agent<ObjectInfo> {
    private readonly keptAliveDuringJob = new Set<object>();
    private readonly finalizationGroupsForInfos = new Map<
        ObjectInfo,
        Set<FinalizationGroup<any>>
    >();

    constructor(
        private readonly getDeadObjectInfos: ObjectInfoAgentGetDeadObjectInfo<
            ObjectInfo
        >,
        private readonly hooks: {
            holdObject?: ObjectInfoAgentHoldObject;
            releaseObject?: ObjectInfoAgentReleaseObject;
            registerObjectInfo?: ObjectInfoAgentRegisterObjectInfo<ObjectInfo>;
            unregisterObjectInfo?: ObjectInfoAgentUnregisterObjectInfo<
                ObjectInfo
            >;
        } = {}
    ) {}

    finalization(): void {
        const finalized = this.getDeadObjectInfos();
        const finalizationGroups = new Set<FinalizationGroup<any>>();
        let errors = new Set<Error>();

        for (const info of finalized) {
            if (this.finalizationGroupsForInfos.has(info)) {
                merge(
                    finalizationGroups,
                    this.finalizationGroupsForInfos.get(info)!
                );
            }
        }

        // First since we're not enqueueing cleanup jobs but executing them
        if (this.keptAliveDuringJob.size > 0) {
            for (const object of this.keptAliveDuringJob) {
                // One by one to stay consistent with releaseObject
                this.keptAliveDuringJob.delete(object);
                if (this.hooks.releaseObject) this.hooks.releaseObject(object);
            }
        }

        // TBD: The spec says enqueue jobs
        for (const finalizationGroup of finalizationGroups) {
            try {
                finalizationGroup.cleanupSome();
            } catch (error) {
                errors.add(error);
            }
        }

        for (const info of finalized) {
            const finalizationGroupsForInfo = this.finalizationGroupsForInfos.get(
                info
            );
            if (
                finalizationGroupsForInfo &&
                finalizationGroupsForInfo.size > 0
            ) {
                // Groups' iterators weren't spent, cleanup for them
                if (this.hooks.unregisterObjectInfo)
                    this.hooks.unregisterObjectInfo(info);
            }
            this.finalizationGroupsForInfos.delete(info);
        }

        if (errors.size > 0) {
            throw new Error(
                "Error during finalization:\n" +
                    [...errors].map(error => error.stack).concat("\n")
            );
        }
    }

    registerFinalizationGroup(
        finalizationGroup: FinalizationGroup<any>,
        info: ObjectInfo
    ): void {
        let finalizationGroupsForInfo = this.finalizationGroupsForInfos.get(
            info
        );
        if (!finalizationGroupsForInfo) {
            if (this.hooks.registerObjectInfo)
                this.hooks.registerObjectInfo(info);

            finalizationGroupsForInfo = new Set<FinalizationGroup<any>>();
            this.finalizationGroupsForInfos.set(
                info,
                finalizationGroupsForInfo
            );
        }
        finalizationGroupsForInfo.add(finalizationGroup);
    }

    unregisterFinalizationGroup(
        finalizationGroup: FinalizationGroup<any>,
        info: ObjectInfo
    ): void {
        let finalizationGroupsForInfo = this.finalizationGroupsForInfos.get(
            info
        );
        if (!finalizationGroupsForInfo) {
            // Happens if info is not alive anymore and
            // Finalization's group iterator wasn't spent
            return;
        }
        finalizationGroupsForInfo.delete(finalizationGroup);
        if (finalizationGroupsForInfo.size == 0) {
            this.finalizationGroupsForInfos.delete(info);
            if (this.hooks.unregisterObjectInfo)
                this.hooks.unregisterObjectInfo(info);
        }
    }

    get isKeepingObjects(): boolean {
        return this.keptAliveDuringJob.size > 0;
    }

    keepDuringJob(object: object): void {
        if (this.keptAliveDuringJob.has(object)) return;
        this.keptAliveDuringJob.add(object);
        if (this.hooks.holdObject) this.hooks.holdObject(object);
    }
}
