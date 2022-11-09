import { Plugin, AnyModel } from 'doura';
import { createWebStorage } from './storage';
import { persistModel } from './persistModel';
import { PersistOptions } from './types';
declare const douraPersist: Plugin<AnyModel, PersistOptions>;
export { createWebStorage, persistModel };
export * from './types';
export default douraPersist;
