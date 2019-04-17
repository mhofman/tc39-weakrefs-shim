import { gcTask, gcOfRawPromise } from "./collector-helper.js";
import { setImmediate } from "../src/utils/tasks/setImmediate.js";

import { before, beforeEach, afterEach } from "./setup/mocha.js";

export * from "./setup/mocha.js";
export * from "./setup/chai.js";

let marker: object;
let gcOf: (target?: object | undefined) => Promise<any>;

before(async function() {
    // Either wait on collection of marker, or if gc not observable
    // on a new task with gc performed. If no global gc, simply a new task
    gcOf = gcOfRawPromise ? await gcOfRawPromise : gcTask;
});

beforeEach(async function() {
    marker = {};
});
afterEach(async function() {
    const collected = gcOf(marker);
    marker = undefined!;
    await collected;

    // Try to wait until any agent finalization is performed so that errors
    // Don't pollute the next test
    await new Promise(resolve => setImmediate(resolve));
});
