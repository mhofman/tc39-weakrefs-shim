export type queueId = number;

export interface TaskQueue<T extends queueId> {
    readonly set: TaskQueue.Set<T>;
    readonly clear: TaskQueue.Clear<T>;
    readonly process: TaskQueue.Internal.Process<T>;
}

export namespace TaskQueue {
    export interface Set<T extends queueId> {
        (callback: (...args: any[]) => void, ...args: any[]): T;
    }

    export interface Clear<T extends queueId> {
        (queueId: T): void;
    }

    export namespace Internal {
        export interface Process<T extends queueId> {
            (queueId: T): void;
        }

        export interface Register<T extends queueId> {
            (queueId: T): boolean;
        }
    }
}

export default function makeTaskQueue<T extends queueId>(
    register: TaskQueue.Internal.Register<T>,
    letCallbackErrorsBubble = false
): TaskQueue<T> {
    const queue = new Array<{
        callback: (...args: any[]) => void;
        args: any[];
    }>(1);

    function set(callback: (...args: any[]) => void, ...args: any[]): T {
        const queueId = queue.length as T;
        queue[queueId] = { callback, args };
        let error;
        try {
            if (!register(queueId))
                error = new Error("Failed to register task");
        } catch (err) {
            error = err;
        }
        if (error) {
            delete queue[queueId];
            throw error;
        }
        return queueId;
    }

    function clear(queueId: T): void {
        delete queue[queueId];
    }

    function processBubble(queueId: T): void {
        if (!(queueId in queue)) return;
        const { callback, args } = queue[queueId];
        delete queue[queueId];
        callback(...args);
    }

    function processCatch(queueId: T): void {
        if (!(queueId in queue)) return;
        const { callback, args } = queue[queueId];
        delete queue[queueId];
        try {
            callback(...args);
        } catch (err) {
            setTimeout(() => {
                throw err;
            }, 0);
        }
    }

    return {
        set,
        clear,
        process: letCallbackErrorsBubble ? processBubble : processCatch,
    };
}
