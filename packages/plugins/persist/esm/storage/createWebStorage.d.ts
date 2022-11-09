export default function createWebStorage(type: 'local' | 'session'): {
    getItem: (key: string) => Promise<string>;
    setItem: (key: string, item: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
};
