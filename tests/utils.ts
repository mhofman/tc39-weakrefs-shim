export async function threw<T>(result: Promise<T>): Promise<Error | boolean> {
    try {
        await result;
    } catch (err) {
        return (err as Error) || true;
    }
    return false;
}
