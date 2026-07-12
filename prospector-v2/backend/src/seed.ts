import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import bcrypt from 'bcryptjs';
import { initDb, getDb, closeDb } from './database';

async function seed() {
  console.log('\n🌱 Prospector v2 — Seed');
  console.log('========================\n');

  await initDb();
  const db = getDb();

  // Verifica se já existe admin
  const existing = db.prepare('SELECT COUNT(*) as c FROM usuarios').get() as any;
  if (existing?.c > 0) {
    console.log('⚠️  Já existe um usuário cadastrado. Pulando criação de admin.\n');
  } else {
    const email = process.env.SEED_EMAIL || 'tarcisioconsultorsaude@gmail.com';
    const senha = process.env.SEED_SENHA || 'Mel@2502';
    const nome = process.env.SEED_NOME || 'Tarcísio';

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);
    const slug = email.toLowerCase().replace(/[^a-z0-9]/g, '-');

    db.prepare('INSERT INTO usuarios (slug, email, nome, hash) VALUES (?, ?, ?, ?)').run(slug, email.toLowerCase(), nome, hash);
    console.log(`✅ Admin criado com sucesso!`);
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${senha}`);
    console.log(`   Nome:  ${nome}\n`);
  }

  // Config padrão
  const configPadrao: Record<string, any> = {
    contratante: { nome: '', cpfCnpj: '', endereco: '', cidadeUf: '', email: '', whatsapp: '', apresentacao: '' },
    hostgator: { usuario: '', dominio: '', servidor: '', senha: '', pastaBase: 'clientes' },
    preferencias: { nichoPadrao: '', cidadePadrao: '', volumeLeads: 10, modoEnvio: 'rascunho', idioma: 'pt-BR' },
  };

  for (const [chave, valor] of Object.entries(configPadrao)) {
    const exist = db.prepare('SELECT COUNT(*) as c FROM config WHERE chave = ?').get(chave) as any;
    if (!exist?.c) {
      db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?)').run(chave, JSON.stringify(valor));
      console.log(`📋 Config padrão "${chave}" criada.`);
    }
  }

  console.log('\n✅ Seed concluído!\n');
  closeDb();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Erro no seed:', err);
  process.exit(1);
});
