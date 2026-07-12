import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AtividadesPage() {
  const [atividades, setAtividades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => { try { const r: any = await api.getAtividades({limit:100}); if(r.success) setAtividades(r.data||[]); } catch(_e){} finally { setLoading(false); } };

  const filtered = filter ? atividades.filter(a => a.descricao.toLowerCase().includes(filter.toLowerCase())) : atividades;

  const tipoCor = (t:string) => ({ criado:'#7A8CA8', importado:'#7A8CA8', atualizado:'#C98A2D', redesenhado:'#9C7BB8', publicado:'#5E9DA8', proposta_gerada:'#C98A2D', contrato_gerado:'#6A9B72', contrato_assinado:'#4E8757', prospeccao_iniciada:'#7A8CA8', config_atualizada:'#B7B2A7', excluido:'#B0483B' }[t]||'#B7B2A7');

  if (loading) return <div className="empty-state">Carregando...</div>;

  return (<div className="card-section">
    <div className="section-header"><h2>Atividades</h2><input className="search-input" placeholder="Filtrar..." value={filter} onChange={e=>setFilter(e.target.value)} style={{width:250}} /></div>
    {!filtered.length?<p className="text-muted">Nenhuma atividade.</p>:<div className="atividades-list">
      {filtered.map((a:any) => (<div key={a.id} className="atividade-item">
        <div className="atividade-dot" style={{background:tipoCor(a.tipo)}} />
        <div className="atividade-content"><span className="atividade-desc">{a.descricao}</span><span className="atividade-meta">{a.tipo} · {a.slug?.startsWith('_')?'sistema':a.slug}</span></div>
        <span className="atividade-time">{a.criadoEm?.slice(0,16)?.replace('T',' ')}</span>
      </div>))}
    </div>}
    <button className="btn btn-secondary" onClick={load} style={{marginTop:16}}>↻ Atualizar</button>
  </div>);
}
