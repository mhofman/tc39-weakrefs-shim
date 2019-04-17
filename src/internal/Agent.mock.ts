import { chai } from "../../tests/setup.js";

import { Agent } from "./Agent.js";
import { Interface } from "../utils/interface.js";

export class ObjectInfoMock {
    constructor(public target: object | undefined = {}) {}
}

export class AgentMock<ObjectInfo> implements Interface<Agent<ObjectInfo>> {
    readonly registerFinalizationGroup: (
        finalizationGroup: FinalizationGroup<any>,
        info: ObjectInfo
    ) => void;
    readonly unregisterFinalizationGroup: (
        finalizationGroup: FinalizationGroup<any>,
        info: ObjectInfo
    ) => void;
    readonly keepDuringJob: (object: object) => void;

    constructor() {
        this.registerFinalizationGroup = chai.spy();
        this.unregisterFinalizationGroup = chai.spy();
        this.keepDuringJob = chai.spy();
    }
    finalization(): void {}
    get isKeepingObjects(): boolean {
        return false;
    }
}
