import getStorage from './getStorage';
export default function createWebStorage(type) {
    const storage = getStorage(type);
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
