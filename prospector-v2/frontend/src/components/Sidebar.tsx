import React from 'react';

const ITENS: {view:string;label:string;icon:string;ck:string|null}[] = [
  {view:'geral',label:'Visão geral',icon:'◉',ck:'geral'},
  {view:'pipeline',label:'Pipeline',icon:'▦',ck:'pipeline'},
  {view:'clientes',label:'Clientes',icon:'☰',ck:'clientes'},
  {view:'sites',label:'Sites',icon:'◐',ck:'sites'},
  {view:'comparador',label:'Comparador',icon:'⊕',ck:null},
  {view:'followup',label:'Follow-ups',icon:'⚡',ck:'followup'},
  {view:'respostas',label:'Respostas',icon:'📬',ck:null},
  {view:'contratos',label:'Contratos',icon:'📋',ck:'contratos'},
  {view:'financeiro',label:'Financeiro',icon:'R$',ck:null},
  {view:'prospector',label:'Prospecção',icon:'🔍',ck:null},
  {view:'atividades',label:'Atividades',icon:'⏱',ck:null},
  {view:'perfil',label:'Perfil',icon:'👤',ck:null},
  {view:'config',label:'Config',icon:'⚙',ck:null},
];

interface Props { currentView: string; onNavigate: (v:any)=>void; counts: Record<string,number>; userName?: string; onLogout: ()=>void }

export default function Sidebar({ currentView, onNavigate, counts, userName, onLogout }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo-icon">✳</div>
        <div><div className="sidebar-logo-text">Prospector</div><div className="sidebar-logo-sub">painel de clientes</div></div>
      </div>
      <nav className="sidebar-nav">
        {ITENS.map(i => {
          const c = i.ck ? counts[i.ck] : null;
          return (
            <button key={i.view} className={`sidebar-nav-item ${currentView===i.view?'active':''}`} onClick={()=>onNavigate(i.view)}>
              <span className="nav-icon">{i.icon}</span>
              <span className="nav-label">{i.label}</span>
              {c !== null && c > 0 && <span className="nav-count">{c}</span>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        {userName && (
          <div style={{marginBottom:8,fontSize:12,color:'#A8A399'}}>
            👤 {userName}
          </div>
        )}
        <button
          onClick={onLogout}
          style={{
            width:'100%',background:'none',border:'1px solid #3A3835',color:'#CFC9BE',
            padding:'8px 12px',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:600,
            fontFamily:'inherit',marginBottom:8,transition:'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#33312E'; e.currentTarget.style.color='#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#CFC9BE'; }}
        >
          Sair
        </button>
        <div>Alimentado pelo <strong>Prospector v2</strong>.</div>
      </div>
    </aside>
  );
}
