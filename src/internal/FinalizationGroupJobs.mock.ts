import { chai } from "../../tests/setup.js";

import { FinalizationGroupJobs } from "./FinalizationGroupJobs.js";
import { Interface } from "../utils/interface.js";

import { FinalizationGroup } from "../weakrefs.js";

export class ObjectInfoMock {
    constructor(public target: object | undefined = {}) {}
}

export class FinalizationGroupJobsMock<ObjectInfo = ObjectInfoMock>
    implements Interface<FinalizationGroupJobs<ObjectInfo>> {
    readonly registerFinalizationGroup: (
        finalizationGroup: FinalizationGroup,
        info: ObjectInfo
    ) => void;
    readonly unregisterFinalizationGroup: (
        finalizationGroup: FinalizationGroup,
        info: ObjectInfo
    ) => void;
    readonly checkForEmptyCells: (
        finalizationGroup: FinalizationGroup
    ) => boolean;

    constructor(
        readonly getFinalizedInFinalizationGroup: (
            finalizationGroup: FinalizationGroup
        ) => Set<ObjectInfo> = chai.spy(() => new Set())
    ) {
        this.registerFinalizationGroup = chai.spy();
        this.unregisterFinalizationGroup = chai.spy();
        this.checkForEmptyCells = chai.spy(() => true);
    }
    setFinalized(...infos: Array<ObjectInfo>): void {}
    cleanupFinalizationGroup(finalizationGroup: FinalizationGroup): void {}
}
