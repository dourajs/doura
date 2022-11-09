"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const getStorage_1 = __importDefault(require("./getStorage"));
function createWebStorage(type) {
    const storage = (0, getStorage_1.default)(type);
    return {
        getItem: (key) => {
            return new Promise((resolve) => {
                resolve(storage.getItem(key));
            });
        },
        setItem: (key, item) => {
            return new Promise((resolve) => {
                resolve(storage.setItem(key, item));
            });
        },
        removeItem: (key) => {
            return new Promise((resolve) => {
                resolve(storage.removeItem(key));
            });
        },
    };
}
exports.default = createWebStorage;
