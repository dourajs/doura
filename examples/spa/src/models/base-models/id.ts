import { defineModel } from 'doura'

export const id = defineModel({
  name: 'id',
  state: { id: 0 },
  actions: {
    setId(payload: number) {
      this.id = payload
    },
  },
})
