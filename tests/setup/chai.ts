/// <reference types="chai" />
/// <reference types="chai-spies" />

// Rely on karma to load the globals through frameworks

const globalChai = chai;

const expect = chai.expect;
const should = chai.should();
const assert = chai.assert;

export { globalChai as chai, expect, should, assert };
