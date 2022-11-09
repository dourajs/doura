import { defineModel } from 'doura';
export const persistModel = defineModel({
    name: '_persist',
    state: {
        rehydrated: false,
        version: -1,
    },
    actions: {},
});
