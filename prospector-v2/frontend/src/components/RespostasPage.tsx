import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function RespostasPage() {
  const [propostas, setPropostas] = useState<any[]>([]);
  const [responderam, setResponderam] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/respostas');
      const json = await res.json();
      if (json.success) {
        setPropostas(json.data.pendentes || []);
        setResponderam(json.data.responderam || []);
      }
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleCheck = async () => {
    setLoading(true); setMessage(''); setCheckResult(null);
    try {
      const res = await fetch('/api/respostas/check', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setCheckResult(json.data);
        setMessage(json.message);
        load();
      } else {
        setMessage('Erro: ' + (json.error || 'desconhecido'));
      }
    } catch (e: any) {
      setMessage('Erro de rede: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (slug: string) => {
    const msg = prompt('Mensagem do cliente:');
    if (msg === null) return;
    try {
      const res = await fetch('/api/respostas/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, mensagem: msg || 'respondeu' }),
      });
      const json = await res.json();
      if (json.success) { setMessage(`✓ ${json.message}`); load(); }
      else setMessage('Erro: ' + (json.error || ''));
    } catch (e: any) { setMessage('Erro: ' + e.message); }
  };

  const handleFollowup = async (slug: string) => {
    if (!confirm('Marcar este lead como frio (sem resposta)?')) return;
    try {
      const res = await fetch('/api/respostas/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const json = await res.json();
      if (json.success) { setMessage(`✓ ${json.message}`); load(); }
      else setMessage('Erro: ' + (json.error || ''));
    } catch (e: any) { setMessage('Erro: ' + e.message); }
  };

  return (
    <div className="view-container">
      <div className="card-section">
        <div className="section-header">
          <h2>Verificar respostas de propostas</h2>
          <button className="btn btn-primary" onClick={handleCheck} disabled={loading}>
            {loading ? 'Verificando...' : '🔍 Verificar agora'}
          </button>
        </div>
        <p className="text-muted" style={{marginBottom:12}}>
          Simula a verificação de respostas no Gmail. Em produção, consultaria a API do Gmail.
        </p>
        {message && <div className="result-box"><p style={{fontSize:13,fontWeight:600}}>{message}</p></div>}
        {checkResult && (
          <div style={{marginTop:12}}>
            <p><strong>{checkResult.novasRespostas}</strong> nova(s) resposta(s) em <strong>{checkResult.totalVerificado}</strong> proposta(s) verificada(s).</p>
            {checkResult.resultados?.filter((r:any)=>r.respondeu).map((r:any) => (
              <div key={r.slug} className="followup-item" style={{background:'#E7EFE8',borderRadius:8,padding:'10px 14px',marginTop:8}}>
                <span className="followup-info"><strong>{r.nome}</strong><span className="badge badge-success" style={{background:'#6A9B7222',color:'#6A9B72'}}>RESPONDEU</span><span className="text-muted">{r.mensagem}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-section"><h2>Propostas pendentes ({propostas.length})</h2>
        {!propostas.length ? <p className="text-muted">Nenhuma proposta pendente.</p> : propostas.map((l:any) => (
          <div key={l.slug} className="followup-item">
            <span className="followup-info"><strong>{l.nome}</strong><span className="badge badge-warning">{l.dataProposta||'sem data'}</span><span className="text-muted">{l.email||'sem email'}</span></span>
            <span className="followup-actions">
              <button className="btn-sm btn-primary" onClick={()=>handleConfirm(l.slug)}>✅ Respondeu</button>
              <button className="btn-sm btn-danger" onClick={()=>handleFollowup(l.slug)}>❌ Frio</button>
            </span>
          </div>
        ))}
      </div>

      <div className="card-section"><h2>Já responderam ({responderam.length})</h2>
        {!responderam.length ? <p className="text-muted">Nenhum lead respondeu ainda.</p> : responderam.map((l:any) => (
          <div key={l.slug} className="followup-item">
            <span className="followup-info"><strong>{l.nome}</strong><span className="badge badge-info">{l.dataProposta||'sem data'}</span><span className="text-muted" style={{fontSize:12}}>{l.obs||''}</span></span>
            <span className="followup-actions">
              {l.whatsapp&&<a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener" className="btn-sm">WhatsApp</a>}
              {l.email&&<a href={`mailto:${l.email}`} className="btn-sm">Email</a>}
            </span>
          </div>
        ))}
      </div>

      <div className="card-section"><h2>Regras de verificação</h2>
        <ul className="rules-list">
          <li>Leads com resposta detectada são automaticamente atualizados para "Respondeu"</li>
          <li>Você pode confirmar manualmente clicando em "✅ Respondeu"</li>
          <li>Leads sem resposta podem ser marcados como "frios"</li>
          <li>Em produção: integração com Gmail API para detecção real</li>
        </ul>
      </div>
    </div>
  );
}
