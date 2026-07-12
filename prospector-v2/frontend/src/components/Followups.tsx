import React from 'react';
import { Lead } from '../types';

interface Props { leads: Lead[] }

function dias(s:string){return Math.floor((Date.now()-new Date(s+'T12:00:00').getTime())/86400000);}

export default function Followups({ leads }: Props) {
  const pending = leads.filter(l=>l.status==='proposta'&&l.dataProposta&&dias(l.dataProposta)>=4).sort((a,b)=>(b.dataProposta||'').localeCompare(a.dataProposta||''));
  const recent = leads.filter(l=>l.status==='proposta'&&l.dataProposta&&dias(l.dataProposta)<4);

  if (!pending.length&&!recent.length) return <div className="card-section"><div className="empty-state">Nenhuma proposta enviada.</div></div>;

  return (<div className="view-container">
    {!!pending.length&&<div className="card-section"><h2>Follow-ups pendentes (4+ dias)</h2>
      {pending.map(l=><div key={l.slug} className="followup-item">
        <span className="followup-info"><strong>{l.nome}</strong><span className="badge badge-warning">{dias(l.dataProposta!)}d</span><span className="text-muted">{l.dataProposta}</span></span>
        <span className="followup-actions">
          {l.whatsapp&&<a href={`https://wa.me/${l.whatsapp}?text=Oi%20${encodeURIComponent(l.nome)}!%20Tudo%20bem?%20Conseguiu%20dar%20uma%20olhada%20na%20proposta%20do%20site?`} target="_blank" rel="noopener" className="btn-sm btn-primary">WhatsApp →</a>}
          {l.email&&<a href={`mailto:${l.email}?subject=${encodeURIComponent(l.nome)},%20viu%20a%20proposta?`} className="btn-sm">Email</a>}
        </span>
      </div>)}
    </div>}
    {!!recent.length&&<div className="card-section"><h2>Propostas recentes</h2>
      {recent.map(l=><div key={l.slug} className="followup-item"><span className="followup-info"><strong>{l.nome}</strong><span className="badge badge-info">{dias(l.dataProposta!)}d</span><span className="text-muted">{l.dataProposta}</span></span></div>)}
    </div>}
    <div className="card-section"><h2>Regras</h2><ul className="rules-list"><li>Apenas <strong>1 follow-up</strong> por lead</li><li>Mínimo <strong>3 dias úteis</strong> após proposta</li><li>Mensagem curta (máx 4 linhas), educada</li><li>Sem resposta → marcar como frio</li></ul></div>
  </div>);
}
