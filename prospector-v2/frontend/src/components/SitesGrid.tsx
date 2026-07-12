import React from 'react';
import { Lead, STATUS_NAMES, STATUS_CORES } from '../types';

interface Props { leads: Lead[]; onEdit: (l:Lead)=>void }

export default function SitesGrid({ leads, onEdit }: Props) {
  const sites = leads.filter(l => ['redesenhado','publicado','proposta','respondeu','fechado'].includes(l.status));
  if (!sites.length) return <div className="card-section"><div className="empty-state">Nenhum site redesenhado ainda.</div></div>;
  return (
    <div className="sites-grid">
      {sites.map(l => (
        <div key={l.slug} className="site-card">
          <div className="site-preview"><iframe src={`sites/${l.slug}/${l.slug}.html`} title={l.nome} loading="lazy" /></div>
          <div className="site-info">
            <div className="site-header">
              <span className="site-name">{l.nome}</span>
              <span className="status-pill" style={{background:`${STATUS_CORES[l.status]}22`,color:STATUS_CORES[l.status]}}>{STATUS_NAMES[l.status]}</span>
            </div>
            <div className="site-subtitle">{[l.nicho,l.cidade,l.nota?`★ ${l.nota}`:null].filter(Boolean).join(' · ')}</div>
            <div className="site-actions-main">
              {l.urlNova?<a href={l.urlNova} target="_blank" rel="noopener" className="btn btn-primary btn-sm">Ver no ar ↗</a>
                :<a href={`sites/${l.slug}/${l.slug}.html`} target="_blank" rel="noopener" className="btn btn-primary btn-sm">Ver página</a>}
              <a href={`sites/${l.slug}/${l.slug}-editor.html`} target="_blank" rel="noopener" className="btn btn-secondary btn-sm">Editar site</a>
            </div>
            <div className="site-icons">
              {l.siteAntigo&&<a href={l.siteAntigo} target="_blank" rel="noopener">antigo</a>}
              {l.whatsapp&&<a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener">whats</a>}
              {l.email&&<a href={`mailto:${l.email}`}>email</a>}
              <button onClick={()=>onEdit(l)} className="btn-icon">✎</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
