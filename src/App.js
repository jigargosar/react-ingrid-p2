import React, { useEffect } from 'react'
import { observer, useObservable } from 'mobx-react-lite'
import { getCached, setCache } from './cache-helpers'
import * as R from 'ramda'
import ow from 'ow'

const rootId = 'id_root'

function createRootNode() {
  return { id: rootId, childIds: [], title: 'Root' }
}

function createInitialModel() {
  return {
    byId: { [rootId]: createRootNode() },
  }
}

function validateModel(model) {
  ow(model, ow.object.exactShape({ byId: ow.object.nonEmpty }))
}

function checkNode(node) {
  ow(
    node,
    ow.object.exactShape({
      id: ow.string.nonEmpty,
      title: ow.string,
      childIds: ow.array.ofType(String),
    }),
  )
  return node
}

function checkString(string) {
  ow(string, ow.string)
  return string
}

function getNodeTitle(node) {
  checkNode(node)
  return checkString(node.title)
}

function getDisplayRootNode(model) {
  validateModel(model)
  return checkNode(model.byId[rootId])
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
  const node = getDisplayRootNode(model)
  return (
    <div className="">
      <div className="">{getNodeTitle(node)}</div>
    </div>
  )
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
