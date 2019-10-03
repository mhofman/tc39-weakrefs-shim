import { describe, it, expect, beforeEach, chai } from "../../tests/setup.js";

import { createWeakRefJobs, WeakRefJobs } from "./WeakRefJobs.js";

describe("WeakRefJobs", function() {
    let scheduleClearKeptObjects: ChaiSpies.SpyFunc0<number>;
    let holdObject: ChaiSpies.SpyFunc1<object, void>;
    let releaseObject: ChaiSpies.SpyFunc1<object, void>;
    let jobs: WeakRefJobs;

    beforeEach(function() {
        scheduleClearKeptObjects = chai.spy(() => 1);
        holdObject = chai.spy();
        releaseObject = chai.spy();
        jobs = createWeakRefJobs(scheduleClearKeptObjects, {
            holdObject,
            releaseObject,
        });
    });

    it("can keep objects alive during job", async function() {
        const objects = [{}, {}];

        jobs.keepDuringJob(objects[0]);
        jobs.keepDuringJob(objects[1]);
        expect(holdObject).to.have.been.called.twice;
        expect(holdObject).to.have.been.called.with(objects[0]);
        expect(holdObject).to.have.been.called.with(objects[1]);

        expect(scheduleClearKeptObjects).to.have.been.called.once;

        jobs.clearKeptObjects();
        expect(releaseObject).to.have.been.called.twice;
        expect(releaseObject).to.have.been.called.with(objects[0]);
        expect(releaseObject).to.have.been.called.with(objects[1]);
    });

    it("can be told to keep alive the same object multiple times", async function() {
        const object = {};

        jobs.keepDuringJob(object);
        jobs.keepDuringJob(object);

        expect(holdObject).to.have.been.called.once;
        expect(holdObject).to.have.been.called.with(object);

        expect(scheduleClearKeptObjects).to.have.been.called.once;

        jobs.clearKeptObjects();
        expect(releaseObject).to.have.been.called.once;
        expect(releaseObject).to.have.been.called.with(object);
    });
});
