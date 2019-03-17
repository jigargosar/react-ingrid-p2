import React, { useEffect } from 'react'
import { observer, useObservable } from 'mobx-react-lite'
import { getCached, setCache } from './cache-helpers'
import * as R from 'ramda'

const rootId = 'id_root'

function createRootNode() {
  return { id: rootId, childIds: [], title: 'Root' }
}

function createInitialById() {
  return { [rootId]: createRootNode() }
}

function createInitialModel() {
  return {
    byId: createInitialById(),
  }
}

function useAppModel() {
  const model = useObservable(
    R.compose(
      R.mergeDeepRight(createInitialModel()),
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
