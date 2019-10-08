// Copied from https://github.com/GoogleChromeLabs/jsvu/blob/master/cli.js

"use strict";

const os = require("os");

const getPlatform = () => {
    const platform = os.platform();
    switch (platform) {
        case "darwin": {
            return "mac";
        }
        case "win32": {
            return "win";
        }
        default: {
            return "linux";
        }
    }
};

const guessOs = () => {
    const platform = getPlatform();
    if (platform === "mac") {
        return "mac64";
    }
    // Note: `os.arch()` returns the architecture of the Node.js process,
    // which does not necessarily correspond to the system architecture.
    // Still, if the user runs a 64-bit version of Node.js, it’s safe to
    // assume the underlying architecture is 64-bit as well.
    // https://github.com/nodejs/node/issues/17036
    const arch = os.arch().includes("64") ? "64" : "32";
    const identifier = `${platform}${arch}`;
    return identifier;
};

console.log(guessOs());
