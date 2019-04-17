interface Console {
    log(message?: any, ...optionalParams: any[]): void;
}

declare var console: Console;

declare function enqueueJob(callback: Function): void;
declare function drainJobQueue(): void;

declare function load(filename: string): void;

declare function sleep(seconds: number): void;
