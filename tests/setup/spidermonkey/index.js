load("./runner.js");

execute(
    [
        "global.js",
        "../../../../node_modules/karma/static/context.js",
        "debug.js",
        "karma-config.js",
        "../../../../node_modules/chai/chai.js",
        "../../../../node_modules/karma-chai/adapter.js",
        "../../../../node_modules/chai-spies/chai-spies.js",
        "../../../../node_modules/mocha/mocha.js",
        "../../../../node_modules/karma-mocha/lib/adapter.js",
    ],
    [
        "../../../src/utils/tasks/taskQueue.test.js",
        "../../../src/index.test.js",
        "../../../src/internal/FinalizationGroupJobs.test.js",
        "../../../src/internal/FinalizationGroup.test.js",
        "../../../src/internal/WeakRefJobs.test.js",
        "../../../src/internal/WeakRef.test.js",
        "../../../src/wrapper.test.js",
        "../../../src/spidermonkey/internal.test.js",
        "./karma-start.js",
    ],
    // Needed for module resolution somehow
    module => import(module)
);
