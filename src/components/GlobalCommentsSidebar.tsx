import { useState, useMemo } from 'react';
import type { Comment } from '../hooks/useYjsSync';
import { X, MessageSquare } from 'lucide-react';
import type { Node } from 'reactflow';

interface GlobalCommentsSidebarProps {
  comments: Comment[];
  nodes: Node[];
  currentUserEmail: string;
  onClose: () => void;
  onCommentClick: (nodeId: string) => void;
}

export default function GlobalCommentsSidebar({
  comments,
  nodes,
  currentUserEmail,
  onClose,
  onCommentClick
}: GlobalCommentsSidebarProps) {
  const [showMyComments, setShowMyComments] = useState(false);

  // Get all top-level threads
  const topLevelComments = useMemo(() => {
    return comments.filter(c => !c.parentId);
  }, [comments]);

  // Filter based on "My comments" toggle
  const visibleComments = useMemo(() => {
    let filtered = topLevelComments;
    if (showMyComments) {
      filtered = filtered.filter(c => c.authorEmail === currentUserEmail);
    }
    // Sort by created at, newest first
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [topLevelComments, showMyComments, currentUserEmail]);

  const getAuthorName = (email?: string) => email ? email.split('@')[0] : '익명';

  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    return node?.data?.label || '알 수 없는 노드';
  };

  return (
    <div className="comments-sidebar" style={{ zIndex: 60, width: '350px', right: 0 }}>
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} />
          <h3 style={{ margin: 0 }}>전체 코멘트</h3>
        </div>
        <button className="close-button" onClick={onClose} title="닫기">
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--node-border)' }}>
        <label style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-color)' }}>
          <input 
            type="checkbox" 
            checked={showMyComments} 
            onChange={(e) => setShowMyComments(e.target.checked)} 
            style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
          />
          내가 작성한 코멘트만 보기
        </label>
      </div>
      
      <div className="comments-list" style={{ flex: 1, overflowY: 'auto' }}>
        {visibleComments.length === 0 ? (
          <div className="empty-state">해당하는 코멘트가 없습니다.</div>
        ) : (
          visibleComments.map(comment => {
            const repliesCount = comments.filter(c => c.parentId === comment.id).length;
            
            return (
              <div 
                key={comment.id} 
                onClick={() => onCommentClick(comment.nodeId)}
                style={{ 
                  padding: '16px', 
                  borderBottom: '1px solid var(--node-border)',
                  cursor: 'pointer',
                  background: 'var(--bg-color)',
                  transition: 'background 0.2s',
                  opacity: comment.resolved ? 0.6 : 1
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--node-bg)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
              >
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--node-text)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getNodeLabel(comment.nodeId)}
                </div>
                
                <div style={{ fontSize: '14px', color: 'var(--text-color)', marginBottom: '10px' }}>
                  {comment.text}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                    {getAuthorName(comment.authorEmail)}
                  </span>
                  <div style={{ display: 'flex', gap: '12px', color: 'var(--node-text)' }}>
                    {repliesCount > 0 && <span>답글 {repliesCount}</span>}
                    {comment.resolved && <span style={{ color: 'var(--accent)' }}>해결됨</span>}
                    <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
