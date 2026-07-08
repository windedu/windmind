import React, { useEffect, useState } from 'react';
import { supabase } from '../store/yjsStore';
import { Bell, Check, Trash2, ExternalLink } from 'lucide-react';

interface Notification {
  id: string;
  user_email: string;
  sender_email: string;
  mindmap_id: string;
  node_id: string | null;
  type: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsInboxProps {
  currentUserEmail: string;
  onClose: () => void;
}

export default function NotificationsInbox({ currentUserEmail }: NotificationsInboxProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUserEmail) return;
    
    fetchNotifications();

    // Subscribe to real-time notifications
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_email=eq.${currentUserEmail}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserEmail]);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_email', currentUserEmail)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setNotifications(data);
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).eq('user_email', currentUserEmail);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    // Navigate to the mindmap
    window.location.href = `/map/${notification.mindmap_id}?nodeId=${notification.node_id || ''}`;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      right: '20px',
      width: '380px',
      maxHeight: '500px',
      background: 'var(--bg-color)',
      border: '1px solid var(--node-border)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--node-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--node-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} />
          <h3 style={{ margin: 0, fontSize: '16px' }}>알림 {unreadCount > 0 && <span style={{ background: 'var(--accent)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', marginLeft: '4px' }}>{unreadCount}</span>}</h3>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} /> 모두 읽음
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--node-text)', fontSize: '14px' }}>로딩 중...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--node-text)', fontSize: '14px' }}>새로운 알림이 없습니다.</div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              style={{
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '8px',
                background: n.is_read ? 'transparent' : 'var(--node-bg)',
                border: `1px solid ${n.is_read ? 'transparent' : 'var(--node-border)'}`,
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                gap: '12px',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (n.is_read) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (n.is_read) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', marginBottom: '4px', color: 'var(--text-color)' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{n.sender_email.split('@')[0]}</span>님이 
                  {n.type === 'mention' ? ' 나를 언급했습니다.' : ' 내 코멘트에 답글을 달았습니다.'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--node-text)', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', fontStyle: 'italic', marginBottom: '8px' }}>
                  "{n.content}"
                </div>
                <div style={{ fontSize: '11px', color: 'var(--node-text)' }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                <ExternalLink size={14} color="var(--node-text)" />
                <button 
                  onClick={(e) => deleteNotification(n.id, e)} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--node-text)' }}
                  title="알림 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
