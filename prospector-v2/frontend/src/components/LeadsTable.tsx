import React, { useState } from 'react';
import { Lead, STATUS_NAMES, STATUS_CORES } from '../types';

interface Props { leads: Lead[]; onEdit: (l:Lead)=>void; onDelete: (s:string)=>void }

export default function LeadsTable({ leads, onEdit, onDelete }: Props) {
  const [sortCol, setSortCol] = useState('nome'); const [sortAsc, setSortAsc] = useState(true); const [page, setPage] = useState(1);
  const pp = 20; const sorted = [...leads].sort((a,b)=> { const va=(a as any)[sortCol]||'', vb=(b as any)[sortCol]||''; const cmp=typeof va==='number'?va-vb:String(va).localeCompare(String(vb)); return sortAsc?cmp:-cmp; });
  const tp = Math.max(1,Math.ceil(sorted.length/pp)); const pg = sorted.slice((page-1)*pp, page*pp);
  const h = (c:string) => { if (sortCol===c) setSortAsc(!sortAsc); else { setSortCol(c); setSortAsc(true); } setPage(1); };
  return (
    <div className="table-container">
      <table className="leads-table">
        <thead><tr>
          {[{k:'nome',l:'Cliente'},{k:'nota',l:'Nota'},{k:'avaliacoes',l:'Aval.'},{k:'cidade',l:'Cidade'},{k:'status',l:'Status'},{k:'valor',l:'Valor'}].map(c=><th key={c.k} onClick={()=>h(c.k)}>{c.l}{sortCol===c.k?(sortAsc?' ↑':' ↓'):''}</th>)}
          <th>Ações</th>
        </tr></thead>
        <tbody>
          {pg.map(l => (
            <tr key={l.slug}>
              <td><strong>{l.nome}</strong><div className="text-muted small">{l.email||'sem e-mail'}</div></td>
              <td>{l.nota?`★ ${l.nota}`:'—'}</td>
              <td>{l.avaliacoes||'—'}</td>
              <td>{l.cidade||'—'}</td>
              <td><span className="status-pill" style={{background:`${STATUS_CORES[l.status]||'#B7B2A7'}22`,color:STATUS_CORES[l.status]||'#B7B2A7'}}>{STATUS_NAMES[l.status]||l.status}</span></td>
              <td>{l.valor?`R$ ${l.valor.toLocaleString('pt-BR')}`:'—'}</td>
              <td><div className="table-actions">
                {l.siteAntigo&&<a href={l.siteAntigo} target="_blank" rel="noopener" className="btn-sm">antigo</a>}
                {l.whatsapp&&<a href={`https://wa.me/${l.whatsapp}`} target="_blank" rel="noopener" className="btn-sm">whats</a>}
                <button className="btn-sm" onClick={()=>onEdit(l)}>✎</button>
                <button className="btn-sm btn-danger" onClick={()=>onDelete(l.slug)}>✕</button>
              </div></td>
            </tr>
          ))}
          {!pg.length&&<tr><td colSpan={7} className="empty-state">Nenhum lead encontrado.</td></tr>}
        </tbody>
      </table>
      {sorted.length>pp&&<div className="pagination">
        <span className="text-muted">{(page-1)*pp+1}–{Math.min(page*pp,sorted.length)} de {sorted.length}</span>
        <div className="pagination-buttons">
          <button disabled={page<=1} onClick={()=>setPage(page-1)}>‹</button>
          {Array.from({length:Math.min(tp,7)},(_,i)=>{let p=i+1;if(tp>7&&page>4)p=page-3+i;if(tp>7&&page>tp-3)p=tp-6+i;return <button key={p} className={page===p?'active':''} onClick={()=>setPage(p)}>{p}</button>})}
          <button disabled={page>=tp} onClick={()=>setPage(page+1)}>›</button>
        </div>
      </div>}
    </div>
  );
}
