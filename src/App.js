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
import cn from 'classnames'
import isHotKey from 'is-hotkey'
import { action, autorun } from 'mobx'
import {
  appendChildIdAndExpand,
  appendNodeIdAfterSiblingId,
  canCollapse,
  canExpand,
  checkNode,
  checkNodeArray,
  createNewNode,
  createRootNode,
  getNodeTitle,
  isRootNode,
  maybeNextChildId,
  maybePrevChildId,
  removeChildId,
  rootNodeId,
} from './model/node'
import { checkIndex } from './ow-helpers'

function createInitialModel() {
  const rootNode = createRootNode()
  return {
    byId: { [rootNodeId]: rootNode },
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

function getDisplayRootNode(model) {
  checkModel(model)
  return checkNode(model.byId[rootNodeId])
}

function getCurrentNode(model) {
  checkModel(model)
  return getNodeById(model.currentId, model)
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

function appendNewSiblingAfter(node, model) {
  checkNode(node)
  checkModel(model)
  const newNode = createNewNode()
  const parent = getParentOf(node, model)
  appendNodeIdAfterSiblingId(newNode.id, node.id, parent)
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

  return maybeNextChildId(node.id, getParentOf(node, model))
}

function maybePrevSibIdOf(node, model) {
  checkNode(node)
  checkModel(model)
  if (isRootNode(node)) return null
  return maybePrevChildId(node.id, getParentOf(node, model))
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

function getLastDescendentIdOrSelf(nodeId, model) {
  validate('SO', arguments)
  checkModel(model)

  const lastChildId = R.last(getNodeById(nodeId, model).childIds)

  return lastChildId
    ? getLastDescendentIdOrSelf(lastChildId, model)
    : nodeId
}

function attemptPrev(model) {
  checkModel(model)
  const currentNode = getCurrentNode(model)
  if (isRootNode(currentNode)) return
  const maybeId = maybePrevSibIdOf(currentNode, model)
  if (maybeId) {
    model.currentId = getLastDescendentIdOrSelf(maybeId, model)
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
    removeChildId(currentNode.id, oldParent)
    const newParent = getNodeById(maybePrevSibId, model)
    appendChildIdAndExpand(currentNode.id, newParent)
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

  removeChildId(currentNode.id, oldParent)

  const oldParentIndex = grandParent.childIds.findIndex(
    R.equals(oldParent.id),
  )
  checkIndex(oldParentIndex, grandParent.childIds)

  grandParent.childIds.splice(oldParentIndex + 1, 0, currentNode.id)

  checkModel(model)
}

function expand(model) {
  checkModel(model)
  const currentNode = getCurrentNode(model)
  if (canExpand(currentNode)) {
    currentNode.collapsed = false
  }

  checkModel(model)
}

function collapse(model) {
  checkModel(model)

  const currentNode = getCurrentNode(model)
  if (canCollapse(currentNode)) {
    currentNode.collapsed = true
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
      indent: action('indent', () => indent(model)),
      outdent: action('outdent', () => outdent(model)),
      expand: action('expand', () => expand(model)),
      collapse: action('collapse', () => collapse(model)),
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
        ['left', effects.collapse],
        ['right', effects.expand],
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

function getVisibleNodeChildren(node, model) {
  checkNode(node)
  checkModel(model)

  return canCollapse(node) ? getNodeChildren(node, model) : []
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
  const visibleChildren = getVisibleNodeChildren(node, model)
  return (
    <div className="ph2 code">
      <NodeTitleLine node={node} model={model} />
      {visibleChildren && (
        <div className="pl2">
          {visibleChildren.map(childNode => (
            <NodeTree key={childNode.id} node={childNode} model={model} />
          ))}
        </div>
      )}
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
