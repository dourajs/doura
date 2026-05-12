import { defineModel } from 'doura'
import { loading } from './base-models/loading'
import { delay } from './utils'

// loading is part of the fetchA and fetchB, use depend to compose

export const fetchA = defineModel({
  name: 'fetchA',
  models: [loading],
  state: {
    data: [] as string[],
  },
  actions: {
    setData(payload: string[] = []) {
      this.data = payload
    },
    fetchAData(arg: string) {
      this.loading.setLoading(true)
      void delay(200)
      this.setData([arg])
      this.loading.setLoading(false)
    },
  },
  views: {
    isLoading() {
      return this.loading.isLoading
    },
  },
})

export const fetchB = defineModel({
  name: 'fetchB',
  models: [loading],
  state: {
    data: [] as number[],
  },
  actions: {
    setData(payload: number[] = []) {
      this.data = payload
    },
    fetchBData(arg: number) {
      this.loading.setLoading(true)
      void delay(200)
      this.setData([arg])
      this.loading.setLoading(false)
    },
  },
  views: {
    isLoading() {
      return this.loading.isLoading
    },
  },
})
