/// <reference types="mocha" />

// Rely on karma to load the globals through frameworks

const globalBefore = before;
const globalAfter = after;
const globalBeforeEach = beforeEach;
const globalAfterEach = afterEach;
const globalRun = run;
const globalDescribe = describe;
const globalXDescribe = xdescribe;
const globalIt = it;
const globalXIt = xit;

export {
    globalBefore as before,
    globalAfter as after,
    globalBeforeEach as beforeEach,
    globalAfterEach as afterEach,
    globalRun as run,
    globalDescribe as describe,
    globalXDescribe as xdescribe,
    globalIt as it,
    globalXIt as xit,
};
