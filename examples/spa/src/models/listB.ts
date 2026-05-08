import { defineModel } from 'doura'
import { id } from './base-models/id'

type item = {
  id: number
  content: string
}

export const listB = defineModel({
  name: 'listB',
  models: [id],
  state: {
    arr: [
      {
        id: 0,
        item: 'content 0',
      },
      {
        id: 1,
        item: 'content 1',
      },
    ],
  },
  actions: {
    addList(payload: Partial<item> & { item: string }) {
      this.arr.push({
        id: this.arr.length + 1,
        item: payload.item,
      })
    },
    removeById(payload: number) {
      this.arr = this.arr.filter((item) => item.id !== payload)
    },
    async addContentAsync(payload: string) {
      const tempId = this.$state.arr.length
      this.addList({ item: `${payload}-id:${tempId}` })
    },
    choose(id: number) {
      this.id.setId(id)
    },
  },
  views: {
    current() {
      const current = this.arr.filter((item) => item.id === this.id.id)
      return current.length ? current[0].item : ''
    },
  },
})
