declare var gc: () => void;

const gcAvailable = typeof gc == "function";

const globalGc = gcAvailable ? gc : undefined;

export { gcAvailable as available, globalGc as gc };
