"use strict";
const chai = require("chai");
const spies = require("chai-spies");
const Runner = require("mocha").Runner;

// Patch mocha to make sure hooks and tests run in the same task
// https://github.com/mochajs/mocha/issues/3009#issuecomment-479626649
Runner.immediately = process.nextTick;

chai.use(spies);

global.chai = chai;
