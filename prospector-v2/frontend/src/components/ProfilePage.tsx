import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(''); setErro('');

    if (novaSenha !== confirmar) { setErro('As senhas não conferem'); return; }
    if (novaSenha.length < 6) { setErro('Nova senha deve ter no mínimo 6 caracteres'); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem('prospector_token');
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao alterar senha');
      setMsg('Senha alterada! Fazendo logout para você refazer o login...');
      setSenhaAtual(''); setNovaSenha(''); setConfirmar('');
      setTimeout(() => logout(), 2000);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container">
      <div className="card-section">
        <h2>Informações da conta</h2>
        <div className="config-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nome</label>
              <input value={user?.nome || ''} disabled style={{ background: '#F0EEE5', cursor: 'not-allowed' }} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={user?.email || ''} disabled style={{ background: '#F0EEE5', cursor: 'not-allowed' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card-section">
        <h2>Alterar senha</h2>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Após alterar a senha, você será desconectado e precisará fazer login novamente.
        </p>

        <form onSubmit={handleChangePassword} className="config-form" style={{ maxWidth: 400 }}>
          <div className="form-group">
            <label>Senha atual</label>
            <input
              type="password"
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              required
              placeholder="Digite sua senha atual"
            />
          </div>
          <div className="form-group">
            <label>Nova senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="form-group">
            <label>Confirmar nova senha</label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              placeholder="Repita a nova senha"
            />
          </div>

          {erro && <div className="error-banner">{erro}</div>}
          {msg && <div className="result-box"><p style={{ fontSize: 13, fontWeight: 600 }}>{msg}</p></div>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          >
            {loading ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
