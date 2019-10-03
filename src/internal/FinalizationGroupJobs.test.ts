import { describe, it, expect, beforeEach, chai } from "../../tests/setup.js";

import { FinalizationGroup } from "../weakrefs.js";
import {
    FinalizationGroupJobs,
    createFinalizationGroupJobs,
} from "./FinalizationGroupJobs.js";
import { ObjectInfoMock } from "./ObjectInfo.mock.js";
import { FinalizationGroupMock } from "./FinalizationGroup.mock.js";

describe("FinalizationGroupJobs", function() {
    let scheduleCleanupFinalizationGroup: ChaiSpies.SpyFunc1<
        FinalizationGroup,
        number
    >;
    let registerObjectInfo: ChaiSpies.SpyFunc1<ObjectInfoMock, void>;
    let unregisterObjectInfo: ChaiSpies.SpyFunc1<ObjectInfoMock, void>;
    let jobs: FinalizationGroupJobs<ObjectInfoMock>;

    beforeEach(function() {
        scheduleCleanupFinalizationGroup = chai.spy(() => 1);
        registerObjectInfo = chai.spy();
        unregisterObjectInfo = chai.spy();

        jobs = createFinalizationGroupJobs(scheduleCleanupFinalizationGroup, {
            registerObjectInfo,
            unregisterObjectInfo,
        });
    });

    it("should allow multiple FinalizationGroup registrations for the same object", async function() {
        const objectInfo = new ObjectInfoMock();

        const finalizationGroup1 = new FinalizationGroupMock(() => {});
        jobs.registerFinalizationGroup(finalizationGroup1, objectInfo);

        const finalizationGroup2 = new FinalizationGroupMock(() => {});
        jobs.registerFinalizationGroup(finalizationGroup2, objectInfo);

        expect(registerObjectInfo).to.have.been.called.once;
        expect(registerObjectInfo).to.have.been.called.with(objectInfo);

        expect(jobs.checkForEmptyCells(finalizationGroup1)).to.be.false;
        expect(jobs.checkForEmptyCells(finalizationGroup2)).to.be.false;

        jobs.setFinalized(objectInfo);

        expect(scheduleCleanupFinalizationGroup).to.have.been.called.twice;
        expect(scheduleCleanupFinalizationGroup).to.have.been.called.with(
            finalizationGroup1
        );
        expect(scheduleCleanupFinalizationGroup).to.have.been.called.with(
            finalizationGroup2
        );

        expect(unregisterObjectInfo).to.have.been.called.once;
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfo);

        expect(jobs.checkForEmptyCells(finalizationGroup1)).to.be.true;
        expect(jobs.checkForEmptyCells(finalizationGroup2)).to.be.true;

        jobs.unregisterFinalizationGroup(finalizationGroup1, objectInfo);
        jobs.unregisterFinalizationGroup(finalizationGroup2, objectInfo);

        expect(jobs.checkForEmptyCells(finalizationGroup1)).to.be.false;
        expect(jobs.checkForEmptyCells(finalizationGroup2)).to.be.false;
    });

    it("should allow one FinalizationGroup registration for multiple objects", async function() {
        const objectInfos = [new ObjectInfoMock(), new ObjectInfoMock()];

        const finalizationGroup = new FinalizationGroupMock(() => {});
        jobs.registerFinalizationGroup(finalizationGroup, objectInfos[0]);
        jobs.registerFinalizationGroup(finalizationGroup, objectInfos[1]);

        expect(registerObjectInfo).to.have.been.called.twice;
        expect(registerObjectInfo).to.have.been.called.with(objectInfos[0]);
        expect(registerObjectInfo).to.have.been.called.with(objectInfos[1]);

        expect(jobs.checkForEmptyCells(finalizationGroup)).to.be.false;

        jobs.setFinalized(...objectInfos);

        expect(scheduleCleanupFinalizationGroup).to.have.been.called.once;
        expect(scheduleCleanupFinalizationGroup).to.have.been.called.with(
            finalizationGroup
        );

        expect(unregisterObjectInfo).to.have.been.called.twice;
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfos[0]);
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfos[1]);

        expect(jobs.checkForEmptyCells(finalizationGroup)).to.be.true;
        jobs.unregisterFinalizationGroup(finalizationGroup, objectInfos[0]);
        expect(jobs.checkForEmptyCells(finalizationGroup)).to.be.true;
        jobs.unregisterFinalizationGroup(finalizationGroup, objectInfos[1]);
        expect(jobs.checkForEmptyCells(finalizationGroup)).to.be.false;
    });

    it("should ignore unregistered objects", async function() {
        const objectInfo = new ObjectInfoMock();
        const finalizationGroup = new FinalizationGroupMock(() => {});

        jobs.registerFinalizationGroup(finalizationGroup, objectInfo);

        expect(registerObjectInfo).to.have.been.called.once;
        expect(registerObjectInfo).to.have.been.called.with(objectInfo);

        jobs.unregisterFinalizationGroup(finalizationGroup, objectInfo);

        expect(unregisterObjectInfo).to.have.been.called.once;
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfo);

        expect(jobs.checkForEmptyCells(finalizationGroup)).to.be.false;
        jobs.setFinalized(objectInfo);

        expect(scheduleCleanupFinalizationGroup).to.not.have.been.called();
        expect(jobs.checkForEmptyCells(finalizationGroup)).to.be.false;
    });
});
