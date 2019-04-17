import * as global from "./setImmediate.global.js";
import * as shim from "./setImmediate.shim.js";
import * as fallback from "./setImmediate.fallback.js";

export const { setImmediate, clearImmediate } = global.available
    ? global.shim()
    : shim.available
    ? shim.shim()
    : fallback;

export type immediateId = number;
