import React from 'react';

interface Props { stats: any }

export default function StatsCards({ stats }: Props) {
  const cards = [
    { label:'Leads ativos', value:stats.leadsAtivos, color:'' },
    { label:'Propostas na rua', value:stats.propostasEnviadas, color:'' },
    { label:'Follow-ups pendentes', value:stats.followupsPendentes, color:'ambar' },
    { label:'Fechados', value:stats.fechados, color:'verde' },
    { label:'Receita fechada', value:`R$ ${(stats.receitaFechada||0).toLocaleString('pt-BR')}`, color:'verde' },
    { label:'Potencial', value:`R$ ${(stats.potencial||0).toLocaleString('pt-BR')}`, color:'laranja' },
  ];
  return (
    <div className="stats-grid">
      {cards.map((c,i) => (
        <div key={i} className={`stat-card ${c.color}`}>
          <div className="stat-value">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
