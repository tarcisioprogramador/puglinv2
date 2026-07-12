import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';

export default function LoginPage() {
  const { login, register, checkUser } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState<'login' | 'register'>('login');
  const [temUsuario, setTemUsuario] = useState<boolean | null>(null);

  useEffect(() => {
    checkUser().then(exists => {
      setTemUsuario(exists);
      setModo(exists ? 'login' : 'register');
    });
  }, [checkUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      if (modo === 'login') {
        await login(email, senha);
      } else {
        await register(email, senha, nome);
        setModo('login');
        setErro('Conta criada! Faça login.');
      }
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F0EEE5 0%, #E8E4D8 100%)',
      fontFamily: "-apple-system, 'Segoe UI', Roboto, Inter, sans-serif",
    },
    card: {
      background: '#fff',
      borderRadius: 20,
      padding: '40px 36px',
      width: 400,
      maxWidth: '92vw',
      boxShadow: '0 20px 60px rgba(31,30,29,0.1)',
    },
    logo: {
      width: 48,
      height: 48,
      borderRadius: 14,
      background: '#D97757',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 26,
      color: '#fff',
      margin: '0 auto 16px',
    },
    title: {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 24,
      fontWeight: 600,
      textAlign: 'center',
      color: '#1F1E1D',
      margin: '0 0 6px',
    },
    sub: {
      textAlign: 'center',
      color: '#87837B',
      fontSize: 14,
      margin: '0 0 28px',
    },
    input: {
      width: '100%',
      border: '1px solid #E3DFD5',
      borderRadius: 10,
      padding: '11px 14px',
      fontSize: 14,
      fontFamily: 'inherit',
      color: '#1F1E1D',
      background: '#FAF9F5',
      outline: 'none',
      marginBottom: 14,
      boxSizing: 'border-box',
    },
    button: {
      width: '100%',
      background: '#D97757',
      color: '#fff',
      border: 0,
      borderRadius: 10,
      padding: '12px 0',
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'background 0.15s',
    },
    error: {
      color: '#B0483B',
      fontSize: 13,
      textAlign: 'center',
      marginTop: 12,
    },
    link: {
      textAlign: 'center',
      marginTop: 16,
      fontSize: 13,
      color: '#87837B',
    },
    linkBtn: {
      background: 'none',
      border: 0,
      color: '#C15F3C',
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 13,
    },
  };

  if (temUsuario === null) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>✳</div>
          <div style={{ textAlign: 'center', color: '#87837B', fontSize: 14 }}>Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>✳</div>
        <h1 style={styles.title}>Prospector v2</h1>
        <p style={styles.sub}>
          {modo === 'login' ? 'Faça login para acessar o painel' : 'Crie sua conta para começar'}
        </p>

        <form onSubmit={handleSubmit}>
          {modo === 'register' && (
            <input
              style={styles.input}
              placeholder="Seu nome"
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              autoFocus
            />
          )}
          <input
            style={styles.input}
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus={modo === 'login'}
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            required
            minLength={6}
          />

          <button
            style={{ ...styles.button, opacity: loading ? 0.6 : 1 }}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>

          {erro && <p style={styles.error}>{erro}</p>}

          <p style={styles.link}>
            {modo === 'login' ? (
              <>Não tem conta? <button type="button" style={styles.linkBtn} onClick={() => { setModo('register'); setErro(''); }}>Cadastre-se</button></>
            ) : (
              <>Já tem conta? <button type="button" style={styles.linkBtn} onClick={() => { setModo('login'); setErro(''); }}>Faça login</button></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
