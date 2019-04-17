interface TimerLoop {
    (nonblocking?: boolean): boolean;
}

declare function makeWindowTimer(
    target: object,
    sleep: (seconds: number) => void,
    runMicrotasks: () => void
): TimerLoop;
