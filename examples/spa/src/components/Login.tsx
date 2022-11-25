import * as React from 'react'
import { ModelAPI } from 'doura'
import { useRootModel } from 'doura-react'

import { login, currentUser } from '../models/login'

type currentUserSelectorParams = ModelAPI<typeof currentUser>

const currentUserSelector = function (
  stateAndViews: currentUserSelectorParams
) {
  return {
    userInfo: stateAndViews.userInfo,
  }
}

function Login() {
  const [{ isLogin }, { toggleLogin }] = useRootModel(login)
  const [{ userInfo }, _] = useRootModel(currentUser, currentUserSelector)
  return (
    <div>
      <h3>
        useRootModel isLogin: {isLogin.toString()}, currentUser: {userInfo}
      </h3>
      <button onClick={() => toggleLogin()}>toggleLogin</button>
      <hr />
    </div>
  )
}

export default Login
