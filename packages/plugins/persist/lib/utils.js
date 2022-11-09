"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serialize = exports.deserialize = void 0;
function deserialize(serial) {
    return JSON.parse(serial);
}
exports.deserialize = deserialize;
function serialize(data) {
    return JSON.stringify(data);
}
exports.serialize = serialize;
