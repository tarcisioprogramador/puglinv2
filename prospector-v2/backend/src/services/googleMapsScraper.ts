import { chromium } from 'playwright';
import path from 'path';

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

export async function searchGoogleMaps(
  nicho: string,
  cidade: string,
  quantidade: number = 10,
  onProgress: ProgressCallback
): Promise<BusinessResult[]> {
  const results: BusinessResult[] = [];
  let browser;

  try {
    onProgress({ type: 'log', message: '🔄 Iniciando navegador automatizado...' });
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--lang=pt-BR',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'pt-BR',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    
    onProgress({ type: 'log', message: `🔍 Buscando "${nicho} em ${cidade}" no Google Maps...` });

    // Navigate to Google Maps
    await page.goto('https://www.google.com/maps', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Accept cookies if present
    try {
      const cookieBtn = await page.$('button:has-text("Aceitar")');
      if (cookieBtn) await cookieBtn.click();
      await page.waitForTimeout(1000);
    } catch {}

    // Search for the query
    const searchInput = await page.$('input#searchboxinput, input[aria-label*="Pesquisar"]');
    if (!searchInput) {
      throw new Error('Campo de busca não encontrado no Google Maps');
    }

    await searchInput.click();
    await searchInput.fill(`${nicho} em ${cidade}`);
    await searchInput.press('Enter');
    
    onProgress({ type: 'log', message: '⏳ Aguardando resultados...' });
    await page.waitForTimeout(4000);

    // Wait for results panel to load
    try {
      await page.waitForSelector('div[role="feed"]', { timeout: 15000 });
    } catch {
      try {
        await page.waitForSelector('a[href*="maps/place"]', { timeout: 10000 });
      } catch {
        throw new Error('Nenhum resultado encontrado. Tente um termo de busca diferente.');
      }
    }

    onProgress({ type: 'log', message: '📋 Coletando empresas...' });

    // Scroll to load more results
    const maxScrolls = Math.ceil(quantidade / 5) + 5;
    let previousCount = 0;
    
    for (let scroll = 0; scroll < maxScrolls; scroll++) {
      // Get all result items
      const items = await page.$$('a[href*="maps/place"]');
      
      if (items.length > previousCount) {
        onProgress({
          type: 'progress',
          message: `Encontradas ${items.length} empresas...`,
          data: { encontradas: items.length }
        });
        previousCount = items.length;
      }

      if (items.length >= quantidade + 10) break;

      // Scroll the results panel
      const feed = await page.$('div[role="feed"]');
      if (feed) {
        await feed.evaluate(el => el.scrollBy(0, 800));
        await page.waitForTimeout(1500);
      } else {
        await page.evaluate(() => window.scrollBy(0, 800));
        await page.waitForTimeout(1500);
      }
    }

    // Extract data from each result
    const resultLinks = await page.$$('a[href*="maps/place"]');
    const limit = Math.min(resultLinks.length, quantidade + 5);
    
    for (let i = 0; i < limit; i++) {
      try {
        const links = await page.$$('a[href*="maps/place"]');
        if (i >= links.length) break;
        
        const link = links[i];
        
        // Get basic info from the result card
        const nameEl = await link.$('.fontHeadlineSmall, .qBF1Pd, .fontBodyMedium > span');
        const nome = nameEl ? await nameEl.innerText() : '';
        
        if (!nome || results.some(r => r.nome === nome)) continue;

        // Get rating and review count
        const ratingEl = await link.$('span[aria-label*="estrelas"], span[role="img"]');
        let nota = 0;
        let avaliacoes = 0;
        
        if (ratingEl) {
          const ariaLabel = await ratingEl.getAttribute('aria-label') || '';
          const ratingMatch = ariaLabel.match(/(\d[,.]\d)/);
          if (ratingMatch) nota = parseFloat(ratingMatch[0].replace(',', '.'));
          const reviewMatch = ariaLabel.match(/(\d+) avalia/);
          if (reviewMatch) avaliacoes = parseInt(reviewMatch[1]);
        }

        // If doesn't meet minimum criteria, skip
        if (nota < 4.7 || avaliacoes < 40) continue;

        // Click to open details panel
        await link.click();
        await page.waitForTimeout(2000);

        // Extract phone and website from the details panel
        let telefone = '';
        let site = '';
        let whatsapp = '';
        let endereco = '';
        let categoria = '';

        // Get address
        try {
          const addressEl = await page.$('button[data-tooltip*="endereço"] span, button:has-text("endereço")');
          if (addressEl) endereco = (await addressEl.innerText()).trim();
        } catch {}

        // Get phone
        try {
          const phoneEl = await page.$('button[data-tooltip*="telefone"] span, button:has-text("telefone")');
          if (phoneEl) telefone = (await phoneEl.innerText()).trim();
        } catch {}

        // Get website
        try {
          const siteEl = await page.$('a[data-tooltip*="site"] span, a:has-text("Site")');
          if (siteEl) site = (await siteEl.innerText()).trim();
          
          if (!site) {
            const siteBtn = await page.$('a[data-tooltip*="site"], a[href*="http"]:not([href*="maps"])');
            if (siteBtn) site = await siteBtn.getAttribute('href') || '';
          }
        } catch {}

        // Get category
        try {
          const catEl = await page.$('button[jsaction*="category"] span, button:has-text("Prestador de servi")');
          if (catEl) categoria = (await catEl.innerText()).trim();
        } catch {}

        // Extract WhatsApp from phone
        const phones = extractPhoneNumbers(telefone + ' ' + site);
        if (phones.whatsapp && !whatsapp) whatsapp = phones.whatsapp;
        if (phones.telefone && !telefone) telefone = phones.telefone;

        // Skip if no contact info at all
        if (!telefone && !site && !endereco) continue;

        results.push({ nome, nota, avaliacoes, endereco, telefone, site, whatsapp, categoria });

        onProgress({
          type: 'result',
          message: `✅ ${nome} — ★ ${nota} (${avaliacoes} avaliações)`,
          data: { nome, nota, avaliacoes }
        });

      } catch (err) {
        // Skip individual errors
        continue;
      }
    }

    onProgress({ type: 'log', message: `📊 Coleta finalizada: ${results.length} empresas encontradas com nota ≥ 4.7` });

  } catch (error: any) {
    onProgress({ type: 'error', message: `❌ Erro na busca: ${error.message}` });
    throw error;
  } finally {
    if (browser) await browser.close();
  }

  return results;
}
