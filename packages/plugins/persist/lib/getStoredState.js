"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
function getStoredState(options) {
    const storageKey = options.key;
    const storage = options.storage;
    return storage.getItem(storageKey).then((serialized) => {
        if (!serialized)
            return undefined;
        else {
            try {
                const state = {};
                const rawState = (0, utils_1.deserialize)(serialized);
                Object.keys(rawState).forEach((key) => {
                    state[key] = (0, utils_1.deserialize)(rawState[key]);
                });
                return state;
            }
            catch (err) {
                if (process.env.NODE_ENV === 'development')
                    console.log(`persist/getStoredState: Error restoring data ${serialized}`, err);
                throw err;
            }
        }
    });
}
exports.default = getStoredState;
