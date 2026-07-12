import React, { useState } from 'react';
import { Lead, STATUS_NAMES, STATUS_CORES, STATUS_ORDER } from '../types';

interface Props { leads: Lead[]; onStatus: (slug:string,status:string)=>void; onEdit: (l:Lead)=>void; onDelete: (s:string)=>void }

export default function Kanban({ leads, onStatus, onEdit, onDelete }: Props) {
  const [drag, setDrag] = useState<string|null>(null);

  const getByStatus = (st:string) => leads.filter(l => l.status === st);

  return (
    <div className="kanban-board">
      <p className="kanban-hint">Arraste cards para mudar o status. Use principalmente para <b>Respondeu</b> e <b>Fechado</b>.</p>
      <div className="kanban-columns">
        {STATUS_ORDER.map(st => {
          const items = getByStatus(st);
          return (
            <div key={st} className="kanban-column" style={{borderTopColor:STATUS_CORES[st]||'#B7B2A7'}}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{e.preventDefault();if(drag){onStatus(drag,st);setDrag(null)}}}>
              <div className="kanban-column-header"><h3>{STATUS_NAMES[st]||st}</h3><span className="column-count">{items.length}</span></div>
              <div className="kanban-cards">
                {items.map(l => (
                  <div key={l.slug} className="kanban-card" style={{borderTopColor:STATUS_CORES[l.status]||'#B7B2A7'}}
                    draggable onDragStart={()=>setDrag(l.slug)}>
                    <div className="card-name">{l.nome}</div>
                    <div className="card-meta">{l.nota?`★ ${l.nota} (${l.avaliacoes})`:''}{l.cidade?` · ${l.cidade}`:''}</div>
                    {l.motivo&&<div className="card-motivo">{l.motivo}</div>}
                    {l.valor&&<div className="card-valor">R$ {l.valor.toLocaleString('pt-BR')}{l.manutencao?` + R$ ${l.manutencao.toLocaleString('pt-BR')}/mês`:''}</div>}
                    <div className="card-actions">
                      {l.siteAntigo&&<a href={l.siteAntigo} target="_blank" rel="noopener" className="btn-sm">antigo</a>}
                      {l.status!=='novo'&&l.status!=='descartado'&&<><a href={`sites/${l.slug}/${l.slug}.html`} target="_blank" rel="noopener" className="btn-sm">página</a><a href={`sites/${l.slug}/${l.slug}-editor.html`} target="_blank" rel="noopener" className="btn-sm">editar</a></>}
                      {l.urlNova&&<a href={l.urlNova} target="_blank" rel="noopener" className="btn-sm">no ar ↗</a>}
                      {l.whatsapp&&<a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener" className="btn-sm">whats</a>}
                      <button className="btn-sm" onClick={()=>onEdit(l)}>✎</button>
                      <button className="btn-sm btn-danger" onClick={()=>onDelete(l.slug)}>✕</button>
                    </div>
                  </div>
                ))}
                {!items.length&&<div className="kanban-empty">solte aqui</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
