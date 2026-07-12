const BASE = '/api';

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const tokens = (window as any).__prospectorTokens;
  const token = tokens?.getToken?.() || localStorage.getItem('prospector_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

let isRefreshing = false;
let pendingRequests: Array<{ resolve: Function; reject: Function }> = [];

function resolvePending(success: boolean) {
  const pending = pendingRequests.slice();
  pendingRequests = [];
  if (success) pending.forEach(p => p.resolve());
  else pending.forEach(p => p.reject(new Error('Sessão expirada')));
}

async function refreshToken(): Promise<boolean> {
  const tokens = (window as any).__prospectorTokens;
  try { return tokens?.doRefresh ? await tokens.doRefresh() : false; }
  catch { return false; }
}

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  async function executeRequest(): Promise<T> {
    const res = await fetch(`${BASE}${url}`, {
      headers: { ...getHeaders(), ...(opts?.headers as Record<string, string> || {}) },
      ...opts,
    });
    if (!res.ok) { const body = await res.json().catch(()=>({})); const e = new Error(body.error||`HTTP ${res.status}`); (e as any).status = res.status; throw e; }
    const ct = res.headers.get('content-type');
    if (ct?.includes('text/csv')) return res.text() as any;
    return res.json();
  }

  try {
    return await executeRequest();
  } catch (err: any) {
    // Só tenta refresh se for 401
    if ((err as any).status !== 401) throw err;

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const ok = await refreshToken();
        resolvePending(ok);
        if (ok) return await executeRequest();
      } catch { resolvePending(false); }
      finally { isRefreshing = false; }
    } else {
      // Concorrente: aguarda o refresh em andamento
      await new Promise<void>((resolve, reject) => pendingRequests.push({ resolve, reject }));
      return await executeRequest();
    }

    // Refresh falhou
    localStorage.removeItem('prospector_token');
    localStorage.removeItem('prospector_refresh');
    window.location.href = '/';
    throw new Error('Sessão expirada. Faça login novamente.');
  }
}

export const api = {
  getLeads: (p?: any) => { const q = new URLSearchParams(); if(p?.status&&p.status!=='todos') q.set('status',p.status); if(p?.search) q.set('search',p.search); if(p?.sortBy) q.set('sortBy',p.sortBy); if(p?.page) q.set('page',String(p.page)); if(p?.perPage) q.set('perPage',String(p.perPage)); return req(`/leads?${q}`); },
  getLead: (s:string) => req(`/leads/${s}`),
  createLead: (d:any) => req('/leads', { method:'POST', body:JSON.stringify(d) }),
  updateLead: (s:string, d:any) => req(`/leads/${s}`, { method:'PUT', body:JSON.stringify(d) }),
  deleteLead: (s:string) => req(`/leads/${s}`, { method:'DELETE' }),
  getDashboardStats: () => req('/dashboard/stats'),
  getFinanceiro: () => req('/dashboard/financeiro'),
  searchProspects: (n:string,c:string,q?:number) => req('/prospects/search', { method:'POST', body:JSON.stringify({nicho:n,cidade:c,quantidade:q}) }),
  importProspects: (p:any[],n?:string,c?:string) => req('/prospects/import', { method:'POST', body:JSON.stringify({prospects:p,nicho:n,cidade:c}) }),
  getConfig: () => req('/config'),
  updateConfig: (d:any) => req('/config', { method:'PUT', body:JSON.stringify(d) }),
  saveRedesign: (s:string, html:string, editor?:string) => req('/sites/redesign', { method:'POST', body:JSON.stringify({slug:s,html,editorHtml:editor}) }),
  getComparadorData: () => req('/sites/comparador/data'),
  generateProposal: (s:string) => req('/proposals/generate', { method:'POST', body:JSON.stringify({slug:s}) }),
  generateContract: (s:string) => req('/contracts/generate', { method:'POST', body:JSON.stringify({slug:s}) }),
  signContract: (s:string) => req('/contracts/sign', { method:'POST', body:JSON.stringify({slug:s}) }),
  publishSite: (s:string) => req('/deploy/publish', { method:'POST', body:JSON.stringify({slug:s}) }),
  getAtividades: (p?:any) => { const q = new URLSearchParams(); if(p?.slug) q.set('slug',p.slug); if(p?.limit) q.set('limit',String(p.limit)); return req(`/atividades?${q}`); },
  exportCsv: (p?:any) => { const q = new URLSearchParams(); if(p?.status) q.set('status',p.status); return req(`/export/csv?${q}`); },
  getReport: () => req('/export/report'),
  health: () => req('/health'),
  // Prospecção automática
  autoProspectar: (nicho:string, cidade:string, quantidade:number) => req('/prospects/auto-prospectar', {
    method:'POST', body:JSON.stringify({nicho, cidade, quantidade})
  }),
  getProspectorStatus: (jobId:string) => req(`/prospects/prospectar/${jobId}`),
};
