import React, { useEffect, useMemo } from 'react'
import { observer, useDisposable, useObservable } from 'mobx-react-lite'
import { getCached, setCache } from './cache-helpers'
import * as R from 'ramda'
import ow from 'ow'
import validate from 'aproba'
import faker from 'faker'
import cn from 'classnames'
import isHotKey from 'is-hotkey'
import nanoid from 'nanoid'
import { action, autorun } from 'mobx'

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

function getIdToPidLookup(model) {
  checkModel(model)
  return R.compose(
    R.reduce((acc, parentNode) => {
      parentNode.childIds.forEach(childId => {
        acc[childId] = parentNode.id
      })
      return acc
    }, {}),
    R.values,
  )(model.byId)
}

function getParentOf(node, model) {
  checkNode(node)
  checkModel(model)
  return getParentOfId(node.id, model)
}

function getParentOfId(nodeId, model) {
  validate('SM', arguments)
  checkModel(model)
  const idToPid = getIdToPidLookup(model)
  const pid = idToPid[nodeId]
  return getNodeById(pid, model)
}

function checkIndex(idx, array) {
  validate('NA', arguments)
  ow(array, ow.array.nonEmpty)
  ow(idx, ow.number.greaterThanOrEqual(0))
  ow(idx, ow.number.lessThan(array.length))
}

function appendNewSiblingAfter(node, model) {
  checkNode(node)
  checkModel(model)
  const newNode = createNewNode()
  const parent = getParentOf(node, model)
  const nodeIdx = parent.childIds.findIndex(R.equals(node.id))
  checkIndex(nodeIdx, parent.childIds)
  parent.childIds.splice(nodeIdx + 1, 0, newNode.id)
  model.byId[newNode.id] = newNode
  model.currentId = newNode.id
  checkModel(model)
}

function appendNewChild(node, model) {
  checkNode(node)
  checkModel(model)
  const newNode = createNewNode()
  node.childIds.push(newNode.id)
  model.byId[newNode.id] = newNode
  model.currentId = newNode.id
  checkModel(model)
}

function attemptNext(model) {
  checkModel(model)

  checkModel(model)
}

function maybePrevSibIdOf(node, model) {
  checkNode(node)
  checkModel(model)
  const parent = getParentOf(node, model)
  const nodeIdx = parent.childIds.findIndex(R.equals(node.id))
  checkIndex(nodeIdx, parent.childIds)
  if (nodeIdx > 0) {
    return parent.childIds[nodeIdx - 1]
  } else {
    return null
  }
}

function getLastDescendentOrSelf(nodeId, model) {
  validate('SO', arguments)
  checkModel(model)

  const lastChildId = R.last(getNodeById(nodeId).childIds)

  return lastChildId ? getLastDescendentOrSelf(nodeId, model) : nodeId
}

function attemptPrev(model) {
  checkModel(model)
  const currentNode = getCurrentNode(model)

  const maybeId = maybePrevSibIdOf(currentNode, model)
  if (maybeId) {
    getLastDescendentOrSelf(maybeId, model)
    model.currentId = maybeId
  }

  checkModel(model)
}

function useAppModel() {
  const model = useObservable(
    R.compose(
      R.mergeDeepRight(createInitialModel()),
      R.defaultTo({}),
      getCached,
    )('app-model'),
  )

  useDisposable(() =>
    autorun(
      () => {
        setCache('app-model', model)
      },
      { name: 'AR: setCache app-model' },
    ),
  )

  const effects = useMemo(() => {
    return {
      addNewLine: action('addNewLine', function addNewLine() {
        const current = getCurrentNode(model)
        if (isRootNode(current)) {
          appendNewChild(current, model)
        } else {
          appendNewSiblingAfter(current, model)
        }
      }),
      attemptPrev: action('attemptPrev', () => attemptPrev(model)),
      attemptNext: action('attemptNext', () => attemptNext(model)),
    }
  }, [])

  useEffect(() => {
    function listener(e) {
      validate('O', arguments)

      const km = [
        ['enter', effects.addNewLine],
        ['up', effects.attemptPrev],
        ['down', effects.attemptNext],
      ]

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

const NodeTitleLine = observer(({ node, model }) => {
  const isCurrent = getCurrentNode(model) === node
  return (
    <div className="flex pl2">
      <div className="ph2 flex items-center justify-center">+</div>
      <div className={cn('ph2 br2 pv1', { 'bg-blue white': isCurrent })}>
        {getNodeTitle(node)}
      </div>
    </div>
  )
})

NodeTitleLine.displayName = 'NodeTitleLine'

const NodeTree = observer(({ node, model }) => {
  return (
    <div className="ph2 code">
      <NodeTitleLine node={node} model={model} />
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
