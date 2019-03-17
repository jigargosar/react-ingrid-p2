import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  observer,
  useComputed,
  useDisposable,
  useObservable,
} from 'mobx-react-lite'
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

function maybeParentIdOf(node, model) {
  checkNode(node)
  checkModel(model)
  return getIdToPidLookup(model)[node.id]
}

function getParentOf(node, model) {
  checkNode(node)
  checkModel(model)
  return getParentOfId(node.id, model)
}

function getParentOfId(nodeId, model) {
  validate('SO', arguments)
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

function maybeFirstChildIdOf(node, model) {
  checkNode(node)
  checkModel(model)
  return R.ifElse(R.isEmpty, R.always(null), R.head)(node.childIds)
}

function maybeNextSibIdOf(node, model) {
  checkNode(node)
  checkModel(model)
  if (isRootNode(node)) return

  const parent = getParentOf(node, model)
  const nodeIdx = parent.childIds.findIndex(R.equals(node.id))
  checkIndex(nodeIdx, parent.childIds)
  if (nodeIdx < parent.childIds.length - 1) {
    return parent.childIds[nodeIdx + 1]
  } else {
    return null
  }
}

function maybeNextSibOfFirstAncestor(node, model) {
  checkNode(node)
  checkModel(model)
  const maybeParentId = maybeParentIdOf(node, model)
  if (maybeParentId) {
    const parent = getNodeById(maybeParentId, model)
    const maybeId = maybeNextSibIdOf(parent, model)
    if (maybeId) {
      return maybeId
    } else {
      return maybeNextSibOfFirstAncestor(parent, model)
    }
  } else {
    return null
  }
}

function attemptNext(model) {
  checkModel(model)

  const currentNode = getCurrentNode(model)

  const maybeId =
    maybeFirstChildIdOf(currentNode, model) ||
    maybeNextSibIdOf(currentNode, model) ||
    maybeNextSibOfFirstAncestor(currentNode, model)

  if (maybeId) {
    model.currentId = maybeId
  }

  checkModel(model)
}

function maybePrevSibIdOf(node, model) {
  checkNode(node)
  checkModel(model)
  if (isRootNode(node)) return null
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

  const lastChildId = R.last(getNodeById(nodeId, model).childIds)

  return lastChildId ? getLastDescendentOrSelf(lastChildId, model) : nodeId
}

function attemptPrev(model) {
  checkModel(model)
  const currentNode = getCurrentNode(model)
  if (isRootNode(currentNode)) return
  const maybeId = maybePrevSibIdOf(currentNode, model)
  if (maybeId) {
    model.currentId = getLastDescendentOrSelf(maybeId, model)
  } else {
    const maybeId = maybeParentIdOf(currentNode, model)
    if (maybeId) {
      model.currentId = maybeId
    }
  }

  checkModel(model)
}

function indent(model) {
  checkModel(model)
  const currentNode = getCurrentNode(model)
  if (isRootNode(currentNode)) return
  const maybePrevSibId = maybePrevSibIdOf(currentNode, model)
  if (maybePrevSibId) {
    const oldParent = getParentOf(currentNode, model)
    oldParent.childIds = R.without([currentNode.id])(oldParent.childIds)
    const newParent = getNodeById(maybePrevSibId, model)
    newParent.childIds.push(currentNode.id)
    newParent.collapsed = false
  }

  checkModel(model)
}

function outdent(model) {
  checkModel(model)
  const currentNode = getCurrentNode(model)
  if (
    isRootNode(currentNode, model) ||
    isRootNode(getParentOf(currentNode, model))
  )
    return

  const oldParent = getParentOf(currentNode, model)
  const grandParent = getParentOf(oldParent, model)

  oldParent.childIds = R.without([currentNode.id])(oldParent.childIds)

  const oldParentIndex = grandParent.childIds.findIndex(
    R.equals(oldParent.id),
  )
  checkIndex(oldParentIndex, grandParent.childIds)

  grandParent.childIds.splice(oldParentIndex + 1, 0, currentNode.id)

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
      indent: action('indent', () => indent(model)),
      outdent: action('outdent', () => outdent(model)),
    }
  }, [])

  useEffect(() => {
    function listener(e) {
      validate('O', arguments)

      const km = [
        ['enter', effects.addNewLine],
        ['up', effects.attemptPrev],
        ['down', effects.attemptNext],
        ['tab', effects.indent],
        ['shift+tab', effects.outdent],
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
  const isCurrent = useComputed(() => getCurrentNode(model) === node)
  const ref = useRef()
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el) {
      el.focus()
    }
  }, [isCurrent])
  return (
    <div className="flex pl2">
      <div className="ph2 flex items-center justify-center">+</div>
      <div
        ref={ref}
        className={cn('ph2 br2 pv1', { 'bg-blue white': isCurrent })}
        tabIndex={isCurrent ? 0 : null}
      >
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
