/**
 * The main `bindings()` function loads the compiled bindings for a given module.
 * It uses V8's Error API to determine the parent filename that this function is
 * being invoked from, which is then used to find the root directory.
 */
declare function bindings(
    modOrOptions:
        | string
        | {
              bindings: string;
              module_root: string;
          }
): any;

declare namespace bindings {
    export const getRoot: (file: string) => string;
}

export = bindings;
