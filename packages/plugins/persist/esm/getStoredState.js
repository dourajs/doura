import { deserialize } from './utils';
export default function getStoredState(options) {
    const storageKey = options.key;
    const storage = options.storage;
    return storage.getItem(storageKey).then((serialized) => {
        if (!serialized)
            return undefined;
        else {
            try {
                const state = {};
                const rawState = deserialize(serialized);
                Object.keys(rawState).forEach((key) => {
                    state[key] = deserialize(rawState[key]);
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
