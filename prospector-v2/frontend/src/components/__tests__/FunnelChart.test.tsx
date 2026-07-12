import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FunnelChart from '../FunnelChart';

describe('FunnelChart', () => {
  const mockFunnel = [
    { status: 'novo', quantidade: 10, cor: '#7A8CA8' },
    { status: 'redesenhado', quantidade: 5, cor: '#9C7BB8' },
    { status: 'publicado', quantidade: 3, cor: '#5E9DA8' },
    { status: 'proposta', quantidade: 2, cor: '#C98A2D' },
    { status: 'respondeu', quantidade: 1, cor: '#6A9B72' },
    { status: 'fechado', quantidade: 1, cor: '#4E8757' },
  ];

  it('renders funnel title', () => {
    render(<FunnelChart funnel={mockFunnel} />);
    expect(screen.getByText('Funil do pipeline')).toBeInTheDocument();
  });

  it('renders all funnel statuses', () => {
    render(<FunnelChart funnel={mockFunnel} />);
    expect(screen.getByText('Novo')).toBeInTheDocument();
    expect(screen.getByText('Redesenhado')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
    expect(screen.getByText('Proposta')).toBeInTheDocument();
    expect(screen.getByText('Respondeu')).toBeInTheDocument();
    expect(screen.getByText('Fechado')).toBeInTheDocument();
  });

  it('renders correct quantities', () => {
    render(<FunnelChart funnel={mockFunnel} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('returns null when funnel is empty', () => {
    const { container } = render(<FunnelChart funnel={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when funnel is undefined', () => {
    const { container } = render(<FunnelChart funnel={undefined as any} />);
    expect(container.innerHTML).toBe('');
  });
});
