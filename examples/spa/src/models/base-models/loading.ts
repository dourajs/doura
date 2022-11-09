import { defineModel } from 'doura'

export const loading = defineModel({
  name: 'loading',
  state: { isLoading: true },
  reducers: {
    isLoading: (state) => {
      state.isLoading = true
    },
    notLoading: (state) => {
      state.isLoading = false
    },
  },
})
