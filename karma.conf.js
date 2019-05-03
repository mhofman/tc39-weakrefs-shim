let coveragePreprocessors = ["karma-coverage-istanbul-instrumenter"];
let browsers = ["GCChromeHeadless"];
let flags = ['--js-flags="--expose-gc --harmony-weak-refs"'];
let singleRun = true;
if (process.argv.some(arg => arg === "--debug")) {
    coveragePreprocessors = [];
    browsers = ["GCChromeDebug"];
    singleRun = false;
}
if (process.env.INSIDE_DOCKER) {
    flags.push("--no-sandbox");
}

module.exports = function(config) {
    const configuration = {
        basePath: "",
        frameworks: ["mocha", "chai-spies", "chai", "karma-typescript"],
        files: [
            {
                pattern: "src/**/!(*.shared)@(.test|.spec).@(ts|mjs|js)",
                type: "module",
            },
            {
                pattern: "src/**/*.@(ts|mjs|js)",
                included: false,
            },
            {
                pattern: "tests/fixtures/*",
                included: false,
            },
            {
                pattern:
                    "tests/**/!(*+(.mock|.shared))@(.test|.spec).@(ts|mjs|js)",
                type: "module",
            },
            {
                pattern: "tests/**/*.@(ts|mjs|js)",
                included: false,
            },
        ],
        karmaTypescriptConfig: {
            bundlerOptions: {
                addNodeGlobals: false,
            },
            coverageOptions: {
                instrumentation: false,
            },
            tsconfig: "./tsconfig.json",
            compilerOptions: {
                noEmit: false,
            },
        },
        preprocessors: {
            "**/tests/*.ts": ["karma-typescript"],
            "tests/setup/*.ts": ["karma-typescript"],
            "src/**/*+(.test|.mock|.spec)*(.*).ts": ["karma-typescript"],
            "src/!(*+(.test|.mock|.spec)*(.*)).ts": [
                "karma-typescript",
                ...coveragePreprocessors,
            ],
            "src/**/!(tests)/!(*+(.test|.mock|.spec)*(.*)).ts": [
                "karma-typescript",
                ...coveragePreprocessors,
            ],
            "src/!(*+(.test|.mock|.spec)*(.*)).@(mjs|js)": [
                ...coveragePreprocessors,
            ],
            "src/**/!(tests)/!(*+(.test|.mock|.spec)*(.*)).@(mjs|js)": [
                ...coveragePreprocessors,
            ],
        },
        coverageIstanbulInstrumenter: {
            esModules: true,
        },
        coverageIstanbulReporter: {
            reports: ["html", "lcovonly"],
            dir: "coverage",
        },
        reporters: ["mocha", "coverage-istanbul"],
        port: 9876,
        colors: true,
        autoWatch: true,
        singleRun,
        concurrency: Infinity,
        browsers,
        customLaunchers: {
            GCChromeHeadless: {
                base: "ChromeCanaryHeadless",
                flags,
            },
            GCChromeDebug: {
                base: "ChromeCanary",
                flags,
                chromeDataDir: ".chrome",
            },
        },
    };

    config.set(configuration);
};
