import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface Props { onImport: () => void }

interface Empresa {
  nome: string;
  nota: number;
  avaliacoes: number;
  endereco: string;
  telefone: string;
  site: string;
  whatsapp: string;
  qualificado: boolean;
  score: number;
  motivos: string[];
  jaImportado: boolean;
}

interface JobStatus {
  jobId: string;
  status: 'pending' | 'running' | 'analyzing' | 'complete' | 'error';
  nicho: string;
  cidade: string;
  encontrados: number;
  analisados: number;
  qualificados: number;
  importados: number;
  empresas: Empresa[];
  logs: string[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

type ProspectorView = 'form' | 'running' | 'results';

export default function ProspectorPage({ onImport }: Props) {
  const [nicho, setNicho] = useState('');
  const [cidade, setCidade] = useState('');
  const [quantidade, setQuantidade] = useState(20);
  const [view, setView] = useState<ProspectorView>('form');
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [error, setError] = useState('');
  const logsRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const [selectedTab, setSelectedTab] = useState<'todos' | 'qualificados' | 'descartados'>('qualificados');
  const [copiado, setCopiado] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Cleanup SSE and polling on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  const startProspecting = async () => {
    if (!nicho.trim() || !cidade.trim()) {
      setError('Preencha o nicho e a cidade');
      return;
    }

    setError('');
    setLogs([]);
    setEmpresas([]);
    setJobStatus(null);
    setView('running');
    setCopiado(false);

    try {
      // Start the job
      const response: any = await api.autoProspectar(nicho.trim(), cidade.trim(), quantidade);
      const { jobId } = response.data;

      setLogs(prev => [...prev, '🔄 Conectando ao serviço de prospecção...']);

      // Connect to SSE - usa URL absoluta em produção (GitHub Pages), relativa em dev (Vite proxy)
      const API_URL = import.meta.env.VITE_API_URL || '';
      const url = API_URL
        ? `${API_URL}/api/prospects/prospectar/${jobId}/stream`
        : `/api/prospects/prospectar/${jobId}/stream`;
      
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          switch (parsed.type) {
            case 'status':
              setJobStatus(parsed.data);
              break;
            case 'log':
              setLogs(prev => [...prev, parsed.data.message]);
              break;
            case 'result':
              setEmpresas(prev => [...prev, parsed.data.empresa]);
              break;
            case 'complete':
              setJobStatus(parsed.data);
              setView('results');
              es.close();
              eventSourceRef.current = null;
              onImport();
              break;
            case 'error':
              setLogs(prev => [...prev, `❌ ${parsed.data.message}`]);
              setError(parsed.data.message);
              setView('results');
              es.close();
              eventSourceRef.current = null;
              break;
          }
        } catch {}
      };

      es.onerror = () => {
        // Try polling as fallback
        es.close();
        eventSourceRef.current = null;
        if (mountedRef.current) startPolling(jobId);
      };

    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar prospecção');
      setView('form');
    }
  };

  const startPolling = async (jobId: string) => {
    if (!mountedRef.current) return;
    setLogs(prev => [...prev, '📡 Alternando para modo de polling...']);

    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        return;
      }
      try {
        const response: any = await api.getProspectorStatus(jobId);
        const data: JobStatus = response.data;

        setJobStatus(data);
        setLogs(data.logs);
        setEmpresas(data.empresas);

        if (data.status === 'complete' || data.status === 'error') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (mountedRef.current) {
            setView('results');
            if (data.error) setError(data.error);
            onImport();
          }
        }
      } catch {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        if (mountedRef.current) {
          setError('Conexão perdida com o servidor');
          setView('results');
        }
      }
    }, 2000);
  };

  const handleExportCsv = () => {
    const filtered = getFilteredEmpresas();
    if (filtered.length === 0) return;

    const headers = ['Nome', 'Nota', 'Avaliações', 'Telefone', 'WhatsApp', 'Site', 'Endereço', 'Status', 'Motivos'];
    const rows = filtered.map(e => [
      e.nome,
      e.nota.toString(),
      e.avaliacoes.toString(),
      e.telefone,
      e.whatsapp,
      e.site,
      e.endereco,
      e.qualificado ? 'Qualificado' : 'Descartado',
      e.motivos.join('; '),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prospeccao-${nicho}-${cidade}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleCopiarWhatsApp = async () => {
    const qualificados = empresas.filter(e => e.qualificado && e.jaImportado);
    if (qualificados.length === 0) return;

    let msg = `🔍 *Prospecção - ${nicho} em ${cidade}*`;
    msg += `\n📅 ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    msg += `*${qualificados.length} leads qualificados:*\n\n`;

    qualificados.forEach((e, i) => {
      msg += `${i + 1}. *${e.nome}* (★ ${e.nota} — ${e.avaliacoes} avaliações)\n`;
      if (e.telefone) msg += `   📞 ${e.telefone}\n`;
      if (e.whatsapp) msg += `   💬 wa.me/${e.whatsapp.replace(/\D/g, '')}\n`;
      if (e.site) msg += `   🌐 ${e.site}\n`;
      if (e.endereco) msg += `   📍 ${e.endereco}\n`;
      msg += '\n';
    });

    try {
      await navigator.clipboard.writeText(msg);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = msg;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    }
  };

  const handleExportExcel = () => {
    const filtered = getFilteredEmpresas();
    if (filtered.length === 0) return;

    // For Excel, we create an HTML table (works as .xls)
    let html = '<html><head><meta charset="UTF-8"><title>Prospecção</title></head><body>';
    html += `<h2>Prospecção - ${nicho} em ${cidade}</h2>`;
    html += '<table border="1"><tr>';
    html += '<th>Nome</th><th>Nota</th><th>Avaliações</th><th>Telefone</th><th>WhatsApp</th><th>Site</th><th>Endereço</th><th>Status</th><th>Motivos</th>';
    html += '</tr>';
    filtered.forEach(e => {
      html += `<tr><td>${e.nome}</td><td>${e.nota}</td><td>${e.avaliacoes}</td><td>${e.telefone}</td><td>${e.whatsapp}</td><td>${e.site}</td><td>${e.endereco}</td><td>${e.qualificado ? 'Qualificado' : 'Descartado'}</td><td>${e.motivos.join('; ')}</td></tr>`;
    });
    html += '</table></body></html>';

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `prospeccao-${nicho}-${cidade}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const getFilteredEmpresas = useCallback(() => {
    switch (selectedTab) {
      case 'qualificados': return empresas.filter(e => e.qualificado);
      case 'descartados': return empresas.filter(e => !e.qualificado);
      default: return empresas;
    }
  }, [empresas, selectedTab]);

  // ===== RENDER =====

  const isLoading = view === 'running';

  return (
    <div className="view-container">
      {/* Form Section */}
      {view === 'form' && (
        <>
          <div className="card-section">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🔍</div>
              <h2 style={{ fontSize: 22, color: '#E8E2D5', margin: '0 0 8px' }}>Prospecção Automática</h2>
              <p style={{ color: '#A8A399', fontSize: 14, margin: 0 }}>
                Encontre clientes com site ruim automaticamente — preencha e clique no botão
              </p>
            </div>

            <div className="form-row" style={{ maxWidth: 700, margin: '0 auto 24px' }}>
              <div className="form-group flex-2">
                <label style={{ color: '#E8E2D5', fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Nicho</label>
                <input
                  value={nicho}
                  onChange={e => setNicho(e.target.value)}
                  placeholder="Ex: advogado, dentista, oficina mecânica..."
                  style={{ fontSize: 15, padding: '12px 16px', background: '#1C1B18', border: '1px solid #3A3835', borderRadius: 10, color: '#E8E2D5', width: '100%' }}
                  onKeyDown={e => e.key === 'Enter' && startProspecting()}
                />
              </div>
              <div className="form-group flex-2">
                <label style={{ color: '#E8E2D5', fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Cidade</label>
                <input
                  value={cidade}
                  onChange={e => setCidade(e.target.value)}
                  placeholder="Ex: Rio de Janeiro, São Paulo..."
                  style={{ fontSize: 15, padding: '12px 16px', background: '#1C1B18', border: '1px solid #3A3835', borderRadius: 10, color: '#E8E2D5', width: '100%' }}
                  onKeyDown={e => e.key === 'Enter' && startProspecting()}
                />
              </div>
              <div className="form-group" style={{ maxWidth: 100 }}>
                <label style={{ color: '#E8E2D5', fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>Meta</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={quantidade}
                  onChange={e => setQuantidade(parseInt(e.target.value) || 10)}
                  style={{ fontSize: 15, padding: '12px 16px', background: '#1C1B18', border: '1px solid #3A3835', borderRadius: 10, color: '#E8E2D5', width: '100%', textAlign: 'center' }}
                />
              </div>
            </div>

            {error && (
              <div className="error-banner" style={{ maxWidth: 700, margin: '0 auto 16px' }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <button
                onClick={startProspecting}
                disabled={!nicho.trim() || !cidade.trim()}
                className="btn-prospector"
                style={{
                  background: 'linear-gradient(135deg, #6A9B72 0%, #4E8757 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '16px 48px',
                  borderRadius: 12,
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 20px rgba(78, 135, 87, 0.3)',
                  opacity: (!nicho.trim() || !cidade.trim()) ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (nicho.trim() && cidade.trim()) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 25px rgba(78, 135, 87, 0.4)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(78, 135, 87, 0.3)'; }}
              >
                🔍 Encontrar Clientes Automaticamente
              </button>
            </div>
          </div>

          {/* Info Cards */}
          <div className="criteria-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', maxWidth: 900, margin: '0 auto' }}>
            <div className="card-section">
              <h4 style={{ color: '#6A9B72', margin: '0 0 8px', fontSize: 14 }}>📋 Filtros automáticos</h4>
              <ul className="criteria-list" style={{ fontSize: 13, lineHeight: 1.8 }}>
                <li>Nota ≥ <strong>4.7</strong></li>
                <li>Mínimo <strong>40</strong> avaliações</li>
                <li>Com telefone ou site</li>
              </ul>
            </div>
            <div className="card-section">
              <h4 style={{ color: '#C98A2D', margin: '0 0 8px', fontSize: 14 }}>🌐 Análise de site</h4>
              <ul className="criteria-list" style={{ fontSize: 13, lineHeight: 1.8 }}>
                <li>Detecta layout antigo</li>
                <li>Verifica CTA e responsividade</li>
                <li>Identifica subdomínios grátis</li>
              </ul>
            </div>
            <div className="card-section">
              <h4 style={{ color: '#9C7BB8', margin: '0 0 8px', fontSize: 14 }}>⚡ Resultado</h4>
              <ul className="criteria-list" style={{ fontSize: 13, lineHeight: 1.8 }}>
                <li>Leads prontos no dashboard</li>
                <li>Export CSV / Excel</li>
                <li>Copia para WhatsApp</li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* Running / Progress View */}
      {(view === 'running' || (view === 'results' && !empresas.length)) && (
        <div className="card-section" style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {isLoading ? '🔄' : jobStatus?.status === 'error' ? '❌' : '✅'}
            </div>
            <h2 style={{ color: '#E8E2D5', margin: '0 0 4px', fontSize: 20 }}>
              {isLoading ? 'Procurando leads...' : jobStatus?.status === 'error' ? 'Erro na prospecção' : 'Prospecção concluída!'}
            </h2>
            <p style={{ color: '#A8A399', fontSize: 14, margin: 0 }}>
              {isLoading
                ? `${nicho} em ${cidade}`
                : `${jobStatus?.qualificados || 0} leads qualificados de ${jobStatus?.encontrados || 0} encontrados`
              }
            </p>
          </div>

          {/* Progress bar */}
          {jobStatus && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A8A399', marginBottom: 6 }}>
                <span>🔍 Buscando</span>
                <span>🌐 Analisando sites</span>
                <span>✅ Concluído</span>
              </div>
              <div style={{ height: 6, background: '#2A2825', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                <div style={{
                  height: '100%',
                  width: `${jobStatus.analisados > 0 ? 50 : Math.min(jobStatus.encontrados * 3, 50)}%`,
                  background: '#6A9B72',
                  transition: 'width 0.5s ease',
                  borderRadius: 3,
                }} />
                <div style={{
                  height: '100%',
                  width: `${jobStatus.empresas.length > 0 ? Math.min((jobStatus.analisados / Math.max(jobStatus.empresas.length, 1)) * 50, 50) : 0}%`,
                  background: '#5E9DA8',
                  transition: 'width 0.5s ease',
                  borderRadius: 3,
                }} />
              </div>
            </div>
          )}

          {/* Status counter */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ textAlign: 'center', background: '#1C1B18', borderRadius: 10, padding: '12px 20px', flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#E8E2D5' }}>{empresas.length}</div>
              <div style={{ fontSize: 11, color: '#A8A399' }}>Encontrados</div>
            </div>
            <div style={{ textAlign: 'center', background: '#1C1B18', borderRadius: 10, padding: '12px 20px', flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#6A9B72' }}>{empresas.filter(e => e.qualificado).length}</div>
              <div style={{ fontSize: 11, color: '#A8A399' }}>Qualificados</div>
            </div>
            <div style={{ textAlign: 'center', background: '#1C1B18', borderRadius: 10, padding: '12px 20px', flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#B7B2A7' }}>{empresas.filter(e => !e.qualificado).length}</div>
              <div style={{ fontSize: 11, color: '#A8A399' }}>Descartados</div>
            </div>
          </div>

          {/* Live logs */}
          <div
            ref={logsRef}
            style={{
              background: '#141310',
              borderRadius: 10,
              padding: 16,
              height: 250,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.7,
              color: '#B7B2A7',
              whiteSpace: 'pre-wrap',
            }}
          >
            {logs.map((log, i) => (
              <div key={i} style={{
                color: log.startsWith('✅') ? '#6A9B72'
                     : log.startsWith('❌') ? '#C94A4A'
                     : log.startsWith('⚠️') ? '#C98A2D'
                     : log.startsWith('🔍') ? '#5E9DA8'
                     : log.startsWith('🌐') ? '#9C7BB8'
                     : log.startsWith('💾') ? '#6A9B72'
                     : log.startsWith('📊') ? '#7A8CA8'
                     : log.startsWith('📌') ? '#C98A2D'
                     : log.startsWith('📋') ? '#5E9DA8'
                     : log.startsWith('⏳') || log.startsWith('🔄') ? '#B7B2A7'
                     : '#B7B2A7'
              }}>
                {log}
              </div>
            ))}
            {isLoading && <div style={{ color: '#5E9DA8', animation: 'pulse 1.5s infinite' }}>▊</div>}
          </div>

          {error && (
            <div className="error-banner" style={{ marginTop: 16 }}>
              ⚠ {error}
            </div>
          )}
        </div>
      )}

      {/* Results View */}
      {view === 'results' && empresas.length > 0 && (
        <>
          {/* Summary header */}
          <div className="card-section" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>🎯</div>
            <h2 style={{ color: '#E8E2D5', margin: '0 0 4px', fontSize: 22 }}>
              Prospecção concluída!
            </h2>
            <p style={{ color: '#A8A399', fontSize: 14, margin: '0 0 20px' }}>
              {nicho} em {cidade} — {empresas.filter(e => e.qualificado).length} leads qualificados de {empresas.length} empresas encontradas
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => setView('form')}>
                🔍 Nova prospecção
              </button>
              <button className="btn btn-secondary" onClick={handleExportCsv}>
                📥 Exportar CSV
              </button>
              <button className="btn btn-secondary" onClick={handleExportExcel}>
                📊 Exportar Excel
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleCopiarWhatsApp}
                style={copiado ? { borderColor: '#6A9B72', color: '#6A9B72' } : {}}
              >
                {copiado ? '✅ Copiado!' : '📋 Copiar para WhatsApp'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #2A2825' }}>
            {([
              { key: 'qualificados', label: '✅ Qualificados', color: '#6A9B72' },
              { key: 'descartados', label: '⏭️ Descartados', color: '#B7B2A7' },
              { key: 'todos', label: '📋 Todos', color: '#7A8CA8' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: selectedTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
                  color: selectedTab === tab.key ? tab.color : '#A8A399',
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: selectedTab === tab.key ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                {tab.label}
                <span style={{ marginLeft: 6, opacity: 0.6 }}>
                  ({tab.key === 'todos' ? empresas.length : empresas.filter(e => tab.key === 'qualificados' ? e.qualificado : !e.qualificado).length})
                </span>
              </button>
            ))}
          </div>

          {/* Results list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {getFilteredEmpresas().map((empresa, i) => (
              <div
                key={i}
                className="prospect-card"
                style={{
                  borderLeft: `4px solid ${empresa.qualificado ? '#6A9B72' : '#B7B2A7'}`,
                  opacity: empresa.jaImportado ? 1 : empresa.qualificado ? 0.9 : 0.7,
                }}
              >
                <div className="prospect-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ color: '#E8E2D5', fontSize: 15 }}>{empresa.nome}</strong>
                    {empresa.jaImportado && (
                      <span style={{
                        background: '#6A9B7220',
                        color: '#6A9B72',
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                      }}>
                        IMPORTADO
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {empresa.qualificado ? (
                      <span className="criteria-title green" style={{ fontSize: 11, padding: '2px 8px' }}>Qualificado</span>
                    ) : (
                      <span className="criteria-title red" style={{ fontSize: 11, padding: '2px 8px' }}>Descartado</span>
                    )}
                    <span style={{
                      background: '#2A2825', color: '#A8A399',
                      fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                    }}>
                      Score: {empresa.score}
                    </span>
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: '#A8A399' }}>
                    ★ <strong style={{ color: '#C98A2D' }}>{empresa.nota}</strong> ({empresa.avaliacoes} avaliações)
                  </div>
                  {empresa.endereco && (
                    <div style={{ fontSize: 13, color: '#A8A399' }}>📍 {empresa.endereco}</div>
                  )}
                </div>

                <div className="form-row" style={{ marginTop: 4, gap: 16 }}>
                  {empresa.telefone && (
                    <a href={`tel:${empresa.telefone}`} style={{ color: '#5E9DA8', fontSize: 13, textDecoration: 'none' }}>
                      📞 {empresa.telefone}
                    </a>
                  )}
                  {empresa.whatsapp && (
                    <a href={`https://wa.me/${empresa.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" style={{ color: '#6A9B72', fontSize: 13, textDecoration: 'none' }}>
                      💬 WhatsApp
                    </a>
                  )}
                  {empresa.site && (
                    <a href={empresa.site.startsWith('http') ? empresa.site : `https://${empresa.site}`} target="_blank" rel="noopener" style={{ color: '#9C7BB8', fontSize: 13, textDecoration: 'none' }}>
                      🌐 Site
                    </a>
                  )}
                </div>

                {empresa.motivos.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#8A8275' }}>
                    {empresa.motivos.map((m, j) => (
                      <span key={j} style={{
                        background: '#2A2825',
                        padding: '2px 8px',
                        borderRadius: 4,
                        marginRight: 6,
                        marginBottom: 4,
                        display: 'inline-block',
                      }}>
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {getFilteredEmpresas().length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#A8A399' }}>
              Nenhuma empresa nesta categoria.
            </div>
          )}
        </>
      )}
    </div>
  );
}
