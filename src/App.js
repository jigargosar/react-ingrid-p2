import React, { useEffect } from 'react'
import { observer, useObservable } from 'mobx-react-lite'
import { getCached, setCache } from './cache-helpers'
import * as R from 'ramda'
import ow from 'ow'
import validate from 'aproba'
import faker from 'faker'

import isHotKey from 'is-hotkey'
import nanoid from 'nanoid'

const rootNodeId = 'id_root'

function createRootNode() {
  const rootNode = {
    id: rootNodeId,
    childIds: [],
    title: 'Root',
    collapsed: false,
  }
  return checkNode(rootNode)
}

function createNewNode() {
  const newNode = {
    id: `id_${nanoid()}`,
    childIds: [],
    title: faker.name.lastName(),
    collapsed: false,
  }
  return checkNode(newNode)
}

function createInitialModel() {
  return {
    byId: { [rootNodeId]: createRootNode() },
    currentId: rootNodeId,
  }
}

function checkModel(model) {
  ow(
    model,
    ow.object.exactShape({
      byId: ow.object.nonEmpty,
      currentId: ow.string.nonEmpty,
    }),
  )
  return model
}

const nodePredicate = ow.object.exactShape({
  id: ow.string.nonEmpty,
  title: ow.string,
  collapsed: ow.boolean,
  childIds: ow.array.ofType(ow.string.nonEmpty),
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
  return checkNode(model.byId[rootNodeId])
}

function getCurrentNode(model) {
  checkModel(model)
  return getNodeById(model.currentId, model)
}

function isRootNode(node) {
  checkNode(node)
  return node.id === rootNodeId
}

function appendSiblingId(nodeId, siblingId, model) {
  throw new Error('Not Implemented')
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

  function addNewLine() {
    const current = getCurrentNode(model)
    const newNode = createNewNode()
    debugger

    if (isRootNode(current)) {
      current.childIds.push(newNode.id)
    } else {
      appendSiblingId(newNode.id, current, model)
    }
    model.byId[newNode] = newNode
  }

  useEffect(() => {
    function listener(e) {
      validate('O', arguments)

      const km = [['enter', addNewLine]]

      const kmTuple = km.find(([key]) => isHotKey(key, e))

      if (kmTuple) {
        e.preventDefault()
        kmTuple[1]()
      }
    }
    window.addEventListener('keydown', listener)
    return () => {
      window.removeEventListener('keydown', listener)
    }
  }, [])

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
