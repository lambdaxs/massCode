import type { Edge, Node } from '@vue-flow/core'
import type { GraphData, NodeData, NodeType, ValueType } from '../types'

let nodeIdCounter = 0

function generateNodeId(): string {
  return `node-${nodeIdCounter++}`
}

function getValueType(value: any): ValueType {
  if (value === null)
    return 'null'
  if (Array.isArray(value))
    return 'array'
  if (typeof value === 'object')
    return 'object'
  return typeof value as ValueType
}

function createNode(
  id: string,
  type: NodeType,
  data: NodeData,
  position: { x: number, y: number } = { x: 0, y: 0 },
): Node<NodeData> {
  return {
    id,
    type,
    data,
    position,
  }
}

function createEdge(sourceId: string, targetId: string): Edge {
  return {
    id: `edge-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    type: 'default',
    animated: false,
  }
}

function parseValue(
  value: any,
  key: string | null = null,
  parentId: string | null = null,
  nodes: Node<NodeData>[] = [],
  edges: Edge[] = [],
): string {
  const nodeId = generateNodeId()
  const valueType = getValueType(value)

  if (valueType === 'object') {
    // 为 object 创建节点
    const node = createNode(nodeId, 'object', {
      label: key || 'root',
      value,
      type: 'object',
      keysCount: Object.keys(value).length,
    })
    nodes.push(node)

    // 若有父节点则创建边
    if (parentId !== null) {
      edges.push(createEdge(parentId, nodeId))
    }

    // 递归处理子元素
    Object.entries(value).forEach(([childKey, childValue]) => {
      const childType = getValueType(childValue)
      // 仅为 object 与 array 创建节点
      if (childType === 'object' || childType === 'array') {
        parseValue(childValue, childKey, nodeId, nodes, edges)
      }
    })
  }
  else if (valueType === 'array') {
    // 为 array 创建节点
    const node = createNode(nodeId, 'array', {
      label: key || 'root',
      value,
      type: 'array',
      length: value.length,
    })
    nodes.push(node)

    // 若有父节点则创建边
    if (parentId !== null) {
      edges.push(createEdge(parentId, nodeId))
    }

    // 递归处理 array 元素
    value.forEach((item: any, index: number) => {
      const itemType = getValueType(item)
      // 仅为 object 与 array 创建节点
      if (itemType === 'object' || itemType === 'array') {
        parseValue(item, `[${index}]`, nodeId, nodes, edges)
      }
    })
  }
  // 原始值不单独建节点

  return nodeId
}

export function parseJsonToGraph(jsonData: any): GraphData {
  // 重置新节点计数器
  nodeIdCounter = 0

  const nodes: Node<NodeData>[] = []
  const edges: Edge[] = []

  // 判断根节点是 object 还是 array
  const valueType = getValueType(jsonData)

  if (valueType === 'object') {
    // 为 object 创建根节点
    const rootId = generateNodeId()
    const rootNode = createNode(rootId, 'object', {
      label: 'root',
      value: jsonData,
      type: 'object',
      keysCount: Object.keys(jsonData).length,
    })
    nodes.push(rootNode)

    // 解析子元素
    Object.entries(jsonData).forEach(([key, value]) => {
      const childType = getValueType(value)
      if (childType === 'object' || childType === 'array') {
        parseValue(value, key, rootId, nodes, edges)
      }
    })
  }
  else if (valueType === 'array') {
    // 为 array 创建根节点
    const rootId = generateNodeId()
    const rootNode = createNode(rootId, 'array', {
      label: 'root',
      value: jsonData,
      type: 'array',
      length: jsonData.length,
    })
    nodes.push(rootNode)

    // 解析 array 元素
    jsonData.forEach((item: any, index: number) => {
      const itemType = getValueType(item)
      if (itemType === 'object' || itemType === 'array') {
        parseValue(item, `[${index}]`, rootId, nodes, edges)
      }
    })
  }
  // 根为原始值时不建节点

  return { nodes, edges }
}
