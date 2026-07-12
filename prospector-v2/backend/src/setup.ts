import { getDb } from './database';
import fs from 'fs';
import path from 'path';

async function setup() {
  console.log('⚙ Prospector de Sites v2 — Setup');
  console.log('Inicializando banco de dados...\n');

  getDb();

  const dataDir = path.join(__dirname, '../data/sites');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Pasta data/sites criada');
  }

  const configFile = path.join(__dirname, '../prospector-config.json');
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({
      contratante: { nome: '', cpfCnpj: '', endereco: '', cidadeUf: '', email: '', whatsapp: '', apresentacao: '' },
      hostgator: { usuario: '', dominio: '', servidor: '', senha: '', pastaBase: 'clientes' },
      preferencias: { nichoPadrao: '', cidadePadrao: '', volumeLeads: 10, modoEnvio: 'rascunho', idioma: 'pt-BR' }
    }, null, 2));
    console.log('📄 prospector-config.json criado');
  }

  console.log('\n✅ Setup concluído!');
  console.log('Para iniciar: npm run dev');
  process.exit(0);
}

setup().catch(console.error);
