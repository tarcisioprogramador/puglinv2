import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  const mockCounts = { geral: 5, pipeline: 20, clientes: 30, sites: 15, followup: 3, contratos: 2 };
  const mockNavigate = vi.fn();

  it('renders logo and title', () => {
    render(<Sidebar currentView="geral" onNavigate={mockNavigate} counts={mockCounts} onLogout={vi.fn()} />);
    expect(screen.getByText('Prospector')).toBeInTheDocument();
    expect(screen.getByText('painel de clientes')).toBeInTheDocument();
  });

  it('renders all navigation items', () => {
    render(<Sidebar currentView="geral" onNavigate={mockNavigate} counts={mockCounts} onLogout={vi.fn()} />);
    expect(screen.getByText('Visão geral')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Sites')).toBeInTheDocument();
    expect(screen.getByText('Comparador')).toBeInTheDocument();
    expect(screen.getByText('Follow-ups')).toBeInTheDocument();
    expect(screen.getByText('Respostas')).toBeInTheDocument();
    expect(screen.getByText('Contratos')).toBeInTheDocument();
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
    expect(screen.getByText('Prospecção')).toBeInTheDocument();
    expect(screen.getByText('Atividades')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
  });

  it('highlights active view', () => {
    render(<Sidebar currentView="clientes" onNavigate={mockNavigate} counts={mockCounts} onLogout={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    const activeBtn = buttons.find(b => b.classList.contains('active'));
    expect(activeBtn).toBeTruthy();
    expect(activeBtn?.textContent).toContain('Clientes');
  });

  it('calls onNavigate when clicking a nav item', () => {
    render(<Sidebar currentView="geral" onNavigate={mockNavigate} counts={mockCounts} onLogout={vi.fn()} />);
    fireEvent.click(screen.getByText('Pipeline'));
    expect(mockNavigate).toHaveBeenCalledWith('pipeline');
  });

  it('shows counts on items', () => {
    render(<Sidebar currentView="geral" onNavigate={mockNavigate} counts={mockCounts} onLogout={vi.fn()} />);
    const countElements = screen.getAllByText('20');
    expect(countElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows user name when provided', () => {
    render(<Sidebar currentView="geral" onNavigate={mockNavigate} counts={mockCounts} userName="Admin" onLogout={vi.fn()} />);
    expect(screen.getByText(/Admin/)).toBeInTheDocument();
  });

  it('shows logout button and calls onLogout', () => {
    const mockLogout = vi.fn();
    render(<Sidebar currentView="geral" onNavigate={mockNavigate} counts={mockCounts} userName="Admin" onLogout={mockLogout} />);
    const logoutBtn = screen.getByText('Sair');
    expect(logoutBtn).toBeInTheDocument();
    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalled();
  });
});
