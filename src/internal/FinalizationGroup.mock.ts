import { FinalizationGroup } from "../weakrefs.js";

export class FinalizationGroupMock implements FinalizationGroup {
    constructor(private cleanupCallback: FinalizationGroup.CleanupCallback) {}

    register(target: object, holdings: any, unregisterToken?: any): void {}
    unregister(unregisterToken: any): boolean {
        return true;
    }
    cleanupSome(
        cleanupCallback: FinalizationGroup.CleanupCallback = this
            .cleanupCallback
    ): void {
        cleanupCallback(undefined!);
    }
}
