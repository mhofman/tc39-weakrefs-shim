import { chai } from "../../tests/setup.js";

import { WeakRefJobs } from "./WeakRefJobs.js";

export class WeakRefJobsMock<ObjectInfo> implements WeakRefJobs {
    readonly keepDuringJob: (object: object) => void;

    constructor() {
        this.keepDuringJob = chai.spy();
    }
    clearKeptObjects(): void {}
    get isKeepingObjects(): boolean {
        return false;
    }
}
