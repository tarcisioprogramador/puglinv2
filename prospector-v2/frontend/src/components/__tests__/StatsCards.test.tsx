import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsCards from '../StatsCards';

describe('StatsCards', () => {
  const mockStats = {
    totalLeads: 25,
    leadsAtivos: 20,
    propostasEnviadas: 8,
    followupsPendentes: 3,
    fechados: 2,
    receitaFechada: 1400,
    mrr: 200,
    potencial: 14000,
    funnel: [],
    followups: [],
  };

  it('renders all stat cards', () => {
    render(<StatsCards stats={mockStats} />);
    expect(screen.getByText('Leads ativos')).toBeInTheDocument();
    expect(screen.getByText('Propostas na rua')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups pendentes')).toBeInTheDocument();
    expect(screen.getByText('Fechados')).toBeInTheDocument();
    expect(screen.getByText('Receita fechada')).toBeInTheDocument();
    expect(screen.getByText('Potencial')).toBeInTheDocument();
  });

  it('renders formatted currency values', () => {
    render(<StatsCards stats={mockStats} />);
    expect(screen.getByText('R$ 1.400')).toBeInTheDocument();
    expect(screen.getByText('R$ 14.000')).toBeInTheDocument();
  });

  it('renders correct counts', () => {
    render(<StatsCards stats={mockStats} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
