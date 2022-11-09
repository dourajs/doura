"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistModel = void 0;
const doura_1 = require("doura");
exports.persistModel = (0, doura_1.defineModel)({
    name: '_persist',
    state: {
        rehydrated: false,
        version: -1,
    },
    actions: {},
});
