import { expect, it, chai } from "./setup.js";

declare namespace process {
    interface Listener {
        (...args: any[]): void;
    }

    interface AddRemoveListener {
        (eventName: string, listener: Listener): void;
    }

    var prependOnceListener: AddRemoveListener;
    var removeListener: AddRemoveListener;
    var on: AddRemoveListener;
    var listeners: (eventName: string) => Array<Listener>;
}

export function itCatchCleanStackError(
    description: string,
    test: () => void | Promise<void>,
    timeout = 50
) {
    if (typeof window == "object" && "onerror" in window) {
        it(description, async function() {
            const savedOnError = window.onerror;
            const onErrorSpy: ChaiSpies.SpyFunc1<any[], void> = chai.spy();
            const thrown = new Promise(resolve => {
                window.onerror = function(...args) {
                    onErrorSpy.call(this, args);
                    resolve();
                    return true;
                };
            });
            try {
                await test();
            } finally {
                await Promise.race([
                    thrown,
                    new Promise<void>(resolve => setTimeout(resolve, timeout)),
                ]);
                window.onerror = savedOnError;
                expect(onErrorSpy).to.have.been.called.once;
            }
        });
    } else if (typeof process == "object" && "prependOnceListener" in process) {
        it(description, async function() {
            const onErrorSpy: ChaiSpies.SpyFunc1<Error, void> = chai.spy();
            let listener: (error: Error) => void;
            const mochaListener = process.listeners("uncaughtException").pop()!;
            process.removeListener("uncaughtException", mochaListener);
            const thrown = new Promise<boolean>(resolve => {
                listener = error => {
                    onErrorSpy(error);
                    resolve(true);
                };
                process.prependOnceListener("uncaughtException", listener);
            });
            try {
                await test();
            } finally {
                const caught = await Promise.race([
                    thrown,
                    new Promise<void>(resolve => setTimeout(resolve, timeout)),
                ]);
                if (!caught)
                    process.removeListener("uncaughtException", listener!);
                process.on("uncaughtException", mochaListener);
                expect(onErrorSpy).to.have.been.called.once;
            }
        });
    } else {
        it(description);
    }
}
