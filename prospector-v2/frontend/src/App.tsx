import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './services/AuthContext';
import { api } from './services/api';
import { Lead } from './types';
import Sidebar from './components/Sidebar';
import StatsCards from './components/StatsCards';
import Kanban from './components/Kanban';
import LeadsTable from './components/LeadsTable';
import SitesGrid from './components/SitesGrid';
import Comparador from './components/Comparador';
import Financeiro from './components/Financeiro';
import Contratos from './components/Contratos';
import Followups from './components/Followups';
import RespostasPage from './components/RespostasPage';
import ProspectorPage from './components/ProspectorPage';
import ConfigPage from './components/ConfigPage';
import AtividadesPage from './components/AtividadesPage';
import ProfilePage from './components/ProfilePage';
import LeadModal from './components/LeadModal';
import FunnelChart from './components/FunnelChart';
import LoginPage from './components/LoginPage';
import './styles.css';

type View = 'geral'|'pipeline'|'clientes'|'sites'|'comparador'|'followup'|'respostas'|'contratos'|'financeiro'|'prospector'|'perfil'|'config'|'atividades';

function Dashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('geral');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead|null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [lr, sr] = await Promise.all([api.getLeads({perPage:200}), api.getDashboardStats()]);
      const lrA: any = lr; const srA: any = sr;
      if (lrA.success) setLeads(lrA.data||[]);
      if (srA.success) setStats(srA.data);
      setError('');
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = leads.filter(l => !search || (l.nome+(l.nicho||'')+(l.cidade||'')).toLowerCase().includes(search.toLowerCase()));

  const handleEdit = (l: Lead) => { setEditingLead(l); setModalOpen(true); };
  const handleDelete = async (s: string) => { if (!confirm('Excluir lead?')) return; await api.deleteLead(s); load(); };
  const handleSave = async (d: any) => { if (editingLead) await api.updateLead(editingLead.slug, d); else await api.createLead(d); setModalOpen(false); load(); };
  const handleStatus = async (s: string, st: string) => {
    const upd: any = { status: st };
    if (st==='fechado') { const v = prompt('Valor (R$):','700'); if (v&&!isNaN(parseFloat(v))) upd.valor=parseFloat(v); else return; }
    if (st==='proposta'&&!leads.find(l=>l.slug===s)?.dataProposta) upd.dataProposta=new Date().toISOString().slice(0,10);
    await api.updateLead(s, upd); load();
  };

  if (loading && !leads.length) return <div className="loading-screen"><div className="loading-icon">✳</div><h1>Prospector v2</h1><p>Carregando...</p></div>;

  const counts = {
    geral: stats?.data?.leadsAtivos||0, pipeline: filtered.filter(l=>l.status!=='descartado').length,
    clientes: filtered.length, sites: filtered.filter(l=>['redesenhado','publicado','proposta','respondeu','fechado'].includes(l.status)).length,
    followup: stats?.data?.followupsPendentes||0, contratos: filtered.filter(l=>l.status==='fechado').length,
  };

  return (
    <div className="app-layout">
      <Sidebar currentView={view} onNavigate={setView} counts={counts} userName={user?.nome} onLogout={logout} />
      <main className="main-content">
        <div className="top-bar">
          <h1 className="page-title">{({geral:'Visão geral',pipeline:'Pipeline',clientes:'Clientes',sites:'Sites',comparador:'Comparador',followup:'Follow-ups',respostas:'Respostas',contratos:'Contratos',financeiro:'Financeiro',prospector:'Prospecção',perfil:'Perfil',config:'Configurações',atividades:'Atividades'})[view]}</h1>
          <div className="top-bar-actions">
            {view==='clientes'&&<button className="btn btn-primary" onClick={()=>{setEditingLead(null);setModalOpen(true)}}>+ Novo Lead</button>}
            <input className="search-input" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} />
            <button className="btn btn-secondary" onClick={load}>↻</button>
          </div>
        </div>
        {error && <div className="error-banner">⚠ {error} <button onClick={load} className="btn-sm" style={{marginLeft:12}}>Tentar novamente</button></div>}
        <div className="view-content">
          {view==='geral'&&<>{stats?.data&&<StatsCards stats={stats.data}/>}{stats?.data?.funnel&&<FunnelChart funnel={stats.data.funnel}/>}</>}
          {view==='pipeline'&&<Kanban leads={filtered} onStatus={handleStatus} onEdit={handleEdit} onDelete={handleDelete}/>}
          {view==='clientes'&&<LeadsTable leads={filtered} onEdit={handleEdit} onDelete={handleDelete}/>}
          {view==='sites'&&<SitesGrid leads={filtered} onEdit={handleEdit}/>}
          {view==='comparador'&&<Comparador leads={filtered}/>}
          {view==='followup'&&<Followups leads={leads}/>}
          {view==='respostas'&&<RespostasPage/>}
          {view==='contratos'&&<Contratos leads={filtered} onRefresh={load}/>}
          {view==='financeiro'&&<Financeiro leads={leads} onRefresh={load}/>}
          {view==='prospector'&&<ProspectorPage onImport={load}/>}
          {view==='perfil'&&<ProfilePage/>}
          {view==='config'&&<ConfigPage onSave={load}/>}
          {view==='atividades'&&<AtividadesPage/>}
        </div>
      </main>
      {modalOpen && <LeadModal lead={editingLead} onSave={handleSave} onClose={()=>setModalOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen"><div className="loading-icon">✳</div><h1>Prospector v2</h1><p>Carregando...</p></div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard />;
}
