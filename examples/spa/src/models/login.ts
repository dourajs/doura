import { defineModel } from 'doura'

export const login = defineModel({
  name: 'login',
  state: { isLogin: false },
  reducers: {
    toggleLogin: (state) => {
      state.isLogin = !state.isLogin // change state by immer way
    },
  },
})

export const currentUser = defineModel(
  {
    name: 'currentUser',
    state: { user: 'user xxx' },
    reducers: {
      setUser(state, payload: string) {
        state.user = payload
      },
    },
    views: {
      userInfo() {
        return this.$dep.login.isLogin ? this.user : 'need login'
      },
    },
  },
  [login]
)
