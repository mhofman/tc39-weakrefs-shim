import { combine } from "./iterable.js";

export function intersects<T>(a: Set<T>, b: Set<T>): boolean {
    if (a.size > b.size) [b, a] = [a, b];

    for (const elem of a) {
        if (b.has(elem)) return true;
    }

    return false;
}

export function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
    let res;
    if (a.size <= b.size) {
        res = new Set<T>();
        for (const info of a) {
            if (!b.has(info)) res.add(info);
        }
    } else {
        res = new Set(a);
        remove(res, b);
    }
    return res;
}

export function merge<T>(dest: Set<T>, ...iterables: Iterable<T>[]) {
    for (const item of combine(...iterables)) {
        dest.add(item);
    }
}

export function remove<T>(dest: Set<T>, ...iterables: Iterable<T>[]) {
    for (const item of combine(...iterables)) {
        dest.delete(item);
    }
}
