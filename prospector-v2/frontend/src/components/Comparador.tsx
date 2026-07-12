import React, { useState } from 'react';
import { Lead } from '../types';

interface Props { leads: Lead[] }

export default function Comparador({ leads }: Props) {
  const sites = leads.filter(l => l.slug && ['redesenhado','publicado','proposta','respondeu','fechado'].includes(l.status));
  const [sel, setSel] = useState(sites[0]?.slug||'');
  if (!sites.length) return <div className="card-section"><div className="empty-state">Sem sites redesenhados.</div></div>;
  const cur = sites.find(l=>l.slug===sel); if (!cur) return null;
  const antiga = cur.siteAntigo ? (cur.siteAntigo.startsWith('http')?cur.siteAntigo:`https://${cur.siteAntigo}`) : null;
  return (
    <div className="comparador-container">
      <div className="comparador-tabs">
        {sites.map(l => <button key={l.slug} className={l.slug===sel?'active':''} onClick={()=>setSel(l.slug)}>{l.nome}</button>)}
      </div>
      <div className="comparador-grid">
        <div className="comparador-col">
          <div className="comparador-header antes">Antiga{antiga&&<a href={antiga} target="_blank" rel="noopener" className="ml-auto">abrir ↗</a>}</div>
          {antiga?<iframe src={antiga} />:<div className="comparador-empty">Sem URL antiga</div>}
        </div>
        <div className="comparador-col">
          <div className="comparador-header depois">Nova<a href={`sites/${cur.slug}/${cur.slug}.html`} target="_blank" rel="noopener" className="ml-auto">abrir ↗</a></div>
          <iframe src={`sites/${cur.slug}/${cur.slug}.html`} />
        </div>
      </div>
      <p className="comparador-nota">Alguns sites bloqueiam iframes — use "abrir ↗" se ficar em branco.</p>
    </div>
  );
}
