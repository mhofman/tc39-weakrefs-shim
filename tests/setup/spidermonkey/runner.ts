// @ts-ignore
this.queueMicrotask = enqueueJob;

var execute = (() => {
    load("windowTimers.js");

    const timerLoop = makeWindowTimer(
        // @ts-ignore
        this,
        function(ms: number) {
            sleep(ms / 1000);
        },
        drainJobQueue
    );

    return function execute(
        scripts?: string[],
        modules?: string[],
        importModule?: (module: string) => void
    ) {
        drainJobQueue();

        if (scripts)
            for (const script of scripts) {
                load(script);
                drainJobQueue();
            }

        if (modules)
            for (const module of modules) {
                importModule!(module);
            }

        drainJobQueue();
        timerLoop();
    };
})();
