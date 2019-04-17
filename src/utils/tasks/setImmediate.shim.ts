import makeTaskQueue, { queueId } from "./taskQueue.js";

export type immediateId = queueId;

export const available = typeof MessageChannel == "function";

export function shim() {
    if (!available) throw new Error("MessageChannel not available");

    function register(immediateId: immediateId): boolean {
        channel!.port2.postMessage(immediateId);
        return true;
    }
    const { set, clear, process } = makeTaskQueue(register, true);

    const channel = new MessageChannel();

    channel.port1.addEventListener("message", (event: MessageEvent) =>
        process(event.data)
    );
    channel.port1.start();

    return { setImmediate: set, clearImmediate: clear };
}
