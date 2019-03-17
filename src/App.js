import React, { useEffect } from 'react'
import { observer, useObservable } from 'mobx-react-lite'
import { getCached, setCache } from './cache-helpers'
import * as R from 'ramda'
import ow from 'ow'
import validate from 'aproba'

const rootId = 'id_root'

function createRootNode() {
  return { id: rootId, childIds: [], title: 'Root', collapsed: false }
}

function createInitialModel() {
  return {
    byId: { [rootId]: createRootNode() },
  }
}

function checkModel(model) {
  ow(model, ow.object.exactShape({ byId: ow.object.nonEmpty }))
  return model
}

const nodePredicate = ow.object.exactShape({
  id: ow.string.nonEmpty,
  title: ow.string,
  collapsed: ow.boolean,
  childIds: ow.array.ofType(String),
})
function checkNode(node) {
  ow(node, nodePredicate)
  return node
}

function checkNodeArray(nodeArray) {
  validate('A', arguments)
  ow(nodeArray, ow.array.ofType(nodePredicate))
  return nodeArray
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
  checkModel(model)
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

function getNodeById(id, model) {
  validate('SO', arguments)
  checkModel(model)
  return checkNode(model.byId[id])
}

function getNodeChildren(node, model) {
  checkNode(node)
  checkModel(model)

  const childNodes = node.childIds.map(cid => getNodeById(cid, model))
  return checkNodeArray(childNodes)
}

const NodeTree = observer(({ node, model }) => {
  return (
    <div className="ph2 code">
      <div className="">{getNodeTitle(node)}</div>
      <div className="pl2">
        {getNodeChildren(node, model).map(childNode => (
          <NodeTree key={childNode.id} node={childNode} model={model} />
        ))}
      </div>
    </div>
  )
})

NodeTree.displayName = 'NodeTree'

const RootTree = observer(({ model }) => {
  const node = getDisplayRootNode(model)
  return (
    <div className="pa2">
      <NodeTree node={node} model={model} />
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
