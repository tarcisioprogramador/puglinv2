import React from 'react';
import { Lead } from '../types';
import { api } from '../services/api';

interface Props { leads: Lead[]; onRefresh: ()=>void }

export default function Financeiro({ leads, onRefresh }: Props) {
  const fech = leads.filter(l=>l.status==='fechado');
  const rec = fech.filter(l=>l.pago).reduce((a,l)=>a+(l.valor||0),0);
  const aRec = fech.filter(l=>!l.pago).reduce((a,l)=>a+(l.valor||0),0);
  const mrr = fech.reduce((a,l)=>a+(l.manutencao||0),0);
  const fmt = (n:number)=>`R$ ${n.toLocaleString('pt-BR')}`;

  return (<div className="view-container">
    <div className="stats-grid">
      {[{l:'Recebido',v:fmt(rec),c:'verde'},{l:'A receber',v:fmt(aRec),c:'ambar'},{l:'MRR',v:`${fmt(mrr)}/mês`,c:'laranja'},{l:'Projeção 12m',v:fmt(rec+aRec+mrr*12),c:'verde'}].map((c,i)=>(
        <div key={i} className={`stat-card ${c.c}`}><div className="stat-value">{c.v}</div><div className="stat-label">{c.l}</div></div>
      ))}
    </div>
    <div className="card-section">
      <h2>Fechamentos</h2>
      {!fech.length?<p className="text-muted">Nenhum fechamento ainda.</p>:<table className="leads-table"><thead><tr><th>Cliente</th><th>Valor</th><th>Pago</th><th>Manutenção</th><th>Contrato</th></tr></thead><tbody>
        {fech.map(l=>(<tr key={l.slug}><td><strong>{l.nome}</strong></td><td>{l.valor?fmt(l.valor):'—'}</td>
          <td><input type="checkbox" checked={!!l.pago} onChange={async()=>{await api.updateLead(l.slug,{pago:l.pago?0:1});onRefresh()}} /></td>
          <td>{l.manutencao?fmt(l.manutencao):'—'}</td>
          <td><span className={`status-pill status-${l.contratoStatus}`}>{l.contratoStatus||'pendente'}</span></td></tr>))}
      </tbody></table>}
    </div>
  </div>);
}
