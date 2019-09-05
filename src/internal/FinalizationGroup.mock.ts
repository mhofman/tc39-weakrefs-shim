import { FinalizationGroup } from "../weakrefs.js";

export class FinalizationGroupMock implements FinalizationGroup<any> {
    constructor(
        private cleanupCallback: FinalizationGroup.CleanupCallback<any>
    ) {}

    register(target: object, holdings: any, unregisterToken?: any): void {}
    unregister(unregisterToken: any): boolean {
        return true;
    }
    cleanupSome(
        cleanupCallback: FinalizationGroup.CleanupCallback<any> = this
            .cleanupCallback
    ): void {
        cleanupCallback(undefined!);
    }
}
