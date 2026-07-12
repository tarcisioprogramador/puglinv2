import React, { useState, useEffect } from 'react';
import { Lead, STATUS_NAMES, STATUS_ORDER } from '../types';

interface Props { lead: Lead|null; onSave: (d:any)=>void; onClose: ()=>void }

export default function LeadModal({ lead, onSave, onClose }: Props) {
  const [f, setF] = useState<any>({ nome:'', email:'', telefone:'', whatsapp:'', cidade:'', nicho:'', status:'novo', valor:null, dataProposta:'', urlNova:'', obs:'', manutencao:null, contratoStatus:'pendente', contratoEm:'', docCliente:'', endCliente:'' });
  useEffect(() => { if (lead) setF({ nome:lead.nome, email:lead.email, telefone:lead.telefone, whatsapp:lead.whatsapp, cidade:lead.cidade, nicho:lead.nicho, status:lead.status, valor:lead.valor, dataProposta:lead.dataProposta||'', urlNova:lead.urlNova, obs:lead.obs, manutencao:lead.manutencao, contratoStatus:lead.contratoStatus, contratoEm:lead.contratoEm, docCliente:lead.docCliente, endCliente:lead.endCliente }); }, [lead]);
  const u = (c:string, v:any) => setF({...f, [c]:v});
  return (<div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal">
    <h2>{lead?`Editar ${lead.nome}`:'Novo lead'}</h2>
    <form onSubmit={e=>{e.preventDefault();onSave(f)}}>
      <label>Nome *</label><input value={f.nome||''} onChange={e=>u('nome',e.target.value)} required />
      <div className="modal-row"><div><label>Email</label><input value={f.email||''} onChange={e=>u('email',e.target.value)} /></div><div><label>Telefone</label><input value={f.telefone||''} onChange={e=>u('telefone',e.target.value)} /></div></div>
      <div className="modal-row"><div><label>WhatsApp</label><input value={f.whatsapp||''} onChange={e=>u('whatsapp',e.target.value)} /></div><div><label>Cidade</label><input value={f.cidade||''} onChange={e=>u('cidade',e.target.value)} /></div></div>
      <div className="modal-row"><div><label>Nicho</label><input value={f.nicho||''} onChange={e=>u('nicho',e.target.value)} /></div><div><label>Status</label><select value={f.status} onChange={e=>u('status',e.target.value)}>{STATUS_ORDER.map(s=><option key={s} value={s}>{STATUS_NAMES[s]}</option>)}</select></div></div>
      <div className="modal-row"><div><label>Valor (R$)</label><input type="number" step="50" value={f.valor||''} onChange={e=>u('valor',e.target.value?parseFloat(e.target.value):null)} /></div><div><label>Data proposta</label><input type="date" value={f.dataProposta||''} onChange={e=>u('dataProposta',e.target.value)} /></div></div>
      <div className="modal-row"><div><label>Manutenção/mês</label><input type="number" step="10" value={f.manutencao||''} onChange={e=>u('manutencao',e.target.value?parseFloat(e.target.value):null)} /></div><div><label>Contrato</label><select value={f.contratoStatus||'pendente'} onChange={e=>u('contratoStatus',e.target.value)}><option value="pendente">Pendente</option><option value="enviado">Enviado</option><option value="assinado">Assinado</option></select></div></div>
      <div className="modal-row"><div><label>CPF/CNPJ cliente</label><input value={f.docCliente||''} onChange={e=>u('docCliente',e.target.value)} /></div><div><label>Endereço cliente</label><input value={f.endCliente||''} onChange={e=>u('endCliente',e.target.value)} /></div></div>
      <label>URL publicada</label><input value={f.urlNova||''} onChange={e=>u('urlNova',e.target.value)} />
      <label>Observações</label><textarea rows={3} value={f.obs||''} onChange={e=>u('obs',e.target.value)} />
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
    </form>
  </div></div>);
}
