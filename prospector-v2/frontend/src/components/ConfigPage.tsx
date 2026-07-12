import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface Props { onSave: ()=>void }

export default function ConfigPage({ onSave }: Props) {
  const [cfg, setCfg] = useState<any>({ contratante:{}, hostgator:{}, preferencias:{} });
  const [loading, setLoading] = useState(true); const [msg, setMsg] = useState('');

  useEffect(() => { api.getConfig().then((r: any)=>r.success&&r.data&&setCfg(r.data)).finally(()=>setLoading(false)); }, []);

  const upC = (f:string,v:string) => setCfg({...cfg, contratante:{...cfg.contratante,[f]:v}});
  const upH = (f:string,v:string) => setCfg({...cfg, hostgator:{...cfg.hostgator,[f]:v}});
  const upP = (f:string,v:any) => setCfg({...cfg, preferencias:{...cfg.preferencias,[f]:v}});

  const save = async () => {
    setLoading(true); setMsg('');
    try { const r: any = await api.updateConfig({contratante:cfg.contratante, hostgator:cfg.hostgator, preferencias:cfg.preferencias}); if(r.success){ setMsg('Salvo! ✓'); onSave(); } } catch(e:any){ setMsg('Erro: '+e.message); } finally { setLoading(false); }
  };

  if (loading) return <div className="empty-state">Carregando...</div>;

  return (<div className="config-container">
    <div className="card-section"><h2>Meus dados</h2><p className="text-muted">Usados nos contratos como CONTRATADO(A).</p>
      <div className="config-form">
        <div className="form-row"><div className="form-group flex-2"><label>Nome</label><input value={cfg.contratante?.nome||''} onChange={e=>upC('nome',e.target.value)} /></div><div className="form-group"><label>CPF/CNPJ</label><input value={cfg.contratante?.cpfCnpj||''} onChange={e=>upC('cpfCnpj',e.target.value)} /></div></div>
        <div className="form-group"><label>Endereço</label><input value={cfg.contratante?.endereco||''} onChange={e=>upC('endereco',e.target.value)} /></div>
        <div className="form-row"><div className="form-group"><label>Cidade/UF</label><input value={cfg.contratante?.cidadeUf||''} onChange={e=>upC('cidadeUf',e.target.value)} /></div><div className="form-group"><label>WhatsApp</label><input value={cfg.contratante?.whatsapp||''} onChange={e=>upC('whatsapp',e.target.value)} /></div></div>
        <div className="form-row"><div className="form-group"><label>Email</label><input value={cfg.contratante?.email||''} onChange={e=>upC('email',e.target.value)} /></div><div className="form-group"><label>Apresentação</label><input value={cfg.contratante?.apresentacao||''} onChange={e=>upC('apresentacao',e.target.value)} /></div></div>
      </div>
    </div>
    <div className="card-section"><h2>HostGator</h2><p className="text-muted">Senha nunca passa pelo chat.</p>
      <div className="config-form">
        <div className="form-row"><div className="form-group"><label>Usuário</label><input value={cfg.hostgator?.usuario||''} onChange={e=>upH('usuario',e.target.value)} /></div><div className="form-group"><label>Domínio</label><input value={cfg.hostgator?.dominio||''} onChange={e=>upH('dominio',e.target.value)} /></div></div>
        <div className="form-row"><div className="form-group"><label>Servidor</label><input value={cfg.hostgator?.servidor||''} onChange={e=>upH('servidor',e.target.value)} /></div><div className="form-group"><label>Pasta base</label><input value={cfg.hostgator?.pastaBase||'clientes'} onChange={e=>upH('pastaBase',e.target.value)} /></div></div>
        <div className="form-group"><label>Senha</label><input type="password" value={cfg.hostgator?.senha||''} onChange={e=>upH('senha',e.target.value)} placeholder={cfg.hostgator?.senhaDefinida?'deixe em branco p/ manter':'cole a senha'} /></div>
      </div>
    </div>
    <div className="card-section"><h2>Preferências</h2>
      <div className="config-form">
        <div className="form-row"><div className="form-group"><label>Nicho padrão</label><input value={cfg.preferencias?.nichoPadrao||''} onChange={e=>upP('nichoPadrao',e.target.value)} /></div><div className="form-group"><label>Cidade padrão</label><input value={cfg.preferencias?.cidadePadrao||''} onChange={e=>upP('cidadePadrao',e.target.value)} /></div></div>
        <div className="form-row"><div className="form-group"><label>Volume de leads</label><input type="number" value={cfg.preferencias?.volumeLeads||10} onChange={e=>upP('volumeLeads',parseInt(e.target.value)||10)} /></div><div className="form-group"><label>Modo envio</label><select value={cfg.preferencias?.modoEnvio||'rascunho'} onChange={e=>upP('modoEnvio',e.target.value)}><option value="rascunho">Rascunho</option><option value="direto">Direto</option></select></div></div>
      </div>
    </div>
    <div className="config-actions"><button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'Salvando...':'Salvar'}</button>{msg&&<span className={`config-message ${msg.includes('✓')?'success':'error'}`}>{msg}</span>}</div>
  </div>);
}
