import { useCallback } from 'react';
import dagre from 'dagre';
import { Position } from 'reactflow';
import type { Node, Edge } from 'reactflow';

const nodeWidth = 180;
const nodeHeight = 50;

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, edgesep: 30, ranksep: 100 });

  nodes.forEach((node) => {
    const w = node.width || nodeWidth;
    const h = node.height || nodeHeight;
    dagreGraph.setNode(node.id, { width: w, height: h });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const w = node.width || nodeWidth;
    const h = node.height || nodeHeight;
    
    // dagre returns the center point, react flow top-left.
    const targetPosition = isHorizontal ? Position.Left : Position.Top;
    const sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    return {
      ...node,
      targetPosition,
      sourcePosition,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function useAutoLayout() {
  const applyLayout = useCallback((nodes: Node[], edges: Edge[], direction = 'LR') => {
    return getLayoutedElements(nodes, edges, direction);
  }, []);

  return { applyLayout };
}
