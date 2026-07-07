import type { Node, Edge } from 'reactflow';

export type MindMapNodeData = {
  label: string;
};

export type MindMapNode = Node<MindMapNodeData>;
export type MindMapEdge = Edge;
