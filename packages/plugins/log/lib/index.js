"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const douraLog = function () {
    return {
        onModelInstance(instance) {
            const originDispatch = instance.dispatch;
            instance.dispatch = function (action) {
                console.log('action: ', action);
                const res = originDispatch(action);
                console.log('$state :', instance.getState());
                return res;
            };
        },
    };
};
exports.default = douraLog;
