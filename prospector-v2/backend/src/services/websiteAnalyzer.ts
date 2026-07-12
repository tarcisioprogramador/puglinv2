import { chromium, Browser } from 'playwright';

export interface SiteAnalysis {
  qualificado: boolean;
  score: number; // 0-100, higher = worse site (more likely to need services)
  motivos: string[];
  siteFuncional: boolean;
  subdominioGratis: boolean;
  temCta: boolean;
  layoutModerno: boolean;
  responsivo: boolean;
  conteudoOrganizado: boolean;
  temProvaSocial: boolean;
  temEmail: boolean;
  emailsEncontrados: string[];
  temTelefone: boolean;
  copyrightAno: number | null;
  titulo: string;
  descricao: string;
}

const SUBDOMINIOS_GRATIS = [
  'wixsite.com', 'wordpress.com', 'blogspot.com', 'blogger.com',
  'webnode.com', 'gooqle.com', 'weebly.com', 'yolasite.com',
  'site123.com', 'strikingly.com', 'jimdo.com', 'imcreator.com',
  'carrd.co', 'about.me', 'tumblr.com', 'medium.com',
  'microsoftonline.com', 'mybusiness.com', 'google.com/sites',
];

const PALAVRAS_CTA = [
  'orçamento', 'orçamento grátis', 'solicitar orçamento', 'peça orçamento',
  'contratar', 'contrate agora', 'contrate já', 'fazer pedido',
  'comprar', 'compre agora', 'compre já', 'adquira',
  'agendar', 'agende agora', 'agende seu horário', 'marque sua consulta',
  'fale conosco', 'entre em contato', 'contato', 'fale agora',
  'whatsapp', 'falar com', 'simular', 'solicitar',
  'cadastre-se', 'inscreva-se', 'assine', 'experimente grátis',
  'comece agora', 'solicitar proposta', 'peça sua proposta',
  'ligue agora', 'ligue já', 'disque agora',
];

const PALAVRAS_PROVA_SOCIAL = [
  'depoimento', 'testemunha', 'cliente satisfeito', 'cases de sucesso',
  'resultados', 'antes e depois', 'portfolio', 'trabalhos realizados',
  'clientes', 'parceiros', 'selo', 'certificação', 'premiação',
  'prêmio', 'reconhecimento', 'recomendação', 'avaliação',
];

function isSubdomainGratuito(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return SUBDOMINIOS_GRATIS.some(sd => hostname.includes(sd));
  } catch {
    return false;
  }
}

export async function analyzeWebsite(url: string, browserInstance?: Browser): Promise<SiteAnalysis> {
  const result: SiteAnalysis = {
    qualificado: false,
    score: 0,
    motivos: [],
    siteFuncional: false,
    subdominioGratis: false,
    temCta: false,
    layoutModerno: false,
    responsivo: false,
    conteudoOrganizado: false,
    temProvaSocial: false,
    temEmail: false,
    emailsEncontrados: [],
    temTelefone: false,
    copyrightAno: null,
    titulo: '',
    descricao: '',
  };

  // Validate URL
  let fullUrl = url.trim();
  if (!fullUrl) return result;
  if (!fullUrl.startsWith('http')) fullUrl = `https://${fullUrl}`;

  try {
    new URL(fullUrl);
  } catch {
    result.motivos.push('URL inválida');
    return result;
  }

  // Check if subdomain (free hosting)
  if (isSubdomainGratuito(fullUrl)) {
    result.subdominioGratis = true;
    result.motivos.push('Usa subdomínio gratuito (site amador)');
    result.score += 30;
  }

  const ownBrowser = !browserInstance;
  const browser = browserInstance || await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();

    // Try to load the page
    let loaded = false;
    try {
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      loaded = true;
      result.siteFuncional = true;
    } catch {
      result.motivos.push('Site não carregou ou está fora do ar');
      result.score += 40;
      return result;
    }

    // Wait a bit for JS to execute
    await page.waitForTimeout(2000);

    // Get page title
    try {
      result.titulo = await page.title();
    } catch {}

    // Get meta description
    try {
      const metaDesc = await page.$('meta[name="description"]');
      if (metaDesc) result.descricao = await metaDesc.getAttribute('content') || '';
    } catch {}

    // --- Analysis ---

    // 1. Get full page text for analysis
    const pageText = await page.evaluate(() => document.body?.innerText || '');
    const html = await page.evaluate(() => document.documentElement?.outerHTML || '');
    const textLower = pageText.toLowerCase();

    // 2. Check for CTA elements
    const ctaWords = PALAVRAS_CTA.filter(p => textLower.includes(p));
    if (ctaWords.length > 0) {
      result.temCta = true;
    } else {
      // Check for buttons and links
      const buttons = await page.$$('button, a.btn, a.cta, [class*="cta"], [class*="button"], [class*="btn"], a[href*="whatsapp"], a[href*="tel:"]');
      if (buttons.length >= 2) {
        result.temCta = true;
      }
    }

    if (!result.temCta) {
      result.motivos.push('Falta de CTA (botões de ação)');
      result.score += 25;
    }

    // 3. Check for modern layout indicators
    const hasModernDoctype = html.includes('<!DOCTYPE html>');
    const hasViewportMeta = html.includes('name="viewport"') || html.includes("name='viewport'");
    const hasModernCSS = html.includes('tailwind') || html.includes('bootstrap') || 
                         html.includes('flexbox') || html.includes('grid') ||
                         html.includes(':root') || html.includes('var(--');
    const hasFontAwesome = html.includes('font-awesome') || html.includes('fontawesome');
    const hasGoogleFonts = html.includes('fonts.googleapis.com');

    const modernIndicators = [hasModernDoctype, hasViewportMeta, hasModernCSS, hasFontAwesome, hasGoogleFonts];
    const modernCount = modernIndicators.filter(Boolean).length;

    if (modernCount >= 3) {
      result.layoutModerno = true;
    } else {
      result.motivos.push('Layout parece desatualizado');
      result.score += 20;
    }

    // 4. Check responsiveness
    if (hasViewportMeta) {
      result.responsivo = true;
    } else {
      // Check if site uses fixed widths
      const hasFixedWidth = html.includes('width:') && !html.includes('max-width') && !html.includes('width: 100%');
      if (!hasFixedWidth) {
        // Check viewport via JS
        const vp = await page.evaluate(() => {
          const m = document.querySelector('meta[name="viewport"]');
          return m ? m.getAttribute('content') : null;
        });
        if (vp) {
          result.responsivo = true;
        } else {
          result.motivos.push('Site não é responsivo (não adaptado para mobile)');
          result.score += 20;
        }
      } else {
        result.motivos.push('Site não é responsivo (não adaptado para mobile)');
        result.score += 20;
      }
    }

    // 5. Check content organization
    const headings = await page.$$('h1, h2, h3');
    const paragraphs = await page.$$('p');
    const lists = await page.$$('ul, ol');

    if (headings.length >= 2 && paragraphs.length >= 3) {
      result.conteudoOrganizado = true;
    } else {
      result.motivos.push('Conteúdo desorganizado (pouca estrutura)');
      result.score += 15;
    }

    // 6. Check for social proof
    const socialWords = PALAVRAS_PROVA_SOCIAL.filter(p => textLower.includes(p));
    result.temProvaSocial = socialWords.length >= 2;
    
    if (!result.temProvaSocial) {
      result.motivos.push('Sem prova social (depoimentos, cases, clientes)');
      result.score += 15;
    }

    // 7. Extract emails from HTML
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const allEmails: string[] = html.match(emailRegex) || [];
    result.emailsEncontrados = [...new Set(
      allEmails.filter((e: string) =>
        !e.includes('example.com') &&
        !e.includes('domain.com') &&
        !e.includes('@none') &&
        !e.includes('@email') &&
        !e.includes('@mail.com')
      )
    )];
    result.temEmail = result.emailsEncontrados.length > 0;

    // 8. Check for phone
    const phoneRegex = /\(\d{2}\)\s*\d{4,5}-?\d{4}/g;
    result.temTelefone = phoneRegex.test(html);

    // 9. Check copyright year
    const yearMatch = textLower.match(/copyright\s*(?:©|\(c\))?\s*(\d{4})/i) || 
                     textLower.match(/©\s*(\d{4})/);
    if (yearMatch) {
      result.copyrightAno = parseInt(yearMatch[1]);
      const currentYear = new Date().getFullYear();
      if (result.copyrightAno < currentYear - 2) {
        result.motivos.push(`Copyright desatualizado (${result.copyrightAno})`);
        result.score += 10;
      }
    }

    // 10. Check for old-looking design via screenshot analysis
    // Simplified: check if there are excessive inline styles (sign of old WYSIWYG editor)
    const inlineStyles = (html.match(/style\s*=\s*["'][^"']*["']/g) || []).length;
    if (inlineStyles > 50) {
      if (!result.motivos.includes('Layout parece desatualizado')) {
        result.motivos.push('Layout parece desatualizado');
        result.score += 20;
      }
    }

    // --- Final Qualification ---
    
    // A site is qualified (needs our services) if:
    // - It's functional (loaded successfully) AND
    // - Has problems (score >= 40) OR uses free subdomain
    const siteComProblemas = result.score >= 40 || result.subdominioGratis;

    if (result.siteFuncional && siteComProblemas) {
      result.qualificado = true;
    }

    // Cap score at 100
    result.score = Math.min(result.score, 100);

  } catch (error: any) {
    result.motivos.push(`Erro na análise: ${error.message}`);
    result.score += 30;
  } finally {
    if (ownBrowser) await browser.close();
  }

  return result;
}
