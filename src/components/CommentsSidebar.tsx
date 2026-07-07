import React, { useState } from 'react';
import type { Comment } from '../hooks/useYjsSync';
import { X, Send } from 'lucide-react';

interface CommentsSidebarProps {
  nodeId: string | null;
  nodeLabel: string;
  comments: Comment[];
  onClose: () => void;
  onAddComment: (comment: Comment) => void;
  onDeleteComment: (id: string) => void;
}

export default function CommentsSidebar({
  nodeId,
  nodeLabel,
  comments,
  onClose,
  onAddComment,
  onDeleteComment
}: CommentsSidebarProps) {
  const [inputText, setInputText] = useState('');

  if (!nodeId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onAddComment({
      id: Math.random().toString(36).substr(2, 9),
      nodeId,
      text: inputText.trim(),
      createdAt: Date.now()
    });
    setInputText('');
  };

  return (
    <div className="comments-sidebar">
      <div className="sidebar-header">
        <h3>{nodeLabel}</h3>
        <button className="close-button" onClick={onClose} title="닫기">
          <X size={20} />
        </button>
      </div>
      
      <div className="comments-list">
        {comments.length === 0 ? (
          <div className="empty-state">아직 작성된 댓글이 없습니다.</div>
        ) : (
          comments.sort((a, b) => a.createdAt - b.createdAt).map(comment => (
            <div key={comment.id} className="comment-item">
              <div className="comment-text">{comment.text}</div>
              <div className="comment-meta">
                {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                <button onClick={() => onDeleteComment(comment.id)} className="delete-btn">삭제</button>
              </div>
            </div>
          ))
        )}
      </div>

      <form className="comment-input-form" onSubmit={handleSubmit}>
        <input
          id="comment-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="댓글을 입력하세요..."
          autoFocus
        />
        <button type="submit" disabled={!inputText.trim()} title="전송">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
