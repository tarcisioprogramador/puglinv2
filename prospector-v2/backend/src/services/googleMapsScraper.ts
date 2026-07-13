import { chromium, Browser } from 'playwright';

export interface BusinessResult {
  nome: string;
  nota: number;
  avaliacoes: number;
  endereco: string;
  telefone: string;
  site: string;
  whatsapp: string;
  categoria: string;
}

interface ProgressCallback {
  (event: { type: 'log' | 'progress' | 'result' | 'error'; message: string; data?: any }): void;
}

function extractPhoneNumbers(text: string): { telefone: string; whatsapp: string } {
  const phoneRegex = /(?:\+?55)?\s*\(?\d{2}\)?\s*\d{4,5}-?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  const phones = matches.map(m => m.replace(/\D/g, ''));
  const telefone = phones[0] || '';
  const whatsapp = phones.find(p => p.length >= 11) || telefone;
  return { telefone, whatsapp: whatsapp ? `55${whatsapp}` : '' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function searchGoogleMaps(
  nicho: string,
  cidade: string,
  quantidade: number = 10,
  onProgress: ProgressCallback
): Promise<BusinessResult[]> {
  const results: BusinessResult[] = [];
  let browser: Browser | undefined;

  try {
    onProgress({ type: 'log', message: '🔄 Iniciando navegador...' });
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // === STRATEGY 1: Google Maps listing (get names + ratings) ===
    onProgress({ type: 'log', message: `🔍 Buscando "${nicho} em ${cidade}" no Google Maps...` });
    const query = encodeURIComponent(`${nicho} em ${cidade}`);

    try {
      await page.goto(`https://www.google.com/maps/search/${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(8000);

      const mapsItems = await page.$$('a[href*="maps/place"]');
      onProgress({ type: 'log', message: `📋 ${mapsItems.length} resultados encontrados no Maps` });

      for (let i = 0; i < Math.min(mapsItems.length, quantidade + 5); i++) {
        try {
          const links = await page.$$('a[href*="maps/place"]');
          if (i >= links.length) break;
          const link = links[i];

          const nome = await link.getAttribute('aria-label') || '';
          if (!nome || results.some(r => r.nome === nome)) continue;

          let nota = 0;
          let avaliacoes = 0;
          try {
            const info = await link.evaluate((el: Element) => {
              const parent = el.closest('div[jsaction]');
              const img = parent ? parent.querySelector('span[role="img"]') : null;
              return img ? img.getAttribute('aria-label') || '' : '';
            });
            if (info) {
              const rm = info.match(/(\d[,.]\d)/);
              if (rm) nota = parseFloat(rm[0].replace(',', '.'));
              const revm = info.match(/(\d+)\s*(avalia|review)/i);
              if (revm) avaliacoes = parseInt(revm[1]);
            }
          } catch {}

          results.push({ nome, nota, avaliacoes, endereco: '', telefone: '', site: '', whatsapp: '', categoria: '' });
        } catch { continue; }
      }
    } catch (e: any) {
      onProgress({ type: 'log', message: `⚠️ Maps: ${e.message}` });
    }

    // === STRATEGY 2: Search for each business details via Bing ===
    if (results.length > 0) {
      onProgress({ type: 'log', message: '🔎 Buscando contatos via Bing...' });

      for (let i = 0; i < results.length; i++) {
        const biz = results[i];
        try {
          await page.goto(
            `https://www.bing.com/search?q=${encodeURIComponent(`${biz.nome} ${cidade} telefone site`)}&setlang=pt-BR`,
            { waitUntil: 'domcontentloaded', timeout: 15000 }
          );
          await sleep(2000);

          const details = await page.evaluate(() => {
            const text = document.body.innerText || '';
            const html = document.body.innerHTML || '';

            const phoneMatch = text.match(/\(?\d{2}\)?\s*\d{4,5}-?\d{4}/);
            const telefone = phoneMatch ? phoneMatch[0] : '';

            const siteLinks = document.querySelectorAll('a[href^="http"]:not([href*="bing.com"]):not([href*="microsoft"]):not([href*="go.microsoft"])');
            let site = '';
            for (const a of Array.from(siteLinks)) {
              const href = (a as HTMLAnchorElement).href;
              if (href && !href.includes('bing.com') && !href.includes('microsoft')) {
                site = href;
                break;
              }
            }

            return { telefone, site };
          });

          if (details.telefone) {
            const { telefone, whatsapp } = extractPhoneNumbers(details.telefone);
            biz.telefone = telefone;
            biz.whatsapp = whatsapp;
          }
          if (details.site) biz.site = details.site;
        } catch {}

        onProgress({
          type: 'progress',
          message: `Verificando ${i + 1}/${results.length}: ${biz.nome}...`,
          data: { current: i + 1, total: results.length }
        });
      }
    }

    // === STRATEGY 3: If no results from Maps, do Bing search ===
    if (results.length === 0) {
      onProgress({ type: 'log', message: '🔄 Buscando via Bing Search...' });
      await page.goto(
        `https://www.bing.com/search?q=${encodeURIComponent(`${nicho} em ${cidade} telefone site`)}&setlang=pt-BR&count=20`,
        { waitUntil: 'domcontentloaded', timeout: 30000 }
      );
      await sleep(3000);

      const searchResults = await page.evaluate(() => {
        const items: Array<{ nome: string; telefone: string; site: string; endereco: string }> = [];
        document.querySelectorAll('#b_results > li.b_algo, .b_algo').forEach((el) => {
          const h2 = el.querySelector('h2');
          const nome = h2?.textContent?.trim() || '';
          const text = (el as HTMLElement).innerText || '';
          const phoneMatch = text.match(/\(?\d{2}\)\s*\d{4,5}-?\d{4}/);
          const telefone = phoneMatch ? phoneMatch[0] : '';
          const link = el.querySelector('a') as HTMLAnchorElement;
          const site = link?.href || '';
          if (nome && !nome.includes('Bing') && !nome.includes('Microsoft')) {
            items.push({ nome, telefone, site, endereco: '' });
          }
        });
        return items;
      });

      for (const r of searchResults) {
        if (results.some(x => x.nome === r.nome)) continue;
        const { telefone, whatsapp } = extractPhoneNumbers(r.telefone);
        results.push({
          nome: r.nome, nota: 0, avaliacoes: 0,
          endereco: r.endereco, telefone, site: r.site, whatsapp, categoria: '',
        });
        onProgress({
          type: 'result',
          message: `✅ ${r.nome}${telefone ? ` — ${telefone}` : ''}${r.site ? ` — ${r.site}` : ''}`,
          data: { nome: r.nome, nota: 0, avaliacoes: 0 }
        });
      }
    }

    if (results.length === 0) {
      throw new Error('Nenhum resultado encontrado. Tente outro nicho ou cidade.');
    }

    onProgress({ type: 'log', message: `📊 Total: ${results.length} empresas encontradas` });

  } catch (error: any) {
    onProgress({ type: 'error', message: `❌ Erro na busca: ${error.message}` });
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  return results;
}
