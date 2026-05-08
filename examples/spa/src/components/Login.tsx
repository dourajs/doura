import * as React from 'react'
import { ModelData } from 'doura'
import { useModel } from 'react-doura'

import { login, currentUser } from '../models/login'

type currentUserSelectorParams = ModelData<typeof currentUser>

const currentUserSelector = function (
  stateAndViews: currentUserSelectorParams
) {
  return {
    userInfo: stateAndViews.userInfo,
  }
}

function Login() {
  const loginState = useModel(login)
  const { userInfo } = useModel(currentUser, currentUserSelector)
  return (
    <div>
      <h3>
        useModel isLogin: {loginState.isLogin.toString()}, currentUser:{' '}
        {userInfo}
      </h3>
      <button onClick={() => loginState.toggleLogin()}>toggleLogin</button>
      <hr />
    </div>
  )
}

export default Login
