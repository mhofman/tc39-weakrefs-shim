import { FinalizationGroup } from "../weakrefs.js";
import { TaskQueue } from "../utils/tasks/taskQueue.js";

interface RegisterObjectInfo<T> {
    (info: T): void;
}
interface UnregisterObjectInfo<T> {
    (info: T): void;
}

interface FinalizationGroupDetails<ObjectInfo> {
    finalizedInfos: Set<ObjectInfo>;
    cleanupTaskId: number;
}

export interface CleanupFinalizationGroup {
    (finalizationGroup: FinalizationGroup): void;
}

export interface CheckForEmptyCells {
    (finalizationGroup: FinalizationGroup): boolean;
}

export interface FinalizationGroupJobs<ObjectInfo> {
    readonly checkForEmptyCells: CheckForEmptyCells;
    readonly cleanupFinalizationGroup: CleanupFinalizationGroup;

    setFinalized(...infos: Array<ObjectInfo>): void;
    getFinalizedInFinalizationGroup(
        finalizationGroup: FinalizationGroup
    ): Set<ObjectInfo>;
    registerFinalizationGroup(
        finalizationGroup: FinalizationGroup,
        info: ObjectInfo
    ): void;
    unregisterFinalizationGroup(
        finalizationGroup: FinalizationGroup,
        info: ObjectInfo
    ): void;
}

export function createFinalizationGroupJobs<ObjectInfo>(
    scheduleCleanupFinalizationGroup: (
        finalizationGroup: FinalizationGroup
    ) => number,
    hooks: {
        registerObjectInfo?: RegisterObjectInfo<ObjectInfo>;
        unregisterObjectInfo?: UnregisterObjectInfo<ObjectInfo>;
    } = {}
): FinalizationGroupJobs<ObjectInfo> {
    const finalizationGroupDetails = new WeakMap<
        FinalizationGroup,
        FinalizationGroupDetails<ObjectInfo>
    >();
    const finalizationGroupsForInfos = new Map<
        ObjectInfo,
        Set<FinalizationGroup>
    >();

    return {
        setFinalized(...infos: Array<ObjectInfo>): void {
            for (const info of infos) {
                const finalizationGroups = finalizationGroupsForInfos.get(info);

                if (!finalizationGroups || finalizationGroups.size == 0)
                    continue;

                for (const finalizationGroup of finalizationGroups) {
                    const details = finalizationGroupDetails.get(
                        finalizationGroup
                    );

                    details!.finalizedInfos.add(info);

                    if (!details!.cleanupTaskId)
                        details!.cleanupTaskId = scheduleCleanupFinalizationGroup(
                            finalizationGroup
                        );
                }

                finalizationGroupsForInfos.delete(info);

                if (hooks.unregisterObjectInfo) {
                    hooks.unregisterObjectInfo(info);
                }
            }
        },

        registerFinalizationGroup(
            finalizationGroup: FinalizationGroup,
            info: ObjectInfo
        ): void {
            let finalizationGroupsForInfo = finalizationGroupsForInfos.get(
                info
            );
            if (!finalizationGroupsForInfo) {
                if (hooks.registerObjectInfo) hooks.registerObjectInfo(info);

                finalizationGroupsForInfo = new Set<FinalizationGroup>();
                finalizationGroupsForInfos.set(info, finalizationGroupsForInfo);
            }
            finalizationGroupsForInfo.add(finalizationGroup);

            if (!finalizationGroupDetails.has(finalizationGroup)) {
                finalizationGroupDetails.set(finalizationGroup, {
                    finalizedInfos: new Set(),
                    cleanupTaskId: 0,
                });
            }
        },

        unregisterFinalizationGroup(
            finalizationGroup: FinalizationGroup,
            info: ObjectInfo
        ): void {
            const details = finalizationGroupDetails.get(finalizationGroup);

            if (details!.finalizedInfos.delete(info)) {
                return;
            }

            let finalizationGroupsForInfo = finalizationGroupsForInfos.get(
                info
            );
            finalizationGroupsForInfo!.delete(finalizationGroup);
            if (finalizationGroupsForInfo!.size == 0) {
                finalizationGroupsForInfos.delete(info);
                if (hooks.unregisterObjectInfo)
                    hooks.unregisterObjectInfo(info);
            }
        },

        getFinalizedInFinalizationGroup(
            finalizationGroup: FinalizationGroup
        ): Set<ObjectInfo> {
            const details = finalizationGroupDetails.get(finalizationGroup);

            return details ? details.finalizedInfos : new Set();
        },

        checkForEmptyCells(finalizationGroup: FinalizationGroup): boolean {
            const details = finalizationGroupDetails.get(finalizationGroup);

            return !!details && details.finalizedInfos.size > 0;
        },

        cleanupFinalizationGroup(finalizationGroup: FinalizationGroup): void {
            const details = finalizationGroupDetails.get(finalizationGroup);

            details!.cleanupTaskId = 0;

            finalizationGroup.cleanupSome();
        },
    };
}

export function createFinalizationGroupJobsForTaskQueue<ObjectInfo>(
    setTask: TaskQueue.Set<number>,
    hooks: {
        registerObjectInfo?: RegisterObjectInfo<ObjectInfo>;
        unregisterObjectInfo?: UnregisterObjectInfo<ObjectInfo>;
    } = {}
): FinalizationGroupJobs<ObjectInfo> {
    const jobs: FinalizationGroupJobs<ObjectInfo> = createFinalizationGroupJobs(
        finalizationGroup =>
            setTask(jobs.cleanupFinalizationGroup, finalizationGroup),
        hooks
    );
    return jobs;
}
