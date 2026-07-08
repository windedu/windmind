import React, { useState } from 'react';
import type { Comment } from '../hooks/useYjsSync';
import { X, Send, Reply, CheckCircle, Circle, MessageSquare } from 'lucide-react';

interface CommentsSidebarProps {
  nodeId: string | null;
  nodeLabel: string;
  comments: Comment[];
  currentUserEmail: string;
  onClose: () => void;
  onAddComment: (comment: Comment) => void;
  onUpdateComment: (id: string, updates: Partial<Comment>) => void;
  onDeleteComment: (id: string) => void;
}

export default function CommentsSidebar({
  nodeId,
  nodeLabel,
  comments,
  currentUserEmail,
  onClose,
  onAddComment,
  onUpdateComment,
  onDeleteComment
}: CommentsSidebarProps) {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  if (!nodeId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onAddComment({
      id: Math.random().toString(36).substr(2, 9),
      nodeId,
      text: inputText.trim(),
      createdAt: Date.now(),
      authorEmail: currentUserEmail,
      parentId: replyingTo || undefined
    });
    setInputText('');
    setReplyingTo(null);
  };

  const topLevelComments = comments.filter(c => !c.parentId);
  const visibleTopLevelComments = topLevelComments.filter(c => showResolved || !c.resolved);
  visibleTopLevelComments.sort((a, b) => a.createdAt - b.createdAt);

  const getReplies = (parentId: string) => {
    return comments
      .filter(c => c.parentId === parentId)
      .sort((a, b) => a.createdAt - b.createdAt);
  };

  const getAuthorName = (email?: string) => email ? email.split('@')[0] : '익명';

  return (
    <div className="comments-sidebar">
      <div className="sidebar-header">
        <h3>{nodeLabel}</h3>
        <button className="close-button" onClick={onClose} title="닫기">
          <X size={20} />
        </button>
      </div>

      <div style={{ padding: '0 16px 12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--node-text)' }}>
          <input 
            type="checkbox" 
            checked={showResolved} 
            onChange={(e) => setShowResolved(e.target.checked)} 
            style={{ accentColor: 'var(--accent)' }}
          />
          해결된 항목 보기
        </label>
      </div>
      
      <div className="comments-list">
        {visibleTopLevelComments.length === 0 ? (
          <div className="empty-state">표시할 댓글이 없습니다.</div>
        ) : (
          visibleTopLevelComments.map(comment => {
            const replies = getReplies(comment.id);
            return (
              <div key={comment.id} className={`comment-thread ${comment.resolved ? 'resolved' : ''}`} style={{ marginBottom: '16px', borderBottom: '1px solid var(--node-border)', paddingBottom: '16px' }}>
                <div className="comment-item" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '8px' }}>
                  <div className="comment-text" style={{ color: comment.resolved ? 'var(--node-text)' : 'inherit' }}>{comment.text}</div>
                  <div className="comment-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: comment.resolved ? 'var(--node-text)' : 'var(--accent)' }}>
                        {getAuthorName(comment.authorEmail)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--node-text)' }}>
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setReplyingTo(comment.id)} style={{ background: 'none', border: 'none', color: 'var(--node-text)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Reply size={12} /> 답글
                      </button>
                      <button onClick={() => onUpdateComment(comment.id, { resolved: !comment.resolved })} style={{ background: 'none', border: 'none', color: comment.resolved ? 'var(--accent)' : 'var(--node-text)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {comment.resolved ? <CheckCircle size={12} /> : <Circle size={12} />} 
                        {comment.resolved ? '해결됨' : '해결'}
                      </button>
                      <button onClick={() => onDeleteComment(comment.id)} className="delete-btn">삭제</button>
                    </div>
                  </div>
                </div>

                {replies.length > 0 && (
                  <div className="comment-replies" style={{ marginLeft: '16px', borderLeft: '2px solid var(--node-border)', paddingLeft: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {replies.map(reply => (
                      <div key={reply.id} className="comment-item" style={{ borderBottom: 'none', padding: 0, margin: 0, background: 'transparent' }}>
                        <div className="comment-text" style={{ fontSize: '13px', color: comment.resolved ? 'var(--node-text)' : 'inherit' }}>{reply.text}</div>
                        <div className="comment-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: comment.resolved ? 'var(--node-text)' : 'var(--accent)', fontSize: '12px' }}>
                              {getAuthorName(reply.authorEmail)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--node-text)' }}>
                              {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button onClick={() => onDeleteComment(reply.id)} className="delete-btn" style={{ fontSize: '11px' }}>삭제</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--node-border)', padding: '16px', background: 'var(--bg-color)' }}>
        {replyingTo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '6px 10px', background: 'var(--node-bg)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-color)', border: '1px solid var(--node-border)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={12} />
              <span style={{ fontWeight: 'bold' }}>{getAuthorName(comments.find(c => c.id === replyingTo)?.authorEmail)}</span>님에게 답글 작성 중
            </span>
            <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--node-text)' }} title="취소">
              <X size={14} />
            </button>
          </div>
        )}
        <form className="comment-input-form" onSubmit={handleSubmit} style={{ border: 'none', padding: 0 }}>
          <input
            id="comment-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={replyingTo ? "답글을 입력하세요..." : "새로운 코멘트를 입력하세요..."}
            autoFocus
            style={{ borderRadius: '6px', border: '1px solid var(--node-border)', padding: '10px 12px' }}
          />
          <button type="submit" disabled={!inputText.trim()} title="전송" style={{ borderRadius: '6px' }}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
