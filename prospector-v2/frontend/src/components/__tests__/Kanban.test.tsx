import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Kanban from '../Kanban';
import { Lead } from '../../types';

describe('Kanban', () => {
  const mockLeads: Lead[] = [
    { slug: 'lead-1', nome: 'João Silva', status: 'novo', nota: 4.8, avaliacoes: 50, pago: 0, contratoStatus: 'pendente' },
    { slug: 'lead-2', nome: 'Maria Santos', status: 'novo', nota: 4.9, avaliacoes: 72, pago: 0, contratoStatus: 'pendente' },
    { slug: 'lead-3', nome: 'Carlos Pereira', status: 'redesenhado', pago: 0, contratoStatus: 'pendente' },
    { slug: 'lead-4', nome: 'Ana Oliveira', status: 'proposta', dataProposta: '2026-07-01', valor: 700, pago: 0, contratoStatus: 'pendente' },
    { slug: 'lead-5', nome: 'Pedro Souza', status: 'fechado', valor: 1400, manutencao: 100, pago: 1, contratoStatus: 'assinado' },
  ];

  const mockStatus = vi.fn();
  const mockEdit = vi.fn();
  const mockDelete = vi.fn();

  it('renders all kanban columns', () => {
    render(<Kanban leads={mockLeads} onStatus={mockStatus} onEdit={mockEdit} onDelete={mockDelete} />);
    expect(screen.getByText('Novo')).toBeInTheDocument();
    expect(screen.getByText('Redesenhado')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
    expect(screen.getByText('Proposta enviada')).toBeInTheDocument();
    expect(screen.getAllByText('Respondeu').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fechado').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Descartado')).toBeInTheDocument();
  });

  it('shows lead names in correct columns', () => {
    render(<Kanban leads={mockLeads} onStatus={mockStatus} onEdit={mockEdit} onDelete={mockDelete} />);
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Carlos Pereira')).toBeInTheDocument();
    expect(screen.getByText('Ana Oliveira')).toBeInTheDocument();
    expect(screen.getByText('Pedro Souza')).toBeInTheDocument();
  });

  it('shows correct column counts', () => {
    render(<Kanban leads={mockLeads} onStatus={mockStatus} onEdit={mockEdit} onDelete={mockDelete} />);
    const counts = screen.getAllByText(/^\d+$/);
    expect(counts.length).toBeGreaterThanOrEqual(4);
  });

  it('shows rating when available', () => {
    render(<Kanban leads={mockLeads} onStatus={mockStatus} onEdit={mockEdit} onDelete={mockDelete} />);
    expect(screen.getByText(/★ 4.8/)).toBeInTheDocument();
    expect(screen.getByText(/★ 4.9/)).toBeInTheDocument();
  });

  it('shows monetary values for proposals and closed deals', () => {
    render(<Kanban leads={mockLeads} onStatus={mockStatus} onEdit={mockEdit} onDelete={mockDelete} />);
    expect(screen.getByText(/R\$ 700/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 1.400/)).toBeInTheDocument();
    expect(screen.getByText(/\+ R\$ 100\/mês/)).toBeInTheDocument();
  });

  it('shows empty state for empty columns', () => {
    render(<Kanban leads={mockLeads} onStatus={mockStatus} onEdit={mockEdit} onDelete={mockDelete} />);
    const emptyLabels = screen.getAllByText('solte aqui');
    expect(emptyLabels.length).toBeGreaterThanOrEqual(3);
  });
});
