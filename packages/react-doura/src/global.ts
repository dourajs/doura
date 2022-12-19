import { devtool } from 'doura'
import { createContainer } from './createContainer'

const {
  Provider: DouraRoot,
  useSharedModel: useRootModel,
  useStaticModel: useRootStaticModel,
} = createContainer({
  plugins: __DEV__ ? [[devtool]] : [],
})

export { DouraRoot, useRootModel, useRootStaticModel }
