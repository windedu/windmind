import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { applyNodeChanges, applyEdgeChanges, addEdge as rfAddEdge } from 'reactflow';
import type { Node, Edge, NodeChange, EdgeChange, Connection } from 'reactflow';
import { doc, yNodesMap, yEdgesMap, yCommentsMap, undoManager, supabase, roomId } from '../store/yjsStore';

export interface Comment {
  id: string;
  nodeId: string;
  text: string;
  createdAt: number;
  authorEmail?: string;
  parentId?: string;
  resolved?: boolean;
}

export function useYjsSync() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    const observeNodes = () => {
      setNodes((currentNodes) => {
        const yNodes = Array.from(yNodesMap.values()) as Node[];
        return yNodes.map(yNode => {
          const localNode = currentNodes.find(n => n.id === yNode.id);
          return {
            ...yNode,
            selected: localNode ? localNode.selected : false,
            width: localNode?.width,
            height: localNode?.height
          };
        });
      });
    };
    const observeEdges = () => setEdges(Array.from(yEdgesMap.values()) as Edge[]);
    const observeComments = () => setComments(Array.from(yCommentsMap.values()) as Comment[]);

    yNodesMap.observe(observeNodes);
    yEdgesMap.observe(observeEdges);
    yCommentsMap.observe(observeComments);

    // Initial load from Supabase
    const loadFromSupabase = async () => {
      if (roomId === 'mindsync-default-room') {
        observeNodes();
        observeEdges();
        observeComments();
        return; 
      }
      try {
        const { data } = await supabase
          .from('mindmaps')
          .select('document')
          .eq('id', roomId)
          .single();
          
        if (data && data.document) {
          const docStr = String(data.document);
          const hexString = docStr.startsWith('\\x') ? docStr.substring(2) : docStr;
          const match = hexString.match(/.{1,2}/g);
          if (match && match.length > 2) {
            const buffer = new Uint8Array(match.map(byte => parseInt(byte, 16)));
            Y.applyUpdate(doc, buffer);
          }
        }
      } catch (err) {
        console.log('No existing map found or error loading from Supabase', err);
      }
      
      // Update local state after applying
      const finalNodes = Array.from(yNodesMap.values()) as Node[];
      if (finalNodes.length === 0) {
        const rootNode: Node = {
          id: 'root',
          position: { x: 0, y: 0 },
          data: { label: 'Central Idea' },
          type: 'custom',
        };
        doc.transact(() => {
          yNodesMap.set(rootNode.id, rootNode);
        });
      }

      observeNodes();
      observeEdges();
      observeComments();
    };

    loadFromSupabase();

    // Supabase Realtime Broadcast & Auto-save
    const channel = supabase.channel(`mindmap-${roomId}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    
    let isSubscribed = false;
    let pendingUpdates: string[] = [];

    const applyHexUpdate = (hexStr: string) => {
      const match = hexStr.match(/.{1,2}/g);
      if (match) {
        const buffer = new Uint8Array(match.map((byte: string) => parseInt(byte, 16)));
        try {
          Y.applyUpdate(doc, buffer, 'supabase-broadcast');
        } catch(e) {
          console.error('Failed to apply update', e);
        }
      }
    };

    channel.on('broadcast', { event: 'yjs-update' }, ({ payload }) => {
      if (roomId === 'mindsync-default-room') return;
      applyHexUpdate(payload.update);
    });

    channel.on('broadcast', { event: 'yjs-sync-update' }, ({ payload }) => {
      if (roomId === 'mindsync-default-room') return;
      applyHexUpdate(payload.update);
    });

    channel.on('broadcast', { event: 'yjs-request-sync' }, ({ payload }) => {
      if (roomId === 'mindsync-default-room') return;
      try {
        const sv = new Uint8Array(payload.stateVector);
        const update = Y.encodeStateAsUpdate(doc, sv);
        const hex = Array.from(update).map(b => b.toString(16).padStart(2, '0')).join('');
        channel.send({
          type: 'broadcast',
          event: 'yjs-sync-update',
          payload: { update: hex }
        }).catch(err => console.error('Failed to send sync update', err));
      } catch(e) {
        console.error('Failed to process request-sync', e);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        // Request sync from other peers
        channel.send({
          type: 'broadcast',
          event: 'yjs-request-sync',
          payload: { stateVector: Array.from(Y.encodeStateVector(doc)) }
        }).catch(e => console.error(e));

        // Send pending updates
        pendingUpdates.forEach(hex => {
          channel.send({
            type: 'broadcast',
            event: 'yjs-update',
            payload: { update: hex }
          }).catch(err => console.error('Failed to broadcast queued update', err));
        });
        pendingUpdates = [];
      }
    });

    let timeoutId: any;
    let isSaving = false;
    const handleUpdate = (update: Uint8Array, origin: any) => {
      if (roomId === 'mindsync-default-room') return;

      if (origin !== 'supabase-broadcast') {
        const hex = Array.from(update).map(b => b.toString(16).padStart(2, '0')).join('');
        if (isSubscribed) {
          channel.send({
            type: 'broadcast',
            event: 'yjs-update',
            payload: { update: hex }
          }).catch(err => console.error('Failed to broadcast update', err));
        } else {
          pendingUpdates.push(hex);
        }
      }

      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        if (isSaving) return;
        isSaving = true;
        try {
          const stateVector = Y.encodeStateAsUpdate(doc);
          const hex = '\\x' + Array.from(stateVector as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('');
          
          await supabase
            .from('mindmaps')
            .update({ document: hex, updated_at: new Date().toISOString() })
            .eq('id', roomId);
        } catch (err) {
          console.error('Failed to save to Supabase', err);
        } finally {
          isSaving = false;
        }
      }, 2000); // 2 seconds debounce
    };

    doc.on('update', handleUpdate);

    return () => {
      yNodesMap.unobserve(observeNodes);
      yEdgesMap.unobserve(observeEdges);
      yCommentsMap.unobserve(observeComments);
      doc.off('update', handleUpdate);
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const nextNodes = applyNodeChanges(changes, nds);
      docTransact(() => {
        changes.forEach((change) => {
          if (change.type === 'remove') {
            yNodesMap.delete(change.id);
          } else if (change.type === 'position') {
            // Ignore position changes for Yjs sync because useAutoLayout (dagre) 
            // strictly controls all node positions. We only use drag for reordering.
          }
        });
      });
      return nextNodes;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const nextEdges = applyEdgeChanges(changes, eds);
      docTransact(() => {
        changes.forEach((change) => {
          if (change.type === 'remove') {
            yEdgesMap.delete(change.id);
          }
        });
      });
      return nextEdges;
    });
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const newEdges = rfAddEdge(connection, eds);
      newEdges.forEach(e => yEdgesMap.set(e.id, e));
      return newEdges;
    });
  }, []);

  const addNodeAndEdge = useCallback((node: Node, edge?: Edge) => {
    docTransact(() => {
      yNodesMap.set(node.id, node);
      if (edge) {
        yEdgesMap.set(edge.id, edge);
      }
    });
  }, []);

  const addMultiple = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    docTransact(() => {
      newNodes.forEach(node => yNodesMap.set(node.id, node));
      newEdges.forEach(edge => yEdgesMap.set(edge.id, edge));
    });
  }, []);

  const changeParent = useCallback((nodeId: string, newParentId: string) => {
    docTransact(() => {
      const edges = Array.from(yEdgesMap.values()) as Edge[];
      const edgeToDel = edges.find((e) => e.target === nodeId);
      if (edgeToDel) {
        yEdgesMap.delete(edgeToDel.id);
      }
      const newEdge: Edge = {
        id: `e-${newParentId}-${nodeId}-${Date.now()}`,
        source: newParentId,
        target: nodeId,
      };
      yEdgesMap.set(newEdge.id, newEdge);
    });
  }, []);

  const updateNodeData = useCallback((id: string, data: any) => {
    docTransact(() => {
      const node = yNodesMap.get(id);
      if (node) {
        yNodesMap.set(id, { ...node, data: { ...(node as any).data, ...data } });
      }
    });
  }, []);

  const addComment = useCallback((comment: Comment) => {
    docTransact(() => {
      yCommentsMap.set(comment.id, comment);
    });
  }, []);

  const updateComment = useCallback((id: string, updates: Partial<Comment>) => {
    docTransact(() => {
      const comment = yCommentsMap.get(id);
      if (comment) {
        yCommentsMap.set(id, { ...comment, ...updates });
      }
    });
  }, []);

  const deleteComment = useCallback((id: string) => {
    docTransact(() => {
      yCommentsMap.delete(id);
      // Also delete any replies to this comment
      const repliesToDelete: string[] = [];
      yCommentsMap.forEach((comment, key) => {
        if ((comment as Comment).parentId === id) repliesToDelete.push(key);
      });
      repliesToDelete.forEach(replyId => yCommentsMap.delete(replyId));
    });
  }, []);

  const replaceAll = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    docTransact(() => {
      Array.from(yNodesMap.keys()).forEach(key => yNodesMap.delete(key));
      Array.from(yEdgesMap.keys()).forEach(key => yEdgesMap.delete(key));
      newNodes.forEach(n => yNodesMap.set(n.id, n));
      newEdges.forEach(e => yEdgesMap.set(e.id, e));
    });
  }, []);

  const docTransact = (fn: () => void) => {
    doc.transact(fn);
  };

  return {
    nodes,
    edges,
    comments,
    setNodes, 
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNodeAndEdge,
    addMultiple,
    updateNodeData,
    replaceAll,
    changeParent,
    addComment,
    updateComment,
    deleteComment,
    undoManager
  };
}
