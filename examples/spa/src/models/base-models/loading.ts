import { defineModel } from 'doura'

export const loading = defineModel({
  name: 'loading',
  state: { isLoading: true },
  actions: {
    setLoading(payload: boolean) {
      this.isLoading = payload
    },
  },
})
