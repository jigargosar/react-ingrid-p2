import React, { useEffect } from 'react'
import { observer, useObservable } from 'mobx-react-lite'
import { getCached, setCache } from './cache-helpers'
import * as R from 'ramda'

function useAppModel() {
  const rootId = 'id_root'
  const model = useObservable(
    R.compose(
      R.mergeDeepRight({
        byId: { [rootId]: { id: rootId, childIds: [], title: 'Root' } },
      }),
      R.defaultTo({}),
      getCached,
    )('app-model'),
  )

  useEffect(() => {
    setCache('app-model', model)
  }, [model])

  return [model]
}

const RootTree = observer(({ model }) => {
  return <div className="">HW</div>
})

RootTree.displayName = 'RootTree'

const App = observer(() => {
  const [model] = useAppModel()

  return (
    <div className={`min-vh-100`}>
      <RootTree model={model} />
    </div>
  )
})

App.displayName = 'App'

export default App
