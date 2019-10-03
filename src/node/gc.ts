import { gc as globalGc } from "../global/gc.js";
import { setImmediate } from "../utils/tasks/setImmediate.js";

function nodeGc(): Promise<void> {
    // gc() will collect tags, which will synchronously schedule callbacks using setImmediate
    globalGc!();
    // Resolve after callbacks have been executed
    return new Promise(resolve => setImmediate(resolve));
}

export const gc = globalGc && nodeGc;
