import { makeAsyncGc } from "./collector-helper.js";
import { available as weakrefsAvailable } from "../src/index.js";
import globalWeakrefsAvailable from "../src/global/available.js";
import { gc as globalGc } from "../src/global/index.js";

import nodeStubAvailable from "../src/node/available.js";

import { setImmediate } from "../src/utils/tasks/setImmediate.js";

import { before, beforeEach, afterEach } from "./setup/mocha.js";

export * from "./setup/mocha.js";
export * from "./setup/chai.js";

let marker: object;
let gcOf: (target?: object | undefined) => Promise<any>;

function gcTask() {
    return new Promise<void>(resolve =>
        setImmediate(() => {
            if (globalGc) globalGc();
            resolve();
        })
    );
}

// Uses the primitives of the platform
// Or the shim if available
const gcOfRawPromise =
    weakrefsAvailable && globalGc
        ? (async () => {
              let weakrefs;
              if (globalWeakrefsAvailable) {
                  weakrefs = import("../src/global/index.js");
              } else if (nodeStubAvailable) {
                  weakrefs = import("../src/node/stub.js");
              } else if (weakrefsAvailable) {
                  weakrefs = import("../src/index.js");
              } else {
                  throw new Error("Implementation not available");
              }

              const { FinalizationGroup, gc } = await weakrefs;

              return makeAsyncGc(gc || globalGc, FinalizationGroup);
          })()
        : undefined;

before(async function() {
    // Either wait on collection of marker, or if gc not observable
    // on a new task with gc performed. If no global gc, simply a new task
    const asyncGc = gcOfRawPromise ? await gcOfRawPromise : undefined;
    gcOf = asyncGc || gcTask;
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
