import ow from 'ow'
import validate from 'aproba'
import nanoid from 'nanoid'
import faker from 'faker'
import * as R from 'ramda'
import { checkIndex } from '../ow-helpers'

export const rootNodeId = 'id_root'

export function createRootNode() {
  const rootNode = {
    id: rootNodeId,
    childIds: [],
    title: 'Root',
    collapsed: false,
  }
  return checkNode(rootNode)
}

export function createNewNode() {
  const newNode = {
    id: `id_${nanoid()}`,
    childIds: [],
    title: faker.name.lastName(),
    collapsed: false,
  }
  return checkNode(newNode)
}

const nodePredicate = ow.object.exactShape({
  id: ow.string.nonEmpty,
  title: ow.string,
  collapsed: ow.boolean,
  childIds: ow.array.ofType(ow.string.nonEmpty),
})

export function checkNode(node) {
  ow(node, nodePredicate)
  return node
}

export function checkNodeArray(nodeArray) {
  validate('A', arguments)
  ow(nodeArray, ow.array.ofType(nodePredicate))
  return nodeArray
}

function checkString(string) {
  ow(string, ow.string)
  return string
}

export function getNodeTitle(node) {
  checkNode(node)
  return checkString(node.title)
}

export function isRootNode(node) {
  checkNode(node)
  return node.id === rootNodeId
}

function hasChildren(node) {
  checkNode(node)
  return node.childIds.length > 0
}

export function canExpand(node) {
  checkNode(node)
  return hasChildren(node) && node.collapsed
}

export function canCollapse(node) {
  checkNode(node)
  return hasChildren(node) && !node.collapsed
}

export function appendNodeIdAfterSiblingId(nodeId, siblingId, parent) {
  validate('SSO', arguments)
  checkNode(parent)
  const nodeIdx = parent.childIds.findIndex(R.equals(siblingId))
  checkIndex(nodeIdx, parent.childIds)
  parent.childIds.splice(nodeIdx + 1, 0, nodeId)
  checkNode(parent)
}

export function maybeNextChildId(nodeId, parent) {
  validate('SO', arguments)
  checkNode(parent)
  const nodeIdx = parent.childIds.findIndex(R.equals(nodeId))
  checkIndex(nodeIdx, parent.childIds)
  if (nodeIdx < parent.childIds.length - 1) {
    return parent.childIds[nodeIdx + 1]
  } else {
    return null
  }
}

export function maybePrevChildId(nodeId, parent) {
  validate('SO', arguments)
  checkNode(parent)

  const nodeIdx = parent.childIds.findIndex(R.equals(nodeId))
  checkIndex(nodeIdx, parent.childIds)
  if (nodeIdx > 0) {
    return parent.childIds[nodeIdx - 1]
  } else {
    return null
  }
}
