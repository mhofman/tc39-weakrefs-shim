export function setImmediate(handler: TimerHandler, ...args: any[]): number {
    return setTimeout(handler, 0, ...args);
}

export const clearImmediate = clearTimeout;
