const Module = require("module");

// Strip .js extensions for relative imports
const oldResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parentModule, isMain) {
    if (
        /^\.{0,2}[/].*\.js$/.test(request) &&
        !parentModule.filename.includes("node_modules")
    ) {
        request = request.substr(0, request.length - 3);
    }

    return oldResolveFilename.call(this, request, parentModule, isMain);
};
