// @ts-ignore
this.queueMicrotask =
    this.enqueueJob ||
    function queueMicrotask(callback: Function) {
        Promise.resolve().then(callback as (value: void) => void);
    };

this.sleep =
    this.sleep ||
    (() => {
        const i32a = new Int32Array(new SharedArrayBuffer(4));

        return function sleep(s: number) {
            Atomics.wait(i32a, 0, 0, s * 1000);
        };
    })();

// @ts-ignore
this.execute = (() => {
    load("windowTimers.js");

    type DoneCallback = (err?: Error, retVal?: any) => void;

    function sync(
        gen: (resume: DoneCallback) => Iterator<any>,
        done: DoneCallback
    ) {
        const iterable = gen(resume);
        let savedResult: { err: Error | undefined; retVal: any } | undefined;
        let inGen = false;

        function next() {
            const { err, retVal } = savedResult || {};
            savedResult = undefined;
            if (err) iterable.throw!(err);
            try {
                inGen = true;
                const nextRes = iterable.next(retVal);
                if (nextRes.done) done();
            } catch (err) {
                done(err);
            } finally {
                inGen = false;
            }

            if (savedResult) next();
        }

        function resume(err?: Error, retVal?: any) {
            if (savedResult)
                throw new Error("resume called twice without yield");
            savedResult = { err, retVal };
            if (!inGen) next();
        }

        next();
    }

    const canDrainNestedMicrotasks = typeof setTimeout === "function";

    const runMicrotasks = (() => {
        const asyncDrain: (callback: () => void) => void =
            typeof setTimeout === "function"
                ? setTimeout
                : typeof drainJobQueue === "function"
                ? function(callback) {
                      drainJobQueue();
                      callback();
                  }
                : callback => callback();

        return function(done: () => void) {
            asyncDrain(done);
        };
    })();

    const timerLoop = makeWindowTimer(
        // @ts-ignore
        this
    );

    return function execute(
        scripts?: string[],
        modules?: string[],
        importModule?: (module: string) => Promise<any>,
        done: DoneCallback = () => {}
    ) {
        sync(function*(resume) {
            if (scripts)
                for (const script of scripts) {
                    load(script);
                    yield runMicrotasks(resume);
                }

            if (modules)
                for (const module of modules) {
                    const promise = importModule!(module);
                    yield canDrainNestedMicrotasks
                        ? promise.then(() => runMicrotasks(resume), resume)
                        : runMicrotasks(resume);
                }

            yield runMicrotasks(resume);
            for (const time of timerLoop()) {
                if (time > 0) {
                    sleep(time / 1000);
                } else {
                    yield runMicrotasks(resume);
                }
            }
        }, done);
    };
})();
