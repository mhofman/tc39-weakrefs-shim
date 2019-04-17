import { describe, it, expect, beforeEach, chai } from "../../tests/setup.js";

import { Agent } from "./Agent.js";
import { merge } from "../utils/set.js";
import { ObjectInfoMock } from "./Agent.mock.js";
import {
    registerFinalizationGroup,
    FinalizationGroupMock,
} from "./FinalizationGroup.mock.js";

describe("Agent", function() {
    let holdObject: ChaiSpies.SpyFunc1<object, void>;
    let releaseObject: ChaiSpies.SpyFunc1<object, void>;
    let registerObjectInfo: ChaiSpies.SpyFunc1<ObjectInfoMock, void>;
    let unregisterObjectInfo: ChaiSpies.SpyFunc1<ObjectInfoMock, void>;
    let getDeadObjectInfos: ChaiSpies.SpyFunc0<Set<ObjectInfoMock>>;
    let deadObjectInfos: Set<ObjectInfoMock>;
    let agent: Agent<ObjectInfoMock>;

    beforeEach(function() {
        deadObjectInfos = new Set();
        holdObject = chai.spy();
        releaseObject = chai.spy();
        registerObjectInfo = chai.spy();
        unregisterObjectInfo = chai.spy();
        getDeadObjectInfos = chai.spy(() => deadObjectInfos);
        agent = new Agent(getDeadObjectInfos, {
            holdObject,
            releaseObject,
            registerObjectInfo,
            unregisterObjectInfo,
        });
    });

    it("should allow multiple FinalizationGroup registrations for the same object", async function() {
        const objectInfos = [new ObjectInfoMock()];

        const [cleanupCallback1] = registerFinalizationGroup(
            agent,
            objectInfos
        );
        const [cleanupCallback2] = registerFinalizationGroup(
            agent,
            objectInfos
        );

        expect(registerObjectInfo).to.have.been.called.once;
        expect(registerObjectInfo).to.have.been.called.with(objectInfos[0]);

        merge(deadObjectInfos, objectInfos);
        agent.finalization();
        expect(getDeadObjectInfos).to.have.been.called();
        deadObjectInfos.clear();

        expect(cleanupCallback1).to.have.been.called.once;
        expect(cleanupCallback2).to.have.been.called.once;
        expect(unregisterObjectInfo).to.have.been.called.once;
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfos[0]);
    });

    it("should allow one FinalizationGroup registration for multiple objects", async function() {
        const objectInfos = [new ObjectInfoMock(), new ObjectInfoMock()];

        const [cleanupCallback] = registerFinalizationGroup(agent, objectInfos);

        expect(registerObjectInfo).to.have.been.called.twice;
        expect(registerObjectInfo).to.have.been.called.with(objectInfos[0]);
        expect(registerObjectInfo).to.have.been.called.with(objectInfos[1]);

        merge(deadObjectInfos, objectInfos);
        agent.finalization();
        expect(getDeadObjectInfos).to.have.been.called();
        deadObjectInfos.clear();

        expect(cleanupCallback).to.have.been.called.once;
        expect(unregisterObjectInfo).to.have.been.called.twice;
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfos[0]);
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfos[1]);
    });

    it("cleans up even if FinalizationGroup doesn't remove registration", async function() {
        const objectInfo = new ObjectInfoMock();
        const cleanupCallback = chai.spy();
        const finalizationGroup = new FinalizationGroupMock(cleanupCallback!);
        agent.registerFinalizationGroup(finalizationGroup, objectInfo);

        expect(registerObjectInfo).to.have.been.called.once;
        expect(registerObjectInfo).to.have.been.called.with(objectInfo);

        deadObjectInfos.add(objectInfo);
        agent.finalization();
        expect(getDeadObjectInfos).to.have.been.called();
        deadObjectInfos.clear();

        expect(cleanupCallback).to.have.been.called.once;
        expect(unregisterObjectInfo).to.have.been.called.once;
        expect(unregisterObjectInfo).to.have.been.called.with(objectInfo);
    });

    it("can keep object alive during job", async function() {
        const object = {};

        agent.keepDuringJob(object);
        expect(holdObject).to.have.been.called.once;
        expect(holdObject).to.have.been.called.with(object);

        agent.finalization();
        expect(releaseObject).to.have.been.called.once;
        expect(releaseObject).to.have.been.called.with(object);
    });

    it("can be told to keep alive the same object multiple times", async function() {
        const object = {};

        agent.keepDuringJob(object);
        agent.keepDuringJob(object);

        expect(holdObject).to.have.been.called.once;
        expect(holdObject).to.have.been.called.with(object);
    });
});
