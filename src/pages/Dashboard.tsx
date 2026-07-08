import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Network, LogOut, FileText, Plus, Bell } from 'lucide-react';
import { supabase } from '../store/yjsStore';
import type { Session } from '@supabase/supabase-js';
import NotificationsInbox from '../components/NotificationsInbox';

export default function Dashboard({ session }: { session: Session }) {
  const [maps, setMaps] = useState<any[]>([]);
  const [sharedMaps, setSharedMaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  const [isInboxOpen, setInboxOpen] = useState(false);

  useEffect(() => {
    fetchMaps();
    fetchSharedMaps();
  }, []);

  const fetchMaps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('mindmaps')
      .select('id, title, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });
    
    if (data) setMaps(data);
    setLoading(false);
  };

  const fetchSharedMaps = async () => {
    const { data } = await supabase
      .from('mindmap_shares')
      .select('mindmaps (id, title, updated_at)')
      .eq('invited_email', session.user.email);
      
    if (data) {
      const formatted = data.map((d: any) => d.mindmaps).filter(Boolean);
      setSharedMaps(formatted);
    }
  };

  const handleCreateNewMap = async () => {
    const newRoomId = uuidv4();
    // Insert a new row for this user so it appears in their dashboard
    await supabase.from('mindmaps').insert({
      id: newRoomId,
      user_id: session.user.id,
      title: '제목 없는 마인드맵',
      document: '\\x0000' // dummy bytea
    });
    
    window.location.href = `/map/${newRoomId}`;
  };

  const handleLogout = () => {
    supabase.auth.signOut();
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Network size={32} color="var(--accent)" />
          <h1 style={{ margin: 0, fontSize: '24px' }}>MindSync 대시보드</h1>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setInboxOpen(!isInboxOpen)} 
              style={{ background: 'var(--node-bg)', border: '1px solid var(--node-border)', borderRadius: '8px', padding: '8px', color: 'var(--node-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="알림(Inbox)"
            >
              <Bell size={18} />
            </button>
            {isInboxOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 1000 }}>
                <NotificationsInbox
                  currentUserEmail={session.user.email!}
                  onClose={() => setInboxOpen(false)}
                />
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout} 
            style={{ background: 'none', border: 'none', color: 'var(--node-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}
          >
            <LogOut size={18} /> 로그아웃
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', borderBottom: '1px solid var(--node-border)' }}>
        <button 
          onClick={() => setActiveTab('my')}
          style={{ 
            background: 'none', border: 'none', padding: '12px 24px', fontSize: '16px', cursor: 'pointer',
            color: activeTab === 'my' ? 'var(--accent)' : 'var(--node-text)',
            borderBottom: activeTab === 'my' ? '3px solid var(--accent)' : '3px solid transparent',
            fontWeight: activeTab === 'my' ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          내 마인드맵
        </button>
        <button 
          onClick={() => setActiveTab('shared')}
          style={{ 
            background: 'none', border: 'none', padding: '12px 24px', fontSize: '16px', cursor: 'pointer',
            color: activeTab === 'shared' ? 'var(--accent)' : 'var(--node-text)',
            borderBottom: activeTab === 'shared' ? '3px solid var(--accent)' : '3px solid transparent',
            fontWeight: activeTab === 'shared' ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          공유받은 마인드맵
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
        {activeTab === 'my' && (
          <div 
            onClick={handleCreateNewMap}
            style={{
              border: '2px dashed var(--node-border)', borderRadius: '12px', height: '160px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', background: 'var(--hover-overlay)', color: 'var(--node-text)', gap: '12px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--node-border)'}
          >
            <Plus size={32} color="var(--accent)" />
            <span style={{ fontWeight: 500 }}>새 마인드맵 만들기</span>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: 'var(--node-text)', gridColumn: '1 / -1' }}>로딩 중...</div>
        ) : (
          (activeTab === 'my' ? maps : sharedMaps).map(m => (
            <div 
              key={m.id}
              onClick={() => window.location.href = `/map/${m.id}`}
              style={{
                border: '1px solid var(--node-border)', borderRadius: '12px', height: '160px',
                padding: '20px', cursor: 'pointer', background: 'var(--node-bg)', position: 'relative',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '12px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
                <FileText size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, flex: 1, color: 'var(--text-color)' }}>
                {m.title || '제목 없는 마인드맵'}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--node-text)', opacity: 0.7 }}>
                마지막 수정: {new Date(m.updated_at).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
