import { devtool } from 'doura'
import { createContainer } from './createContainer'

const {
  Provider: DouraRoot,
  useSharedModel: useRootModel,
  useStaticModel: useRootStaticModel,
  useQuery: useRootQuery,
  useAction: useRootAction,
  useInfiniteQuery: useRootInfiniteQuery,
} = createContainer({
  plugins: __DEV__ ? [[devtool]] : [],
})

export {
  DouraRoot,
  useRootModel,
  useRootStaticModel,
  useRootQuery,
  useRootAction,
  useRootInfiniteQuery,
}
