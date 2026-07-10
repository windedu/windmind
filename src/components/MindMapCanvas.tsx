import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, useReactFlow } from 'reactflow';
import type { Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Download, Upload, Share2, Home, X, Folder, FolderDown, HelpCircle, FileText, MessageSquare, Bell } from 'lucide-react';
import * as Y from 'yjs';

import { useYjsSync } from '../hooks/useYjsSync';
import { useAutoLayout } from '../hooks/useAutoLayout';
import CustomNode from './CustomNode';
import CommentsSidebar from './CommentsSidebar';
import GlobalCommentsSidebar from './GlobalCommentsSidebar';
import NotificationsInbox from './NotificationsInbox';
import { supabase } from '../store/yjsStore';

const DropIndicatorNode = () => {
  return (
    <div style={{
      width: '180px',
      height: '4px',
      background: 'var(--accent)',
      borderRadius: '2px',
      boxShadow: '0 0 10px var(--accent)',
      transform: 'translateY(-50%)'
    }} />
  );
};

const nodeTypes = {
  custom: CustomNode,
  dropIndicator: DropIndicatorNode,
};

export default function MindMapCanvas() {
  const {
    nodes,
    edges,
    setNodes,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNodeAndEdge,
    addMultiple,
    updateNodeData,
    changeParent,
    comments,
    addComment,
    updateComment,
    deleteComment,
    undoManager
  } = useYjsSync();

  const { setCenter, getZoom } = useReactFlow();

  const { applyLayout } = useAutoLayout();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dropIndicator, setDropIndicator] = useState<{x: number, y: number} | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [selectedNodeIdForComments, setSelectedNodeIdForComments] = useState<string | null>(null);
  const [mapTitle, setMapTitle] = useState('마인드맵 로딩 중...');
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  // Phase 5 States
  const [mapsList, setMapsList] = useState<{ id: string, title: string, type: 'my'|'shared' }[]>([]);
  const [isMapListModalOpen, setMapListModalOpen] = useState(false);
  const [mapListMode, setMapListMode] = useState<'switch' | 'import'>('switch');
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);
  const [isGlobalCommentsOpen, setGlobalCommentsOpen] = useState(false);
  const [isInboxOpen, setInboxOpen] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [sharedUsers, setSharedUsers] = useState<string[]>([]);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setCurrentUserEmail(session.user.email);
      }
    });
  }, []);

  const fetchAvailableMaps = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    setCurrentUserEmail(session.user.email || '');

    const { data: myMaps } = await supabase
      .from('mindmaps')
      .select('id, title')
      .eq('user_id', session.user.id);
      
    const { data: sharedMaps } = await supabase
      .from('mindmap_shares')
      .select('mindmaps (id, title)')
      .eq('invited_email', session.user.email);
      
    const combined = [
      ...(myMaps || []).map(m => ({ ...m, type: 'my' as const })),
      ...(sharedMaps || []).map((s: any) => ({ ...s.mindmaps, type: 'shared' as const }))
    ].filter(Boolean);
    
    setMapsList(combined);
  };

  const openMapList = (mode: 'switch' | 'import') => {
    setMapListMode(mode);
    setMapListModalOpen(true);
    fetchAvailableMaps();
  };

  const handleMapAction = async (targetMapId: string) => {
    if (mapListMode === 'switch') {
      window.location.href = `/map/${targetMapId}`;
    } else {
      const { data } = await supabase
        .from('mindmaps')
        .select('document')
        .eq('id', targetMapId)
        .single();
        
      if (data && data.document) {
        const docStr = String(data.document);
        const hexString = docStr.startsWith('\\x') ? docStr.substring(2) : docStr;
        const match = hexString.match(/.{1,2}/g);
        if (match && match.length > 2) {
          const buffer = new Uint8Array(match.map(byte => parseInt(byte, 16)));
          const tempDoc = new Y.Doc();
          Y.applyUpdate(tempDoc, buffer);
          
          const tempNodesMap = tempDoc.getMap('nodes');
          const tempEdgesMap = tempDoc.getMap('edges');
          
          const nodesToImport = Array.from(tempNodesMap.values()) as Node[];
          const edgesToImport = Array.from(tempEdgesMap.values()) as Edge[];
          
          const idMap = new Map<string, string>();
          nodesToImport.forEach(n => idMap.set(n.id, uuidv4()));
          
          const newNodes = nodesToImport.map(n => ({
            ...n,
            id: idMap.get(n.id)!,
            selected: false
          }));
          
          const newEdges = edgesToImport.map(e => ({
            ...e,
            id: `e-${idMap.get(e.source)}-${idMap.get(e.target)}`,
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!
          })).filter(e => e.source && e.target);
          
          addMultiple(newNodes, newEdges);
          alert('마인드맵이 성공적으로 불러와졌습니다. 빈 공간에서 새 트리를 확인해 보세요!');
        }
      }
      setMapListModalOpen(false);
    }
  };

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'map') {
      const roomId = pathParts[2];
      
      // Fetch Map Title
      supabase.from('mindmaps').select('title').eq('id', roomId).single().then(({ data }) => {
        if (data) setMapTitle(data.title || '제목 없는 마인드맵');
      });

      // Fetch Shared Users
      supabase.from('mindmap_shares').select('invited_email').eq('mindmap_id', roomId).then(({ data }) => {
        if (data) setSharedUsers(data.map(d => d.invited_email));
      });
    }
  }, []);

  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setMapTitle(newTitle);
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'map') {
      await supabase.from('mindmaps').update({ title: newTitle }).eq('id', pathParts[2]);
    }
  };
  
  const nodeHeight = 50;

  const handleShare = () => {
    setInviteModalOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'map') {
      const roomId = pathParts[2];
      const { error } = await supabase.from('mindmap_shares').insert({
        mindmap_id: roomId,
        invited_email: inviteEmail
      });
      if (error) {
        alert('초대에 실패했습니다: ' + error.message);
      } else {
        alert('성공적으로 초대되었습니다!');
        setInviteEmail('');
        setInviteModalOpen(false);
        setSharedUsers(prev => [...prev, inviteEmail]);
      }
    }
  };

  const handleExportMarkdown = () => {
    const lines: string[] = [];
    
    const getChildren = (parentId: string) => {
      const childrenEdges = edges.filter(e => e.source === parentId);
      const childrenNodes = childrenEdges
        .map(e => nodes.find(n => n.id === e.target))
        .filter(n => n !== undefined) as Node[];
      
      childrenNodes.sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0));
      return childrenNodes;
    };

    const traverse = (node: Node, depth: number) => {
      lines.push(`${'  '.repeat(depth)}- ${node.data.label}`);
      const children = getChildren(node.id);
      children.forEach(child => traverse(child, depth + 1));
    };

    const incomingCount = new Map<string, number>();
    nodes.forEach(n => incomingCount.set(n.id, 0));
    edges.forEach(e => incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1));
    
    const roots = nodes.filter(n => incomingCount.get(n.id) === 0);
    roots.sort((a, b) => (a.data?.order || 0) - (b.data?.order || 0));
    
    roots.forEach(root => traverse(root, 0));

    const markdown = lines.join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindmap.md';
    a.click();
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const lines = text.split('\n');
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];
        const stack: { id: string, indent: number }[] = [];
        
        lines.forEach(line => {
          const match = line.match(/^([ \t]*)[-*+]\s+(.*)$/);
          if (!match) return;
          
          const indentStr = match[1];
          const label = match[2].trim();
          const indent = indentStr.replace(/\t/g, '  ').length;
          
          const nodeId = uuidv4();
          const node: Node = {
            id: nodeId,
            position: { x: 0, y: 0 },
            data: { label },
            type: 'custom',
          };
          newNodes.push(node);
          
          while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
          }
          
          if (stack.length > 0) {
            const parentId = stack[stack.length - 1].id;
            const edge: Edge = {
              id: `e-${parentId}-${nodeId}`,
              source: parentId,
              target: nodeId,
            };
            newEdges.push(edge);
          }
          
          stack.push({ id: nodeId, indent });
        });
        
        if (newNodes.length > 0) {
          addMultiple(newNodes, newEdges);
        } else {
          alert('마크다운 파일에서 올바른 리스트 형식을 찾을 수 없습니다.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getVisibleElements = useCallback((allNodes: Node[], allEdges: Edge[], collapsedIds: Set<string>) => {
    const visibleNodeIds = new Set<string>();
    
    // Find root nodes
    const incomingEdgeCount = new Map<string, number>();
    allNodes.forEach(n => incomingEdgeCount.set(n.id, 0));
    allEdges.forEach(e => incomingEdgeCount.set(e.target, (incomingEdgeCount.get(e.target) || 0) + 1));
    
    const queue = allNodes.filter(n => incomingEdgeCount.get(n.id) === 0);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      visibleNodeIds.add(current.id);
      
      if (!collapsedIds.has(current.id)) {
        const childrenEdges = allEdges.filter(e => e.source === current.id);
        const childrenNodes = childrenEdges
          .map(e => allNodes.find(n => n.id === e.target))
          .filter(n => n !== undefined) as Node[];
        queue.push(...childrenNodes);
      }
    }
    
    const visibleNodes = allNodes.filter(n => visibleNodeIds.has(n.id));
    const visibleEdges = allEdges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
    
    return { visibleNodes, visibleEdges };
  }, []);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    return getVisibleElements(nodes, edges, collapsedNodeIds);
  }, [nodes, edges, collapsedNodeIds, getVisibleElements]);

  // Apply layout calculating positions using dagre
  const layoutedData = useMemo(() => {
    if (visibleNodes.length === 0) return { nodes: [], edges: [] };
    
    // Sort edges based on target node's order to enforce dagre layout order
    const sortedEdges = [...visibleEdges].sort((a, b) => {
      const nodeA = visibleNodes.find(n => n.id === a.target);
      const nodeB = visibleNodes.find(n => n.id === b.target);
      const orderA = nodeA?.data?.order || 0;
      const orderB = nodeB?.data?.order || 0;
      return orderA - orderB;
    });

    // Also sort nodes just in case (roots order)
    const sortedNodes = [...visibleNodes].sort((a, b) => {
      return (a.data?.order || 0) - (b.data?.order || 0);
    });

    const dagreResult = applyLayout(sortedNodes, sortedEdges, 'LR');
    
    // Preserve dragged node position so it doesn't snap back while dragging
    const finalNodes = dagreResult.nodes.map(dNode => {
      const originalNode = visibleNodes.find(n => n.id === dNode.id);
      if (originalNode?.dragging) {
        return { ...dNode, position: originalNode.position };
      }
      return dNode;
    });

    return { nodes: finalNodes, edges: dagreResult.edges };
  }, [visibleNodes, visibleEdges, applyLayout]);

  const handleGlobalCommentClick = useCallback((nodeId: string) => {
    setGlobalCommentsOpen(false);
    setSelectedNodeIdForComments(nodeId);
    
    // Auto-pan to the node
    const node = layoutedData.nodes.find(n => n.id === nodeId);
    if (node) {
      setTimeout(() => {
        setCenter(node.position.x + 100, node.position.y + 25, { duration: 500, zoom: getZoom() });
      }, 10);
    }
  }, [layoutedData.nodes, setCenter, getZoom]);

  const onAddRootNode = useCallback(() => {
    const newNodeId = uuidv4();
    const newNode: Node = {
      id: newNodeId,
      position: { x: 0, y: 0 },
      data: { label: '새 핵심 아이디어' },
      type: 'custom',
    };
    
    addNodeAndEdge(newNode);

    setTimeout(() => {
      setNodes(nds => nds.map(n => ({
        ...n,
        selected: n.id === newNodeId
      })));
    }, 10);
  }, [addNodeAndEdge, setNodes]);

  const lastPaneClick = useRef(0);
  const handlePaneClick = useCallback(() => {
    const now = Date.now();
    if (now - lastPaneClick.current < 300) {
      onAddRootNode();
    }
    lastPaneClick.current = now;
  }, [onAddRootNode]);

  const onAddChild = useCallback((parentId: string) => {
    const newNodeId = uuidv4();
    const newNode: Node = {
      id: newNodeId,
      position: { x: 0, y: 0 },
      data: { label: 'New Idea' },
      type: 'custom',
    };
    
    const newEdge: Edge = {
      id: `e-${parentId}-${newNodeId}`,
      source: parentId,
      target: newNodeId,
    };
    
    addNodeAndEdge(newNode, newEdge);

    setTimeout(() => {
      setNodes(nds => nds.map(n => ({
        ...n,
        selected: n.id === newNodeId
      })));
    }, 10);
  }, [addNodeAndEdge, setNodes]);

  const onLabelChange = useCallback((id: string, label: string) => {
    updateNodeData(id, { label });
  }, [updateNodeData]);

  const onToggleCollapse = useCallback((id: string) => {
    setCollapsedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isDescendant = useCallback((targetId: string, possibleAncestorId: string) => {
    let currentId = targetId;
    while (currentId) {
      if (currentId === possibleAncestorId) return true;
      const incoming = edges.find(e => e.target === currentId);
      if (!incoming) break;
      currentId = incoming.source;
    }
    return false;
  }, [edges]);

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    const draggedId = node.id;
    const currentY = node.position.y;
    const centerX = node.position.x + 90;
    const centerY = node.position.y + 25;

    // Check if dropping onto another node
    const hoveredTarget = layoutedData.nodes.find(n => {
      if (n.id === draggedId) return false;
      const nx = n.position.x;
      const ny = n.position.y;
      return (
        centerX >= nx && centerX <= nx + 180 &&
        centerY >= ny && centerY <= ny + 50
      );
    });

    if (hoveredTarget && !isDescendant(hoveredTarget.id, draggedId)) {
      setDropTargetId(hoveredTarget.id);
      setDropIndicator(null);
      return;
    }

    setDropTargetId(null);
    
    const incoming = edges.find(e => e.target === draggedId);
    let siblings: Node[] = [];
    
    if (incoming) {
      const parentId = incoming.source;
      siblings = edges
        .filter(e => e.source === parentId)
        .map(e => nodes.find(n => n.id === e.target))
        .filter(n => n !== undefined) as Node[];
    } else {
      const roots = nodes.filter(n => !edges.some(e => e.target === n.id));
      siblings = roots;
    }

    const otherSiblings = siblings.filter(s => s.id !== draggedId);
    
    if (otherSiblings.length > 0) {
      const othersWithPos = otherSiblings.map(s => {
        const layouted = layoutedData.nodes.find(ln => ln.id === s.id);
        return { 
          id: s.id, 
          x: layouted ? layouted.position.x : s.position.x,
          y: layouted ? layouted.position.y : s.position.y 
        };
      });

      othersWithPos.sort((a, b) => a.y - b.y);

      let insertIndex = othersWithPos.findIndex(s => s.y > currentY);
      if (insertIndex === -1) insertIndex = othersWithPos.length;

      let indicatorY = 0;
      let indicatorX = othersWithPos[0].x;

      if (insertIndex === 0) {
        indicatorY = othersWithPos[0].y - 25;
      } else if (insertIndex === othersWithPos.length) {
        indicatorY = othersWithPos[othersWithPos.length - 1].y + nodeHeight + 25;
      } else {
        const prev = othersWithPos[insertIndex - 1];
        const next = othersWithPos[insertIndex];
        indicatorY = prev.y + nodeHeight + (next.y - (prev.y + nodeHeight)) / 2;
      }

      setDropIndicator({ x: indicatorX, y: indicatorY });
    }
  }, [edges, nodes, layoutedData, isDescendant]);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const draggedId = node.id;
    
    if (dropTargetId) {
      changeParent(draggedId, dropTargetId);
      
      // Clear target and put the node at the end of the new parent's children
      const existingChildren = edges.filter(e => e.source === dropTargetId);
      updateNodeData(draggedId, { order: existingChildren.length });
      
      setDropTargetId(null);
      return;
    }

    const droppedY = node.position.y;
    const incoming = edges.find(e => e.target === draggedId);
    let siblings: Node[] = [];
    
    if (incoming) {
      const parentId = incoming.source;
      siblings = edges
        .filter(e => e.source === parentId)
        .map(e => nodes.find(n => n.id === e.target))
        .filter(n => n !== undefined) as Node[];
    } else {
      // Root nodes
      const roots = nodes.filter(n => !edges.some(e => e.target === n.id));
      siblings = roots;
    }

    if (siblings.length > 1) {
      // Get their layouted positions for accurate sorting
      const siblingsWithY = siblings.map(s => {
        if (s.id === draggedId) {
          return { id: s.id, y: droppedY };
        } else {
          const layouted = layoutedData.nodes.find(ln => ln.id === s.id);
          return { id: s.id, y: layouted ? layouted.position.y : s.position.y };
        }
      });

      siblingsWithY.sort((a, b) => a.y - b.y);

      // Update order for all siblings
      siblingsWithY.forEach((s, index) => {
        updateNodeData(s.id, { order: index });
      });
    }

    setDropIndicator(null);
  }, [edges, nodes, layoutedData, updateNodeData, dropTargetId, changeParent]);

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    if (deletedNodes.length === 1) {
      const deletedId = deletedNodes[0].id;
      const incoming = edges.find(e => e.target === deletedId);
      if (incoming) {
        const parentId = incoming.source;
        setTimeout(() => {
          setNodes(nds => nds.map(n => ({
            ...n,
            selected: n.id === parentId
          })));
        }, 10);
      }
    }
  }, [edges, setNodes]);

  // Inject callbacks into node data
  const nodesWithCallbacks: Node[] = layoutedData.nodes.map(node => {
    const nodeComments = comments.filter(c => c.nodeId === node.id);
    return {
      ...node,
      data: {
        ...node.data,
        isCollapsed: collapsedNodeIds.has(node.id),
        onAddChild: () => onAddChild(node.id),
        onLabelChange,
        onToggleCollapse: () => onToggleCollapse(node.id),
        childrenCount: edges.filter(e => e.source === node.id).length,
        commentsCount: nodeComments.filter(c => !c.resolved && !c.parentId).length,
        onOpenComments: () => setSelectedNodeIdForComments(node.id)
      }
    };
  });

  // Handle Keyboard Shortcuts globally (Undo/Redo, Tab, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeIdForComments(null);
        setGlobalCommentsOpen(false);
        setInboxOpen(false);
        setHelpModalOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          undoManager.redo();
        } else {
          undoManager.undo();
        }
        return;
      }

      // Node creation shortcuts
      const selectedNodes = nodes.filter(n => n.selected);
      if (selectedNodes.length === 1) {
        const selectedNode = selectedNodes[0];

        if (e.key === 'Tab') {
          e.preventDefault();
          onAddChild(selectedNode.id);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const incomingEdge = edges.find(edge => edge.target === selectedNode.id);
          if (incomingEdge) {
            onAddChild(incomingEdge.source);
          } else {
            onAddChild(selectedNode.id); // Root node fallback
          }
        }

        // Edit Mode (Option+I or Alt+I)
        if (e.altKey && e.code === 'KeyI') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('start-editing-node', { detail: { id: selectedNode.id } }));
          return;
        }

        // Open Comment Sidebar (Option+C or Alt+C)
        if (e.altKey && e.code === 'KeyC') {
          e.preventDefault();
          setSelectedNodeIdForComments(selectedNode.id);
          setTimeout(() => {
            document.getElementById('comment-input')?.focus();
          }, 0);
          return;
        }

        // Toggle Collapse
        if (e.key === ' ' || e.key === '/') {
          e.preventDefault();
          onToggleCollapse(selectedNode.id);
          return;
        }

        // Arrow Key Navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const selectedId = selectedNode.id;
          let nextSelectedId: string | null = null;

          if (e.key === 'ArrowLeft') {
            const incoming = edges.find(edge => edge.target === selectedId);
            if (incoming) nextSelectedId = incoming.source;
          } else if (e.key === 'ArrowRight') {
            const outgoing = edges.filter(edge => edge.source === selectedId);
            if (outgoing.length > 0) {
              const children = outgoing
                .map(edge => layoutedData.nodes.find(n => n.id === edge.target))
                .filter(n => n !== undefined) as Node[];
              children.sort((a, b) => a.position.y - b.position.y);
              nextSelectedId = children[Math.floor(children.length / 2)].id;
            }
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const getDepth = (nodeId: string, depth = 0, visited = new Set<string>()): number => {
              if (visited.has(nodeId)) return depth;
              visited.add(nodeId);
              const incoming = edges.find(edge => edge.target === nodeId);
              if (incoming) return getDepth(incoming.source, depth + 1, visited);
              return depth;
            };

            const currentDepth = getDepth(selectedId);
            const sameLevelNodes = layoutedData.nodes.filter(n => getDepth(n.id) === currentDepth);
            sameLevelNodes.sort((a, b) => a.position.y - b.position.y);
            const currentIndex = sameLevelNodes.findIndex(n => n.id === selectedId);
            
            if (e.key === 'ArrowUp' && currentIndex > 0) {
              nextSelectedId = sameLevelNodes[currentIndex - 1].id;
            } else if (e.key === 'ArrowDown' && currentIndex < sameLevelNodes.length - 1) {
              nextSelectedId = sameLevelNodes[currentIndex + 1].id;
            }
          }

          if (nextSelectedId) {
            setNodes(nds => nds.map(n => ({
              ...n,
              selected: n.id === nextSelectedId
            })));
            
            const nextNode = layoutedData.nodes.find(n => n.id === nextSelectedId);
            if (nextNode) {
              setTimeout(() => {
                setCenter(nextNode.position.x + 100, nextNode.position.y + 25, { duration: 300, zoom: getZoom() });
              }, 10);
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoManager, nodes, edges, layoutedData, onAddChild, setNodes, onToggleCollapse]);

  const nodesToRender = nodesWithCallbacks.map(n => {
    if (n.id === dropTargetId) {
      return { ...n, className: 'drop-target-hover' };
    }
    return n;
  });

  if (dropIndicator) {
    nodesToRender.push({
      id: 'drop-indicator',
      position: { x: dropIndicator.x, y: dropIndicator.y },
      type: 'dropIndicator',
      data: {},
      draggable: false,
      selectable: false,
      style: { zIndex: 1000 }
    } as Node);
  }

  const actionButtonStyle = {
    background: 'var(--node-bg)',
    border: '1px solid var(--node-border)',
    color: 'var(--node-text)',
    borderRadius: '8px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <input 
        type="file" 
        accept=".md,.txt" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleImportMarkdown} 
      />
      <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 4,
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
        <button 
          onClick={() => window.location.href = '/'}
          title="대시보드로 돌아가기"
          style={{ ...actionButtonStyle, padding: '8px' } as React.CSSProperties}
        >
          <Home size={18} />
        </button>
        <button 
          onClick={() => openMapList('switch')}
          title="다른 맵으로 전환"
          style={{ ...actionButtonStyle, padding: '8px' } as React.CSSProperties}
        >
          <Folder size={18} />
        </button>
        <input 
          type="text" 
          value={mapTitle} 
          onChange={handleTitleChange}
          style={{
            background: 'var(--node-bg)',
            border: '1px solid var(--node-border)',
            color: 'var(--text-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '16px',
            fontWeight: 'bold',
            outline: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            width: '200px'
          }}
          placeholder="제목 없는 마인드맵"
        />
        <button 
          onClick={() => openMapList('import')}
          title="다른 마인드맵 맵 가져오기"
          style={actionButtonStyle as React.CSSProperties}
        >
          <FolderDown size={18} />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={actionButtonStyle as React.CSSProperties}
          title="마크다운 임포트"
        >
          <Upload size={18} />
        </button>
        <button 
          onClick={handleShare}
          title="공유 링크 복사"
          style={{ ...actionButtonStyle, background: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } as React.CSSProperties}
        >
          <Share2 size={18} />
        </button>
        <button 
          onClick={handleExportMarkdown}
          title="마크다운 내보내기"
          style={actionButtonStyle as React.CSSProperties}
        >
          <Download size={18} />
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 1000, display: 'flex', gap: '12px' }}>
        <button
          onClick={() => { setInboxOpen(!isInboxOpen); setGlobalCommentsOpen(false); setHelpModalOpen(false); }}
          style={{ ...actionButtonStyle, padding: '10px', position: 'relative' } as React.CSSProperties}
          title="알림(Inbox)"
        >
          <Bell size={20} />
          {/* We can show a dot here if unread, but let's keep it simple for now */}
        </button>
        <button
          onClick={() => { setGlobalCommentsOpen(!isGlobalCommentsOpen); setInboxOpen(false); setHelpModalOpen(false); }}
          style={{ ...actionButtonStyle, padding: '10px' } as React.CSSProperties}
          title="전체 코멘트"
        >
          <MessageSquare size={20} />
        </button>
        <button
          onClick={() => setHelpModalOpen(true)}
          style={{
            background: 'var(--node-bg)',
            border: '1px solid var(--node-border)',
            color: 'var(--node-text)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          title="단축키 안내"
        >
          <HelpCircle size={20} />
        </button>
        <button
          onClick={onAddRootNode}
          style={{
            background: 'var(--accent)',
            border: 'none',
            color: 'white',
            borderRadius: '8px',
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s ease',
            fontWeight: 600,
            fontSize: '14px'
          }}
        >
          <Plus size={18} />
          새 루트 노드 추가
        </button>
      </div>

      <ReactFlow
        nodes={nodesToRender}
        edges={layoutedData.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#94a3b8" gap={20} size={1} />
        <Controls 
          style={{ 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--node-border)'
          }} 
        />
      </ReactFlow>
      </div>

      {selectedNodeIdForComments && (
        <CommentsSidebar
          nodeId={selectedNodeIdForComments}
          nodeLabel={nodes.find(n => n.id === selectedNodeIdForComments)?.data?.label || ''}
          comments={comments.filter(c => c.nodeId === selectedNodeIdForComments)}
          allComments={comments}
          currentUserEmail={currentUserEmail}
          sharedUsers={sharedUsers}
          onClose={() => setSelectedNodeIdForComments(null)}
          onAddComment={addComment}
          onUpdateComment={updateComment}
          onDeleteComment={deleteComment}
        />
      )}

      {isGlobalCommentsOpen && (
        <GlobalCommentsSidebar
          comments={comments}
          nodes={nodes}
          currentUserEmail={currentUserEmail}
          onClose={() => setGlobalCommentsOpen(false)}
          onCommentClick={handleGlobalCommentClick}
        />
      )}

      {isInboxOpen && (
        <NotificationsInbox
          currentUserEmail={currentUserEmail}
          onClose={() => setInboxOpen(false)}
        />
      )}

      {isInviteModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--node-bg)', padding: '24px', borderRadius: '12px',
            width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid var(--node-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-color)' }}>계정 초대하기</h3>
              <button onClick={() => setInviteModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--node-text)' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--node-text)', marginBottom: '20px' }}>
              초대할 사용자의 이메일을 입력하세요. 초대받은 사용자는 자신의 대시보드에서 이 마인드맵을 확인할 수 있습니다.
            </p>
            <form onSubmit={handleInviteSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="email" 
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--node-border)', background: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none' }}
                required
              />
              <button type="submit" style={{ padding: '10px 20px', borderRadius: '6px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                초대
              </button>
            </form>
          </div>
        </div>
      )}

      {isMapListModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--node-bg)', padding: '24px', borderRadius: '12px',
            width: '400px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid var(--node-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-color)' }}>
                {mapListMode === 'switch' ? '다른 맵으로 전환하기' : '마인드맵 가져오기'}
              </h3>
              <button onClick={() => setMapListModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--node-text)' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {mapsList.length === 0 && <div style={{ color: 'var(--node-text)', textAlign: 'center', padding: '20px' }}>사용 가능한 맵이 없습니다.</div>}
              {mapsList.map(m => (
                <div
                  key={m.id}
                  onClick={() => handleMapAction(m.id)}
                  style={{
                    padding: '16px', borderRadius: '8px', border: '1px solid var(--node-border)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-color)'
                  }}
                >
                  <FileText size={20} color="var(--accent)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-color)' }}>{m.title || '제목 없음'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--node-text)', marginTop: '4px' }}>
                      {m.type === 'my' ? '내 마인드맵' : '공유받은 맵'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isHelpModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--node-bg)', padding: '24px', borderRadius: '12px',
            width: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', border: '1px solid var(--node-border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-color)' }}>단축키 안내</h3>
              <button onClick={() => setHelpModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--node-text)' }}>
                <X size={20} />
              </button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, color: 'var(--text-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li><kbd style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--node-border)' }}>Tab</kbd> 자식 노드 추가</li>
              <li><kbd style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--node-border)' }}>Enter</kbd> 형제 노드 추가</li>
              <li><kbd style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--node-border)' }}>Option(Alt) + I</kbd> 노드 텍스트 수정</li>
              <li><kbd style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--node-border)' }}>Space</kbd> 하위 노드 숨기기/보이기</li>
              <li><kbd style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--node-border)' }}>Option(Alt) + C</kbd> 선택 노드에 댓글 달기</li>
              <li><kbd style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--node-border)' }}>방향키</kbd> 주변 노드로 포커스 이동</li>
              <li><kbd style={{ background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--node-border)' }}>Esc</kbd> 창 닫기 및 포커스 해제</li>
            </ul>
          </div>
        </div>
      )}

    </div>
  );
}
