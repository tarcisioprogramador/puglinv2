import React, { useState } from 'react';
import { Lead } from '../types';
import { api } from '../services/api';

interface Props { leads: Lead[]; onRefresh: ()=>void }

export default function Contratos({ leads, onRefresh }: Props) {
  const [loading, setLoading] = useState<string|null>(null);
  const fech = leads.filter(l=>l.status==='fechado');

  if (!fech.length) return <div className="card-section"><div className="empty-state">Nenhum cliente fechado.</div></div>;

  const gen = async (s:string) => { setLoading(s); try { await api.generateContract(s); alert('Contrato gerado!'); onRefresh(); } catch(err:any){alert(err.message)} finally { setLoading(null); } };
  const sign = async (s:string) => { if (!confirm('Assinar contrato?')) return; await api.signContract(s); onRefresh(); };

  return (
    <div className="card-section">
      <table className="leads-table"><thead><tr><th>Cliente</th><th>Valor</th><th>Manutenção</th><th>Contrato</th><th>Data</th><th>Pago</th><th>Ações</th></tr></thead><tbody>
        {fech.map(l=>(<tr key={l.slug}>
          <td><strong>{l.nome}</strong></td>
          <td>{l.valor?`R$ ${l.valor.toLocaleString('pt-BR')}`:'—'}</td>
          <td>{l.manutencao?`R$ ${l.manutencao.toLocaleString('pt-BR')}/mês`:'—'}</td>
          <td><select className="mini-select" value={l.contratoStatus||'pendente'} onChange={async(e)=>{await api.updateLead(l.slug,{contratoStatus:e.target.value as any});onRefresh()}}>
            <option value="pendente">Pendente</option><option value="enviado">Enviado</option><option value="assinado">Assinado</option>
          </select></td>
          <td>{l.contratoEm||'—'}</td>
          <td><input type="checkbox" checked={!!l.pago} onChange={async()=>{await api.updateLead(l.slug,{pago:l.pago?0:1});onRefresh()}} /></td>
          <td><div className="table-actions">
            <button className="btn-sm btn-primary" onClick={()=>gen(l.slug)} disabled={loading===l.slug}>{loading===l.slug?'...':'Gerar'}</button>
            {l.contratoStatus!=='pendente'&&<a href={`sites/${l.slug}/contrato-${l.slug}.html`} target="_blank" rel="noopener" className="btn-sm">Ver</a>}
            {l.contratoStatus!=='assinado'&&l.contratoStatus!=='pendente'&&<button className="btn-sm" onClick={()=>sign(l.slug)}>Assinar</button>}
            {l.contratoStatus==='assinado'&&<span className="status-pill" style={{background:'#6A9B7222',color:'#6A9B72'}}>✓ Assinado</span>}
          </div></td>
        </tr>))}
      </tbody></table>
    </div>
  );
}
