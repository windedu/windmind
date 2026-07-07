import { useState } from 'react';
import { supabase } from '../store/yjsStore';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else navigate('/');
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !password) return alert('이메일과 비밀번호를 입력하세요.');
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('회원가입 성공! (이메일 인증이 필요한 경우 이메일을 확인하세요)');
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) alert(error.message);
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-color)'
    }}>
      <div style={{
        background: 'var(--node-bg)', padding: '40px', borderRadius: '12px', border: '1px solid var(--node-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px'
      }}>
        <h2 style={{ margin: '0 0 24px 0', textAlign: 'center', fontSize: '24px' }}>MindSync 로그인</h2>
        
        <button 
          onClick={handleGoogleLogin}
          type="button"
          style={{
            width: '100%', padding: '12px', background: 'white', color: '#333', 
            border: '1px solid #ccc', borderRadius: '6px', marginBottom: '24px',
            cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" width={20} alt="Google" />
          Google로 계속하기
        </button>

        <div style={{ textAlign: 'center', opacity: 0.5, marginBottom: '24px', fontSize: '14px' }}>또는 이메일로 로그인</div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input 
            type="email" 
            placeholder="이메일" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--node-border)', background: 'var(--bg-color)', color: 'var(--node-text)', outline: 'none' }}
            required
          />
          <input 
            type="password" 
            placeholder="비밀번호" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--node-border)', background: 'var(--bg-color)', color: 'var(--node-text)', outline: 'none' }}
            required
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: '12px', borderRadius: '6px', background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {loading ? '처리 중...' : '로그인'}
          </button>
          <button 
            type="button" 
            onClick={handleSignUp}
            disabled={loading}
            style={{ padding: '12px', borderRadius: '6px', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', cursor: 'pointer', fontWeight: 'bold' }}
          >
            이메일로 회원가입
          </button>
        </form>
      </div>
    </div>
  );
}
