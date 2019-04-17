import { chai } from "../../tests/setup.js";

import { Agent } from "./Agent.js";

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

export function registerFinalizationGroup<ObjectInfo>(
    agent: Agent<ObjectInfo>,
    objectInfos: ObjectInfo[]
): [
    ChaiSpies.SpyFunc1<FinalizationGroup.CleanupIterator<any>, void>,
    Promise<any>
] {
    let cleanupCallback: ChaiSpies.SpyFunc1<
        FinalizationGroup.CleanupIterator<any>,
        void
    >;
    const cleanupCalled = new Promise(resolve => {
        cleanupCallback = chai.spy(function() {
            objectInfos.forEach(objectInfo =>
                agent.unregisterFinalizationGroup(finalizationGroup, objectInfo)
            );
            resolve();
        });
    });

    const finalizationGroup = new FinalizationGroupMock(cleanupCallback!);
    objectInfos.forEach(objectInfo =>
        agent.registerFinalizationGroup(finalizationGroup, objectInfo)
    );
    return [cleanupCallback!, cleanupCalled];
}
