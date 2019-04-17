/**
 * Extracts the public shape of a class
 */
// See https://github.com/Microsoft/TypeScript/issues/471#issuecomment-381842426
export type Interface<T> = { [P in keyof T]: T[P] };

// See https://github.com/Microsoft/TypeScript/issues/30455
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

// See https://github.com/Microsoft/TypeScript/issues/16390#issuecomment-410305534
export interface ClassType<InstanceType extends {} = {}> extends Function {
    new (...args: any[]): InstanceType;
    prototype: InstanceType;
}
