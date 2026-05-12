import { defineModel } from 'doura'

export const login = defineModel({
  name: 'login',
  state: { isLogin: false },
  actions: {
    toggleLogin() {
      this.isLogin = !this.isLogin
    },
  },
})

export const currentUser = defineModel({
  name: 'currentUser',
  models: [login],
  state: { user: 'user xxx' },
  actions: {
    setUser(payload: string) {
      this.user = payload
    },
  },
  views: {
    userInfo() {
      return this.login.isLogin ? this.user : 'need login'
    },
  },
})
