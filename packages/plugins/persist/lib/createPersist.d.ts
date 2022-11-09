import type { PersistOptions } from './types';
import { IStorageState } from './types';
export default function createPersist(config: PersistOptions): {
    update: (state: IStorageState) => void;
    flush: () => Promise<any>;
    purge: () => Promise<any>;
};
