import { defineModel } from 'doura'

export const persistModel = defineModel({
  name: '_persist',
  state: {
    rehydrated: false,
    version: -1,
  },
  actions: {} as {
    purge(): Promise<any>
    flush(): Promise<any>
    togglePause(): void
  },
})
