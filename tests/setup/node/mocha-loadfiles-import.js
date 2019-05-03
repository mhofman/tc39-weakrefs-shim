"use strict";

const path = require("path");

const Mocha = require("mocha");
var EVENT_FILE_PRE_REQUIRE = Mocha.Suite.constants.EVENT_FILE_PRE_REQUIRE;
var EVENT_FILE_POST_REQUIRE = Mocha.Suite.constants.EVENT_FILE_POST_REQUIRE;
var EVENT_FILE_REQUIRE = Mocha.Suite.constants.EVENT_FILE_REQUIRE;

Mocha.prototype.loadFiles = function(fn) {
    var self = this;
    var suite = this.suite;
    Promise.all(
        this.files.map(function(file) {
            file = path.resolve(file);
            suite.emit(EVENT_FILE_PRE_REQUIRE, global, file, self);
            return import(file).then(fileExport => {
                suite.emit(EVENT_FILE_REQUIRE, fileExport, file, self);
                suite.emit(EVENT_FILE_POST_REQUIRE, global, file, self);
            });
        })
    ).then(() => {
        fn && fn();
    });
};

const originalRun = Mocha.prototype.run;

Mocha.prototype.run = function(fn) {
    if (this.files.length) {
        this.loadFiles(() => {
            this.loadFiles = fn => {
                delete this.loadFiles;
                fn && fn();
            };
            originalRun.call(this, fn);
        });
    } else {
        originalRun.call(this, fn);
    }
};
