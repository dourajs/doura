"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistModel = exports.createWebStorage = void 0;
const createPersist_1 = __importDefault(require("./createPersist"));
const getStoredState_1 = __importDefault(require("./getStoredState"));
const storage_1 = require("./storage");
Object.defineProperty(exports, "createWebStorage", { enumerable: true, get: function () { return storage_1.createWebStorage; } });
const persistModel_1 = require("./persistModel");
Object.defineProperty(exports, "persistModel", { enumerable: true, get: function () { return persistModel_1.persistModel; } });
const ACTIONTYPE = '_PERSISTSET';
function _rehydrated(storageState, store) {
    if (storageState && store.name && storageState[store.name]) {
        store.replace(storageState[store.name]);
    }
}
const douraPersist = function (options) {
    const persist = (0, createPersist_1.default)(options);
    let persistStore;
    let _douraStore;
    const unSubscribes = new Set();
    const collectLoadingStore = new Set();
    let _storageState;
    let _isPause = false;
    let _isInit = false;
    return {
        onInit(douraStore) {
            _douraStore = douraStore;
            persistStore = douraStore.getModel(persistModel_1.persistModel);
            Object.assign(persistStore, {
                purge() {
                    return persist.purge();
                },
                flush() {
                    return persist.flush();
                },
                togglePause() {
                    _isPause = !_isPause;
                    if (!_isPause && _isInit) {
                        persist.update(_douraStore.getState());
                    }
                },
            });
            if (typeof options.version !== 'undefined') {
                persistStore.$patch({
                    version: options.version,
                });
            }
            (0, getStoredState_1.default)(options)
                .then((state) => {
                var _a;
                return Promise.resolve(((_a = options.migrate) === null || _a === void 0 ? void 0 : _a.call(options, state, persistStore.$state.version)) || state)
                    .then((migrateState) => {
                    _storageState = migrateState;
                    for (const model of collectLoadingStore) {
                        _rehydrated(_storageState, model);
                    }
                    persistStore.$patch({
                        rehydrated: true,
                    });
                    collectLoadingStore.clear();
                    _isInit = true;
                })
                    .catch((err) => {
                    console.error(`douraPersist options.migrate error:`, err);
                });
            })
                .catch((err) => {
                console.error(`getStoredState inner error:`, err);
            });
        },
        onModelInstance(instance) {
            const originReducer = instance.reducer;
            instance.reducer = function (state, action) {
                if (action.type === ACTIONTYPE) {
                    return action.payload;
                }
                return originReducer(state, action);
            };
            if (_isInit) {
                _rehydrated(_storageState, instance);
            }
            else {
                collectLoadingStore.add(instance);
            }
            const unSubscribe = instance.subscribe(function () {
                if (!_isPause && _isInit) {
                    persist.update(_douraStore.getState());
                }
            });
            unSubscribes.add(unSubscribe);
        },
        onDestroy() {
            for (const unSubscribe of unSubscribes) {
                unSubscribe();
            }
        },
    };
};
__exportStar(require("./types"), exports);
exports.default = douraPersist;
