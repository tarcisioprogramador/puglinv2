import React from 'react';

const CORES: Record<string,string> = { novo:'#7A8CA8', redesenhado:'#9C7BB8', publicado:'#5E9DA8', proposta:'#C98A2D', respondeu:'#6A9B72', fechado:'#4E8757' };
const NOMES: Record<string,string> = { novo:'Novo', redesenhado:'Redesenhado', publicado:'Publicado', proposta:'Proposta', respondeu:'Respondeu', fechado:'Fechado' };
const ORDEM = ['novo','redesenhado','publicado','proposta','respondeu','fechado'];

interface Props { funnel: any[] }

export default function FunnelChart({ funnel }: Props) {
  if (!funnel?.length) return null;
  const max = Math.max(...funnel.map((f:any)=>f.quantidade),1);
  const sorted = ORDEM.map(s => funnel.find((f:any)=>f.status===s)).filter(Boolean);
  return (
    <div className="card-section">
      <h2>Funil do pipeline</h2>
      <div className="funnel">
        {sorted.map((f:any) => (
          <div key={f.status} className="funnel-row">
            <span className="funnel-label">{NOMES[f.status]||f.status}</span>
            <div className="funnel-bar-bg"><div className="funnel-bar-fill" style={{width:`${(f.quantidade/max)*100}%`,background:CORES[f.status]||'#B7B2A7'}}/></div>
            <span className="funnel-count">{f.quantidade}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
