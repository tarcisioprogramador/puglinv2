export interface Lead {
  slug: string;
  nome: string;
  nicho?: string;
  cidade?: string;
  nota?: number;
  avaliacoes?: number;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  siteAntigo?: string;
  motivo?: string;
  status: LeadStatus;
  urlNova?: string;
  dataProposta?: string;
  valor?: number;
  obs?: string;
  contratoStatus: ContratoStatus;
  contratoEm?: string;
  manutencao?: number;
  pago: number;
  docCliente?: string;
  endCliente?: string;
  atualizado?: string;
  criadoEm?: string;
}

export type LeadStatus =
  | 'novo' | 'redesenhado' | 'publicado' | 'proposta' | 'respondeu' | 'fechado' | 'descartado';

export type ContratoStatus = 'pendente' | 'enviado' | 'assinado';

export interface ProspectorConfig {
  contratante: { nome: string; cpfCnpj: string; endereco: string; cidadeUf: string; email: string; whatsapp: string; apresentacao: string };
  hostgator: { usuario: string; dominio: string; servidor: string; senha: string; pastaBase: string };
  preferencias: { nichoPadrao: string; cidadePadrao: string; volumeLeads: number; modoEnvio: 'rascunho' | 'direto'; idioma: 'pt-BR' | 'en' };
}

export interface ApiResponse<T = any> { success: boolean; data?: T; error?: string; message?: string }

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; perPage: number; total: number; totalPages: number }
}
