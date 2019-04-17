import { Agent } from "./Agent.js";

type taskId = any;

interface SetTask {
    (callback: () => void): taskId;
}

interface ClearTask {
    (taskId: taskId): void;
}

export interface UpdateFinalizationJob {
    (pendingFinalized?: boolean): void;
}

// Perform agent finalization on a clean stack
// setTask should schedule for a new task so that objects finalized
// separately in the same turn are bunched together
export function makeAgentFinalizationJobScheduler(
    agent: Pick<Agent<any>, "finalization" | "isKeepingObjects">,
    setTask: SetTask,
    clearTask: ClearTask
): UpdateFinalizationJob {
    let pendingTaskId: taskId | undefined;
    let pendingFinalized: boolean = false;

    return function updatePendingFinalized(
        newPendingFinalized: boolean = pendingFinalized
    ): void {
        pendingFinalized = newPendingFinalized;
        if (!pendingTaskId && (pendingFinalized || agent.isKeepingObjects)) {
            pendingTaskId = setTask(() => {
                pendingTaskId = undefined;
                agent.finalization();
            });
        } else if (
            pendingTaskId &&
            !pendingFinalized &&
            !agent.isKeepingObjects
        ) {
            clearTask(pendingTaskId);
            pendingTaskId = undefined;
        }
    };
}
