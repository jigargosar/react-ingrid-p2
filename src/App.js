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

function returnNonEmptyObj(ret) {
  ow(ret, ow.object.nonEmpty)
  return ret
}

function getDisplayRootNode(model) {
  validateModel(model)
  return returnNonEmptyObj(R.pathOr(null, ['byId', rootId])(model))
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

function validateNode(node) {
  ow(
    node,
    ow.object.exactShape({
      id: ow.string.nonEmpty,
      title: ow.string,
      childIds: ow.array.ofType(String),
    }),
  )
}

function returnString(string) {
  ow(string, ow.string)
  return string
}

function getNodeTitle(node) {
  validateNode(node)
  return returnString(node.title)
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
