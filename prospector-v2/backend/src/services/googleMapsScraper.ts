import { chromium, Browser } from 'playwright';
import * as cheerio from 'cheerio';

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

async function fetchDuckDuckGo(query: string): Promise<string> {
  const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
  });
  return resp.text();
}

function parseDuckDuckGoResults(html: string): { telefone: string; site: string; endereco: string } {
  const $ = cheerio.load(html);
  const result = { telefone: '', site: '', endereco: '' };
  const bodyText = $.text();
  const phoneMatch = bodyText.match(/\(?\d{2}\)?\s*\d{4,5}-?\d{4}/);
  if (phoneMatch) result.telefone = phoneMatch[0];
  const addrMatch = bodyText.match(/(Rua|Av\.|Avenida|Alameda|Travessa|Estrada|Rodovia)\s+[^,.\n]+/i);
  if (addrMatch) result.endereco = addrMatch[0].trim();
  $('.result__url, .result__a').each((_, el) => {
    if (result.site) return;
    let href = $(el).attr('href') || '';
    if (href.includes('uddg=')) {
      const match = href.match(/uddg=([^&]+)/);
      if (match) href = decodeURIComponent(match[1]);
    }
    if (href.startsWith('http') && !href.includes('duckduckgo') && !href.includes('google') && !href.includes('facebook') && !href.includes('instagram')) {
      result.site = href;
    }
  });
  return result;
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

    // === STEP 1: Google Maps → names + ratings + details from feed ===
    onProgress({ type: 'log', message: `🔍 Buscando "${nicho} em ${cidade}" no Google Maps...` });
    const query = encodeURIComponent(`${nicho} em ${cidade}`);

    try {
      await page.goto(`https://www.google.com/maps/search/${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(8000);

      // Scroll the feed to load more results
      try {
        const feed = await page.$('div[role="feed"]');
        if (feed) {
          for (let s = 0; s < 5; s++) {
            await feed.evaluate((el) => el.scrollBy(0, 800));
            await sleep(1500);
          }
        }
      } catch {}

      // Extract full business data from Maps listing cards
      const mapsData = await page.evaluate(() => {
        const items: Array<{
          nome: string; nota: number; avaliacoes: number; endereco: string;
          telefone: string; site: string; categoria: string;
        }> = [];

        // Each result is an anchor with maps/place in href
        const links = document.querySelectorAll('a[href*="maps/place"]');

        links.forEach((link) => {
          const nome = link.getAttribute('aria-label') || '';
          if (!nome) return;

          // Rating
          let nota = 0;
          let avaliacoes = 0;
          const parent = link.closest('div[jsaction]');
          if (parent) {
            const img = parent.querySelector('span[role="img"]');
            if (img) {
              const label = img.getAttribute('aria-label') || '';
              const rm = label.match(/(\d[,.]\d)/);
              if (rm) nota = parseFloat(rm[0].replace(',', '.'));
              const revm = label.match(/(\d+)\s*(avalia|review)/i);
              if (revm) avaliacoes = parseInt(revm[1]);
            }

            // Extract from the card text
            const cardText = parent.textContent || '';

            // Phone
            const phoneMatch = cardText.match(/\(?\d{2}\)\s*\d{4,5}-?\d{4}/);
            const telefone = phoneMatch ? phoneMatch[0] : '';

            // Address
            const addrMatch = cardText.match(/(Rua|Av\.|Avenida|Alameda|Travessa|Estrada|Rodovia)[^,\n]+/i);
            const endereco = addrMatch ? addrMatch[0].trim() : '';

            // Category
            const catMatch = cardText.match(/(Restaurante|Pizzaria|Hambúrguer|Padaria|Cafeteria|Salão|Barbearia|Farmácia|Clínica|Loja|Oficina|Mecânico|Hotel|Pousada)/i);
            const categoria = catMatch ? catMatch[0] : '';

            items.push({ nome, nota, avaliacoes, endereco, telefone, site: '', categoria });
          } else {
            items.push({ nome, nota, avaliacoes, endereco: '', telefone: '', site: '', categoria: '' });
          }
        });

        return items;
      });

      onProgress({ type: 'log', message: `📋 ${mapsData.length} resultados encontrados no Maps` });

      // Click each result to extract phone/site from detail panel
      for (let i = 0; i < Math.min(mapsData.length, quantidade + 5); i++) {
        const data = mapsData[i];
        if (!data.nome || results.some(r => r.nome === data.nome)) continue;

        // Try clicking to get more details (with timeout)
        try {
          const links = await page.$$('a[href*="maps/place"]');
          if (i < links.length) {
            await links[i].click();
            await sleep(2500);

            const detail = await page.evaluate(() => {
              const body = document.body.innerText || '';
              const html = document.body.innerHTML || '';

              let telefone = '';
              const phoneBtns = document.querySelectorAll('button[data-tooltip*="telefone"], button[data-tooltip*="phone"]');
              for (const btn of Array.from(phoneBtns)) {
                const span = btn.querySelector('span');
                if (span && span.textContent) { telefone = span.textContent.trim(); break; }
              }
              if (!telefone) {
                const pm = body.match(/\(?\d{2}\)\s*\d{4,5}-?\d{4}/);
                if (pm) telefone = pm[0];
              }

              let site = '';
              const siteLinks = document.querySelectorAll('a[data-tooltip*="http"], a[data-item-id*="authority"]');
              for (const a of Array.from(siteLinks)) {
                const href = (a as HTMLAnchorElement).href;
                if (href && !href.includes('google.com') && !href.includes('maps.google')) {
                  site = href; break;
                }
              }

              let endereco = '';
              const addrBtns = document.querySelectorAll('button[data-tooltip*="endere"], button[data-tooltip*="address"]');
              for (const btn of Array.from(addrBtns)) {
                const span = btn.querySelector('span');
                if (span && span.textContent && span.textContent.length > 5) {
                  endereco = span.textContent.trim(); break;
                }
              }

              return { telefone, site, endereco };
            });

            if (detail.telefone && !data.telefone) data.telefone = detail.telefone;
            if (detail.site && !data.site) data.site = detail.site;
            if (detail.endereco && !data.endereco) data.endereco = detail.endereco;
          }
        } catch {}

        results.push({
          nome: data.nome, nota: data.nota, avaliacoes: data.avaliacoes,
          endereco: data.endereco, telefone: data.telefone, site: data.site,
          whatsapp: '', categoria: data.categoria,
        });
      }
    } catch (e: any) {
      onProgress({ type: 'log', message: `⚠️ Maps: ${e.message}` });
    }

    // === STEP 2: DuckDuckGo for businesses missing phone/site ===
    const missingContact = results.filter(r => !r.telefone && !r.site);
    if (missingContact.length > 0) {
      onProgress({ type: 'log', message: `🔎 Buscando contatos para ${missingContact.length} empresas via DuckDuckGo...` });

      for (let i = 0; i < missingContact.length; i++) {
        const biz = missingContact[i];
        try {
          const html = await fetchDuckDuckGo(`${biz.nome} ${cidade} telefone site`);
          const details = parseDuckDuckGoResults(html);
          if (details.telefone) {
            const { telefone, whatsapp } = extractPhoneNumbers(details.telefone);
            biz.telefone = telefone;
            biz.whatsapp = whatsapp;
          }
          if (details.site) biz.site = details.site;
          if (details.endereco && !biz.endereco) biz.endereco = details.endereco;
        } catch {}

        onProgress({
          type: 'progress',
          message: `Verificando ${i + 1}/${missingContact.length}: ${biz.nome}...`,
          data: { current: i + 1, total: missingContact.length }
        });
        await sleep(800);
      }
    }

    // Fill whatsapp from telefone
    for (const r of results) {
      if (!r.whatsapp && r.telefone) {
        const { whatsapp } = extractPhoneNumbers(r.telefone);
        r.whatsapp = whatsapp;
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
