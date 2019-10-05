interface TimerLoop {
    (): IterableIterator<number>;
}

declare function makeWindowTimer(target: object): TimerLoop;
