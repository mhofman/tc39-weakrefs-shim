import {
    describe,
    expect,
    beforeEach,
    it,
    chai,
} from "../../../tests/setup.js";

import makeTaskQueue, { queueId, TaskQueue } from "./taskQueue.js";
import { itCatchCleanStackError } from "../../../tests/global-error-helper.js";

describe("TaskQueue", function() {
    let queuedTasks: Set<queueId>;
    let set: TaskQueue.Set<queueId>;
    let clear: TaskQueue.Clear<queueId>;
    let process: TaskQueue.Internal.Process<queueId>;

    beforeEach(function() {
        const testQueuedTasks = new Set<queueId>();
        queuedTasks = testQueuedTasks;
        ({ set, clear, process } = makeTaskQueue((queueId: queueId) => {
            testQueuedTasks.add(queueId);
            return true;
        }, true));
    });

    it("should enqueue and call tasks", async function() {
        const callbacks = [chai.spy(), chai.spy()];
        const ids = callbacks.map(callback => set(callback));
        expect(queuedTasks).to.have.lengthOf(callbacks.length);
        expect([...queuedTasks]).to.have.members(ids);
        [...queuedTasks].forEach(process);
        callbacks.forEach(
            callback => expect(callback).to.have.been.called.once
        );
    });

    it("should call tasks with provided args", async function() {
        const callback = chai.spy();
        const args: [object, undefined, null, Function, number, boolean] = [
            {},
            undefined,
            null,
            () => {},
            5,
            true,
        ];
        set(callback, ...args);
        [...queuedTasks].forEach(process);
        expect(callback).to.have.been.called.with(...args);
    });

    it("can cancel a task", async function() {
        const callbacks = [chai.spy(), chai.spy()];
        const ids = callbacks.map(callback => set(callback));
        expect(queuedTasks).to.have.lengthOf(callbacks.length);
        clear(ids[0]);
        [...queuedTasks].forEach(process);
        expect(callbacks[0]).to.not.have.been.called;
        expect(callbacks[1]).to.have.been.called.once;
    });

    it("can't set task if register returns false", async function() {
        const { set } = makeTaskQueue((queueId: queueId) => false);
        expect(() => set(chai.spy())).to.throw();
    });

    it("can't set task if register throws", async function() {
        const error = new Error();
        const { set } = makeTaskQueue((queueId: queueId) => {
            throw error;
        });
        expect(() => set(chai.spy())).to.throw(error);
    });

    it("can let callback errors bubble up", async function() {
        const error = new Error();
        const id = set(() => {
            throw error;
        });
        expect(() => process(id)).to.throw(error);
    });

    itCatchCleanStackError(
        "can catch and rethrow errors on a clean stack",
        async function() {
            ({ set, clear, process } = makeTaskQueue((queueId: queueId) => {
                queuedTasks.add(queueId);
                return true;
            }, false));
            const error = new Error();
            const id = set(() => {
                throw error;
            });
            expect(() => process(id)).to.not.throw();
        }
    );

    it("can cancel task when not bubbling", async function() {
        ({ set, clear, process } = makeTaskQueue((queueId: queueId) => {
            queuedTasks.add(queueId);
            return true;
        }, false));
        const callbacks = [chai.spy(), chai.spy()];
        const ids = callbacks.map(callback => set(callback));
        expect(queuedTasks).to.have.lengthOf(callbacks.length);
        clear(ids[0]);
        [...queuedTasks].forEach(process);
        expect(callbacks[0]).to.not.have.been.called;
        expect(callbacks[1]).to.have.been.called.once;
    });
});
