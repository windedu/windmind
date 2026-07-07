import { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Plus, Minus, MessageSquare } from 'lucide-react';

export default function CustomNode({ data, id, isConnectable, selected }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);

  const commentsCount = data?.commentsCount || 0;
  const onOpenComments = data?.onOpenComments;

  useEffect(() => {
    const handleEditEvent = (e: CustomEvent) => {
      if (e.detail.id === id) setIsEditing(true);
    };
    window.addEventListener('start-editing-node', handleEditEvent as EventListener);
    return () => window.removeEventListener('start-editing-node', handleEditEvent as EventListener);
  }, [id]);

  const onBlur = () => {
    setIsEditing(false);
    if (data.onLabelChange && label !== data.label) {
      data.onLabelChange(id, label);
    }
  };

  return (
    <div className="custom-node">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="handle" />
      
      <div 
        className="node-content" 
        onDoubleClick={() => setIsEditing(true)}
      >
        {isEditing ? (
          <input
            autoFocus
            id={`node-input-${id}`}
            className="node-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => e.key === 'Enter' && onBlur()}
          />
        ) : (
          <div className="node-label" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', width: '100%', display: 'block' }}>
            {data.label}
          </div>
        )}
        
        {/* Comment Badge */}
        {(selected || commentsCount > 0) && (
          <button 
            className={`comment-badge ${commentsCount > 0 ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments && onOpenComments();
            }}
            title="댓글 달기"
          >
            <MessageSquare size={14} />
            {commentsCount > 0 && <span>{commentsCount}</span>}
          </button>
        )}
      </div>

      {data.childrenCount > 0 && (
        <button
          className="collapse-button"
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleCollapse(id);
          }}
        >
          {data.isCollapsed ? data.childrenCount : <Minus size={12} />}
        </button>
      )}

      {data.onAddChild && (
        <button 
          className="add-button" 
          onClick={(e) => {
            e.stopPropagation();
            data.onAddChild(id);
          }}
        >
          <Plus size={14} />
        </button>
      )}

      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="handle" />
    </div>
  );
}
