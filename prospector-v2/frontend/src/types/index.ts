export interface Lead { slug: string; nome: string; nicho?: string; cidade?: string; nota?: number; avaliacoes?: number; email?: string; telefone?: string; whatsapp?: string; siteAntigo?: string; motivo?: string; status: LeadStatus; urlNova?: string; dataProposta?: string; valor?: number; obs?: string; contratoStatus: ContratoStatus; contratoEm?: string; manutencao?: number; pago: number; docCliente?: string; endCliente?: string; atualizado?: string; criadoEm?: string }
export type LeadStatus = 'novo'|'redesenhado'|'publicado'|'proposta'|'respondeu'|'fechado'|'descartado';
export type ContratoStatus = 'pendente'|'enviado'|'assinado';
export interface ApiResponse<T=any> { success: boolean; data?: T; error?: string; message?: string }
export interface PaginatedResponse<T> extends ApiResponse<T[]> { pagination: { page: number; perPage: number; total: number; totalPages: number } }
export const STATUS_NAMES: Record<string,string> = { novo:'Novo', redesenhado:'Redesenhado', publicado:'Publicado', proposta:'Proposta enviada', respondeu:'Respondeu', fechado:'Fechado', descartado:'Descartado' };
export const STATUS_CORES: Record<string,string> = { novo:'#7A8CA8', redesenhado:'#9C7BB8', publicado:'#5E9DA8', proposta:'#C98A2D', respondeu:'#6A9B72', fechado:'#4E8757', descartado:'#B7B2A7' };
export const STATUS_ORDER: LeadStatus[] = ['novo','redesenhado','publicado','proposta','respondeu','fechado','descartado'];
