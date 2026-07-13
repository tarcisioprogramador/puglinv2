import { EventEmitter } from 'events';
import { chromium, Browser } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { searchGoogleMaps, BusinessResult } from './googleMapsScraper';
import { analyzeWebsite, SiteAnalysis } from './websiteAnalyzer';

export interface ProspectorStatus {
  jobId: string;
  status: 'pending' | 'running' | 'analyzing' | 'complete' | 'error';
  nicho: string;
  cidade: string;
  quantidade: number;
  encontrados: number;
  analisados: number;
  qualificados: number;
  importados: number;
  empresas: Array<{
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
  }>;
  logs: string[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface ProspectorEvent {
  type: 'status' | 'log' | 'result' | 'analysis' | 'complete' | 'error';
  data: any;
}

class ProspectorEngine {
  private jobs: Map<string, ProspectorStatus> = new Map();
  private emitters: Map<string, EventEmitter> = new Map();
  private activeJobs = 0;
  private maxConcurrentJobs = 1;

  get isBusy(): boolean { return this.activeJobs >= this.maxConcurrentJobs; }

  createJob(nicho: string, cidade: string, quantidade: number): string {
    const jobId = uuidv4().slice(0, 8);
    const job: ProspectorStatus = {
      jobId,
      status: 'pending',
      nicho,
      cidade,
      quantidade,
      encontrados: 0,
      analisados: 0,
      qualificados: 0,
      importados: 0,
      empresas: [],
      logs: [],
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    this.emitters.set(jobId, new EventEmitter());

    // Start the pipeline
    this.activeJobs++;
    this.runPipeline(jobId).finally(() => {
      this.activeJobs--;
    }).catch(err => {
      this.emit(jobId, { type: 'error', data: { message: err.message } });
    });

    return jobId;
  }

  getJob(jobId: string): ProspectorStatus | undefined {
    return this.jobs.get(jobId);
  }

  onEvent(jobId: string, callback: (event: ProspectorEvent) => void): () => void {
    const emitter = this.emitters.get(jobId);
    if (!emitter) {
      callback({ type: 'error', data: { message: 'Job não encontrado' } });
      return () => {};
    }

    const handler = (event: ProspectorEvent) => callback(event);
    emitter.on('event', handler);

    return () => { emitter.off('event', handler); };
  }

  private emit(jobId: string, event: ProspectorEvent) {
    const emitter = this.emitters.get(jobId);
    if (emitter) emitter.emit('event', event);
  }

  private updateJob(jobId: string, updates: Partial<ProspectorStatus>) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
      this.emit(jobId, { type: 'status', data: this.getPublicJob(job) });
    }
  }

  private addLog(jobId: string, message: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.logs.push(message);
      this.emit(jobId, { type: 'log', data: { message } });
    }
  }

  private getPublicJob(job: ProspectorStatus) {
    return {
      jobId: job.jobId, status: job.status, nicho: job.nicho, cidade: job.cidade,
      encontrados: job.encontrados, analisados: job.analisados,
      qualificados: job.qualificados, importados: job.importados,
      empresas: job.empresas, logs: job.logs, error: job.error,
      startedAt: job.startedAt, completedAt: job.completedAt,
    };
  }

  private addEmpresa(jobId: string, empresa: ProspectorStatus['empresas'][0]) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.empresas.push(empresa);
      job.encontrados = job.empresas.length;
      this.emit(jobId, { type: 'result', data: { empresa, total: job.empresas.length } });
    }
  }

  private emptyAnalysis(extra?: Partial<SiteAnalysis>): SiteAnalysis {
    return {
      qualificado: false, score: 0, motivos: [],
      siteFuncional: false, subdominioGratis: false, temCta: false,
      layoutModerno: false, responsivo: false, conteudoOrganizado: false,
      temProvaSocial: false, temEmail: false, emailsEncontrados: [],
      temTelefone: false, copyrightAno: null, titulo: '', descricao: '',
      problemas: { layoutAntigo: false, semCta: false, naoResponsivo: false, subdominio: false },
      ...extra,
    };
  }

  private async runPipeline(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      // Step 1: Search Google Maps
      this.updateJob(jobId, { status: 'running' });
      this.addLog(jobId, `🔍 Iniciando prospecção para "${job.nicho}" em "${job.cidade}"`);
      this.addLog(jobId, '⏳ Buscando empresas no Google Maps...');

      const businesses = await searchGoogleMaps(job.nicho, job.cidade, job.quantidade, (event) => {
        if (event.type === 'log') this.addLog(jobId, event.message);
        if (event.type === 'result') this.addLog(jobId, `📌 Encontrado: ${event.data.nome}`);
      });

      if (businesses.length === 0) {
        this.addLog(jobId, '⚠️ Nenhuma empresa encontrada para essa busca');
        this.updateJob(jobId, { status: 'complete', completedAt: new Date().toISOString() });
        this.emit(jobId, { type: 'complete', data: {} });
        return;
      }

      this.addLog(jobId, `📊 ${businesses.length} empresas encontradas. Iniciando análise de sites...`);
      this.updateJob(jobId, { status: 'analyzing' });

      // Step 2: Analyze websites (reuse ONE browser for all sites)
      const analyzerBrowser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });

      try {
        for (let i = 0; i < businesses.length; i++) {
          const biz = businesses[i];
          this.addLog(jobId, `🌐 (${i + 1}/${businesses.length}) Analisando site de ${biz.nome}...`);

          let sa: SiteAnalysis;
          if (biz.site) {
            try { sa = await analyzeWebsite(biz.site, analyzerBrowser); }
            catch { sa = this.emptyAnalysis({ motivos: ['Erro na análise'] }); }
          } else {
            sa = this.emptyAnalysis({ motivos: ['Sem site próprio'] });
          }

          const qualificado: boolean = true;
          if (qualificado) this.addLog(jobId, `✅ ${biz.nome} — QUALIFICADO${sa.score > 0 ? ` (score: ${sa.score})` : biz.site ? ' (site analisado)' : ' (sem site)'}`);
          else this.addLog(jobId, `⏭️ ${biz.nome} — ${sa.motivos[0] || 'Descartado'}`);

          let jaImportado = false;
          if (biz.site || biz.telefone || biz.whatsapp || biz.endereco) {
            try {
              await this.saveLead(jobId, biz, sa);
              jaImportado = true;
              this.addLog(jobId, `💾 ${biz.nome} salvo como lead!`);
            } catch (err: any) {
              this.addLog(jobId, `⚠️ Erro ao salvar ${biz.nome}: ${err.message}`);
            }
          }

          this.addEmpresa(jobId, {
            nome: biz.nome, nota: biz.nota, avaliacoes: biz.avaliacoes,
            endereco: biz.endereco, telefone: biz.telefone, site: biz.site,
            whatsapp: biz.whatsapp, qualificado, score: sa.score,
            motivos: sa.motivos, jaImportado,
          });

          this.updateJob(jobId, {
            analisados: i + 1,
            qualificados: job.empresas.filter(e => e.qualificado).length,
            importados: job.empresas.filter(e => e.jaImportado).length,
          });
        }
      } finally {
        try { await analyzerBrowser.close(); } catch {}
      }

      // Complete
      const q = job.empresas.filter(e => e.qualificado).length;
      const imp = job.empresas.filter(e => e.jaImportado).length;

      this.addLog(jobId, `\n✅ PROSPECÇÃO CONCLUÍDA!`);
      this.addLog(jobId, `📊 Total encontrado: ${job.empresas.length}`);
      this.addLog(jobId, `✅ Qualificados: ${q}`);
      this.addLog(jobId, `💾 Importados: ${imp}`);

      this.updateJob(jobId, { status: 'complete', completedAt: new Date().toISOString() });
      this.emit(jobId, { type: 'complete', data: { qualificados: q, importados: imp } });

    } catch (error: any) {
      this.addLog(jobId, `❌ Erro fatal: ${error.message}`);
      this.updateJob(jobId, { status: 'error', error: error.message, completedAt: new Date().toISOString() });
      this.emit(jobId, { type: 'error', data: { message: error.message } });
    }
  }

  private async saveLead(jobId: string, biz: BusinessResult, analysis: SiteAnalysis): Promise<void> {
    const db = getDb();
    const slug = this.slugify(biz.nome) + '-' + uuidv4().slice(0, 8);
    const job = this.jobs.get(jobId);
    if (!job) return;

    // Use emails found by the website analyzer (from full HTML regex)
    const email = analysis.emailsEncontrados && analysis.emailsEncontrados.length > 0
      ? analysis.emailsEncontrados[0]
      : null;

    await db.run(
      `INSERT INTO leads
      (slug, nome, nicho, cidade, nota, avaliacoes, telefone, whatsapp, siteAntigo, motivo, status, email, endCliente)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (slug) DO NOTHING`,
      [
        slug, biz.nome, job.nicho, job.cidade,
        biz.nota, biz.avaliacoes,
        biz.telefone || null, biz.whatsapp || null,
        biz.site || null, analysis.motivos.join('; '),
        'novo', email, biz.endereco || null,
      ]
    );
  }

  private slugify(t: string): string {
    return t.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  cleanup(jobId: string) {
    const emitter = this.emitters.get(jobId);
    if (emitter) emitter.removeAllListeners();
    this.emitters.delete(jobId);
    setTimeout(() => { this.jobs.delete(jobId); }, 30 * 60 * 1000);
  }
}

export const prospectorEngine = new ProspectorEngine();
