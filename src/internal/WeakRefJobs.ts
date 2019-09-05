import { TaskQueue } from "../utils/tasks/taskQueue";

interface HoldObject {
    (object: object): void;
}
interface ReleaseObject {
    (object: object): void;
}

export interface ClearKeptObjects {
    (): void;
}

export interface KeepDuringJob {
    (object: object): void;
}

export interface WeakRefJobs {
    readonly keepDuringJob: KeepDuringJob;
    readonly clearKeptObjects: ClearKeptObjects;
    readonly isKeepingObjects: boolean;
}

export function createWeakRefJobs(
    scheduleClearKeptObjects: () => number,
    hooks: {
        holdObject?: HoldObject;
        releaseObject?: ReleaseObject;
    } = {}
): WeakRefJobs {
    const keptAliveDuringJob = new Set<object>();

    return {
        keepDuringJob(object: object): void {
            if (keptAliveDuringJob.has(object)) return;
            keptAliveDuringJob.add(object);
            if (hooks.holdObject) hooks.holdObject(object);
            if (keptAliveDuringJob.size == 1) scheduleClearKeptObjects();
        },

        clearKeptObjects(): void {
            for (const object of keptAliveDuringJob) {
                // One by one to stay consistent with releaseObject
                keptAliveDuringJob.delete(object);
                if (hooks.releaseObject) hooks.releaseObject(object);
            }
        },

        get isKeepingObjects(): boolean {
            return keptAliveDuringJob.size > 0;
        },
    };
}

export function createWeakRefJobsForTaskQueue(
    setTask: TaskQueue.Set<number>,
    hooks: {
        holdObject?: HoldObject;
        releaseObject?: ReleaseObject;
    } = {}
): WeakRefJobs {
    const jobs = createWeakRefJobs(() => setTask(jobs.clearKeptObjects), hooks);
    return jobs;
}
