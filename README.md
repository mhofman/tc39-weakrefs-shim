# TC39 Weakrefs shim

Early shim implementing the [TC39 weakrefs proposal](https://github.com/tc39/proposal-weakrefs/), currently in stage 2.

Most JavaScript environments hide the details of the garbage collection process.
It is thus not possible to implement the shim on most platforms without special hooks or hacks.
This package aims to provide the foundation to add weakrefs support if such workarounds are available on a specific platform.

Pull requests for improvements or new platform support gladly accepted.

## Supported platforms

### Node

Node has the ability to expose the underlying engine's garbage collection process through [Native Addons](https://nodejs.org/api/n-api.html).
This package uses the native bindings of the [weak-napi node module](https://github.com/node-ffi-napi/weak-napi) to be notified of the finalization of tracked objects.

Please note there is currently an [issue with Node 12](https://github.com/node-ffi-napi/weak-napi/issues/16) causing intermittent SegFaults.

### Mozilla JavaScript shell

The [SpiderMonkey shell](https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Introduction_to_the_JavaScript_shell) exposes some privileged APIs as [globals](https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Shell_global_objects), including the ability to recover the keys of a `WeakMap`.

However, the JS shell is not alike any typical JS environment and lacks a run-loop as well as any task scheduling APIs.
For this reason, the shim for the JS Shell is more a proof of concept than anything else. However with a custom task scheduler, all tests do pass.

### Chrome/V8 (with command-line flag)

V8 7.4, included in Chrome 74 and Node 12.0, implements the weakrefs proposal natively behind a command-line flag (`--js-flags="--harmony-weak-refs"`).

However, V8's current implementation is not compliant with the latest version of the spec proposal. The shim attempts to detect and wrap broken implementations.

In V8 7.4, the following are notable deviations of the native implementation:

-   `FinalizationGroup.prototype.unregister` does not work at all
-   `FinalizationGroup.prototype.cleanupSome` ignores its `callback` parameter and always invokes the callback provided to the constructor
-   Errors thrown inside the cleanup callback are swallowed and never reach the global unhandled error handler. This only affects the automatic cleanup callback invocation when the engine finds new finalized targets.
-   The `CleanupIterator` can be used outside of the callback's invocation when it shouldn't (including in async functions)
-   `FinalizationGroup` instances may leak in some circumstances.
-   The `unregisterToken` is held strongly so anything it references cannot be collected. In particular, it prevents using the `target` as the token.

V8 7.7 (Chrome 77 and Node 12.11) fixed some issues with `FinalizationGroup.prototype.unregister` and `FinalizationGroup.prototype.cleanupSome`. Since the remaining defects are dependent on garbage collection occurring, the shim can no longer detect them and wrap the native implementation automatically.

V8 7.8 changed the integration of the WeakRef feature with the host environment (browser). Chrome 78 did not update accordingly making the feature virtually useless: WeakRef leak their target which will never be collected, and the FinalizationGroup's cleanup callback is never executed automatically. Only `FinalizationGroup.prototype.cleanupSome` can process collected targets.

## Usage

### CommonJS and ES Module support

This package supports both ES Module import and CommonJS require.

Since ES Module support in NodeJS is experimental, and the eco-system hasn't fully standardized dual mode packages (especially isomorphic ones), the ES Module usage may require some extra configuration in the tooling. The implementation uses relative imports with `.js` extension for browser compatibility.\
Any PR welcome for improvements and fixes when used with [`esm`](https://github.com/standard-things/esm), [`babel`](https://babeljs.io/), [`rollup`](https://github.com/rollup/rollup), [Node 12 experimental modules](https://medium.com/@nodejs/announcing-a-new-experimental-modules-1be8d2d6c2ff), or [directly in modern browsers](https://jakearchibald.com/2017/es-modules-in-browsers/).

The ES module implementation is in the `module` folder. The CommonJS implementation is in the `lib` folder.\
The package.json has both a `"main"` and [`"module"`](https://github.com/rollup/rollup/wiki/pkg.module) fields describing the corresponding entrypoints.

### Entrypoint

The package's main entrypoint exports a `shim` async function that dynamically loads the implementation appropriate for the detected platform, if any.\
The ES Module implementation internally uses [dynamic `import`](https://github.com/tc39/proposal-dynamic-import).

Since an implementation may not be available for the platform, the module entrypoint also exports an `available` boolean constant.

```javascript
export const available: boolean;

export async function shim(
    wrapBrokenImplementation: boolean = true
): Promise<{
    WeakRef: WeakRef.Constructor,
    FinalizationGroup: FinalizationGroup.Constructor,
}>;
```

#### Example

```javascript
import * as weakrefs from "tc39-weakrefs-shim";

if (weakrefs.available)
    (async () => {
        const { WeakRef, FinalizationGroup } = await weakrefs.shim();

        let obj = {};

        const weakRef = new WeakRef(obj);

        const finalizationGroup = new FinalizationGroup(iterator =>
            console.log(...iterator)
        );

        finalizationGroup.register(obj, "myObject");

        obj = undefined;
    })();
```

#### Wrapper

The `shim` export, as well as the dynamic import, automatically wraps a broken weakrefs native implementation. To prevent the behavior, use the static import and call `shim` with `wrapBrokenImplementation = false`.

#### Dynamic import

As syntactic sugar, the entrypoint will automatically load the platform's shim when dynamically imported.

```javascript
(async () => {
    const { WeakRef, FinalizationGroup } = await import("tc39-weakrefs-shim");

    if (!WeakRef || !FinalizationGroup) return;

    let obj = {};

    const weakRef = new WeakRef(obj);

    const finalizationGroup = new FinalizationGroup(iterator =>
        console.log(...iterator)
    );

    finalizationGroup.register(obj, "myObject");

    obj = undefined;
})();
```

### Direct import of a platform's implementation

The dynamic loading can be skipped and the implementation directly imported, e.g. if an external capability check is done, or the target platform is known in advance.

```javascript
import { WeakRef, FinalizationGroup } from "tc39-weakrefs-shim/module/node";
```

```javascript
const { WeakRef, FinalizationGroup } = require("tc39-weakrefs-shim/lib/node");
```

The wrapper can be imported directly as well.

```javascript
import * as globalWeakrefs from "tc39-weakrefs-shim/module/global";
import { wrap } from "tc39-weakrefs-shim/module/wrapper";

const { WeakRef, FinalizationGroup } = wrap(
    globalWeakrefs.WeakRef,
    globalWeakrefs.FinalizationGroup
);
```

## Implementation details

### Tests

The package includes generic tests for the weakrefs APIs.

On each platform the loaded shim is tested against those.\
If the native implementation is detected as broken, the wrapped implementation is used to avoid failing tests.

Some tests rely on the garbage collector being exposed as the `gc()` global. On V8 (Chrome and node), this is done through the `--expose-gc` command line flag.

If adding an implementation for another platform, please make sure the tests pass.

### Internal API

A new implementation should leverage the internal API to create the `WeakRef` and `FinalizationGroup` exports

**Note:** This section is not up-to-date with the current implementation

#### Abstract types and operations

-   `type ObjectInfo`\
    An opaque value representing information about a target object. It should not strongly hold the target as the info will be strongly held by the different internal objects.
-   `getInfo(target: object): ObjectInfo`\
    A method to get or create an info value for a specific target.
-   `isAlive(info: ObjectInfo): boolean`\
    A method to check if the target represented by an ObjectInfo value is still alive.
-   `getTarget(info: ObjectInfo): object | undefined`\
    A method to get the target object represented by an ObjectInfo value if still alive, or `undefined` if not.

#### Agent

A object abstracting the steps performed by the [ECMAScript `Agent`](https://tc39.github.io/ecma262/#sec-agents).

`WeakRef` objects internally call `agent.keepDuringJob()` when constructed and on `deref()`.\
`FinalizationGroup` objects internally register with the agent. More specifically they register for each registered target, so that a group can be released when all its registered targets are finalized.

`agent.finalization()` performs the [`DoAgentFinalization` Job](https://weakrefs.netlify.com/#sec-do-agent-finalization).

The agent's constructor takes 2 parameters:

-   `getDeadObjectInfos(): Set<ObjectInfo>`\
    A function called during the finalization job that should return a set containing `ObjectInfo` values for dead targets.
-   `hooks`: callbacks for different stages of the agent's jobs:
    -   `holdObject(object: object): void`\
        Used to perform any extra step when an object is held by the agent. Currently this should inform the scheduler that the finalization job needs to run to release the objects.
    -   `releaseObject(object: object): void`\
        Used to perform any extra step when an object is released by the agent.
    -   `registerObjectInfo(info: ObjectInfo): void`\
        Called the first time a target has been registered with any FinalizationGroup.
    -   `unregisterObjectInfo(info: ObjectInfo): void`\
        Called when a target is no longer registered with any FinalizationGroup, due to either `finalizationGroup.unregister()` calls or after finalization of the target.

#### AgentFinalizationJobScheduler

The `makeAgentFinalizationJobScheduler()` export creates a simple task scheduler for an agent's finalization.
It's only purpose is to enqueue a task when the `agent.finalization()` job needs to be performed, and cancel the task if it's no longer needed.

It returns a function, called updater, that is used to inform the scheduler for the need of a finalization job.\
The updater function should be called with a `true` parameter if there are new dead objects that need to go through the finalization step.
Currently, the updater function should also be called without any argument when objects might be held by the agent and need to be released. The scheduler will check if the agent is holding objects and schedule a `finalization` job even if no dead objects have been found.

#### WeakRef

The `createWeakRefClassShim()` export creates a `WeakRef` class for a given `agent`, using the `getInfo` and `getTarget` operations described above.

The function returns a tuple of the `WeakRef` constructor and a function to access the internal `Slots` object of a `WeakRef` instance. The later can be used if an implementation needs to create a subclass of `WeakRef` with access to its internal slots.

#### FinalizationGroup

The `createFinalizationGroupClassShim()` export creates a `FinalizationGroup` class for a given `agent`, using the `getInfo` and `isAlive` operations described above.

The function returns the `FinalizationGroup` constructor.

### Conformance

The `agent.finalization()` method is not currently fully conformant with the `DoAgentFinalization` job in the spec. It does not enqueue a job for each registered finalizationGroup's cleanup job, but instead calls them all synchronously.\
To prevent any error in a user `cleanupCallback` to interrupt the completion of the job, errors are caught, merged and retrown as a single error at the end of the finalization task.

The scheduling of the `agent.finalization()` job, while left to the specific platform shim's implementation, is likely implemented using a full task (e.g. `setImmediate`) since there is usually no platform primitive to hook into the microtask checkpoint.\
In particular, this means an object held by the agent may stay alive longer than the end of the current job.
