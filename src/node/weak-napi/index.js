// @ts-ignore
const bindings = require("bindings");

// Use the native bindings of the weak-napi package directly
module.exports = bindings({
    bindings: "weakref.node",
    module_root: bindings.getRoot(require.resolve("weak-napi")),
});
