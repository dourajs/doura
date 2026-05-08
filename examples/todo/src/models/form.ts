import { defineModel } from 'doura'
import React from 'react'

export const inputModel = defineModel({
  name: 'inputModel',
  state: {
    value: '',
  },
  actions: {
    update(event: React.ChangeEvent<HTMLInputElement>) {
      this.value = event.target.value
    },
    reset() {
      this.value = ''
    },
  },
})
