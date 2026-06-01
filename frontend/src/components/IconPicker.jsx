import { useState, useMemo } from 'react'

// Biblioteca de ícones curada para workspaces corporativos
export const ICONES = [
  // Negócios e departamentos
  { fa: 'fa-building',             label: 'Prédio' },
  { fa: 'fa-building-columns',     label: 'Colunas' },
  { fa: 'fa-briefcase',            label: 'Maleta' },
  { fa: 'fa-landmark',             label: 'Instituição' },
  { fa: 'fa-industry',             label: 'Indústria' },
  { fa: 'fa-store',                label: 'Loja' },
  { fa: 'fa-city',                 label: 'Cidade' },
  { fa: 'fa-sitemap',              label: 'Organograma' },
  { fa: 'fa-network-wired',        label: 'Rede' },
  { fa: 'fa-diagram-project',      label: 'Diagrama' },

  // Dados e análise
  { fa: 'fa-chart-bar',            label: 'Gráfico barras' },
  { fa: 'fa-chart-line',           label: 'Gráfico linha' },
  { fa: 'fa-chart-pie',            label: 'Gráfico pizza' },
  { fa: 'fa-chart-area',           label: 'Gráfico área' },
  { fa: 'fa-database',             label: 'Banco de dados' },
  { fa: 'fa-table',                label: 'Tabela' },
  { fa: 'fa-filter',               label: 'Filtro' },
  { fa: 'fa-magnifying-glass-chart', label: 'Análise' },
  { fa: 'fa-square-poll-vertical', label: 'Pesquisa' },
  { fa: 'fa-calculator',           label: 'Calculadora' },

  // Finanças
  { fa: 'fa-coins',                label: 'Moedas' },
  { fa: 'fa-dollar-sign',          label: 'Dólar' },
  { fa: 'fa-money-bill-trend-up',  label: 'Crescimento' },
  { fa: 'fa-wallet',               label: 'Carteira' },
  { fa: 'fa-piggy-bank',           label: 'Poupança' },
  { fa: 'fa-receipt',              label: 'Recibo' },
  { fa: 'fa-file-invoice-dollar',  label: 'Fatura' },
  { fa: 'fa-hand-holding-dollar',  label: 'Financiamento' },
  { fa: 'fa-scale-balanced',       label: 'Balanço' },
  { fa: 'fa-percent',              label: 'Porcentagem' },

  // Pessoas e RH
  { fa: 'fa-users',                label: 'Usuários' },
  { fa: 'fa-user-tie',             label: 'Executivo' },
  { fa: 'fa-people-group',         label: 'Grupo' },
  { fa: 'fa-person-chalkboard',    label: 'Treinamento' },
  { fa: 'fa-id-card',              label: 'Crachá' },
  { fa: 'fa-handshake',            label: 'Parceria' },
  { fa: 'fa-award',                label: 'Prêmio' },
  { fa: 'fa-graduation-cap',       label: 'Formação' },

  // Operações e logística
  { fa: 'fa-truck',                label: 'Transporte' },
  { fa: 'fa-boxes-stacked',        label: 'Estoque' },
  { fa: 'fa-warehouse',            label: 'Armazém' },
  { fa: 'fa-map-location-dot',     label: 'Localização' },
  { fa: 'fa-route',                label: 'Rota' },
  { fa: 'fa-clipboard-list',       label: 'Lista' },
  { fa: 'fa-list-check',           label: 'Checklist' },
  { fa: 'fa-timeline',             label: 'Linha do tempo' },

  // Tecnologia
  { fa: 'fa-microchip',            label: 'Microchip' },
  { fa: 'fa-server',               label: 'Servidor' },
  { fa: 'fa-shield-halved',        label: 'Segurança' },
  { fa: 'fa-lock',                 label: 'Cadeado' },
  { fa: 'fa-gear',                 label: 'Engrenagem' },
  { fa: 'fa-gears',                label: 'Engrenagens' },
  { fa: 'fa-code',                 label: 'Código' },
  { fa: 'fa-bug',                  label: 'Bug' },

  // Comunicação e marketing
  { fa: 'fa-bullhorn',             label: 'Megafone' },
  { fa: 'fa-bullseye',             label: 'Alvo' },
  { fa: 'fa-envelope',             label: 'E-mail' },
  { fa: 'fa-headset',              label: 'Suporte' },
  { fa: 'fa-phone',                label: 'Telefone' },
  { fa: 'fa-comment-dots',         label: 'Chat' },
  { fa: 'fa-megaphone',            label: 'Anuncio' },
  { fa: 'fa-satellite-dish',       label: 'Antena' },

  // Jurídico e compliance
  { fa: 'fa-gavel',                label: 'Martelo' },
  { fa: 'fa-file-contract',        label: 'Contrato' },
  { fa: 'fa-file-shield',          label: 'Documento seguro' },
  { fa: 'fa-book',                 label: 'Livro' },
  { fa: 'fa-scroll',               label: 'Documento' },
  { fa: 'fa-stamp',                label: 'Carimbo' },

  // Saúde e qualidade
  { fa: 'fa-heart-pulse',          label: 'Saúde' },
  { fa: 'fa-stethoscope',          label: 'Saúde médica' },
  { fa: 'fa-star',                 label: 'Estrela' },
  { fa: 'fa-thumbs-up',            label: 'Aprovado' },
  { fa: 'fa-circle-check',         label: 'Verificado' },
  { fa: 'fa-medal',                label: 'Medalha' },
]

export default function IconPicker({ value, onChange }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')

  const iconesFiltrados = useMemo(() =>
    busca.trim()
      ? ICONES.filter(i => i.label.toLowerCase().includes(busca.toLowerCase()) || i.fa.includes(busca.toLowerCase()))
      : ICONES,
    [busca]
  )

  function selecionar(fa) {
    onChange(fa)
    setAberto(false)
    setBusca('')
  }

  function limpar(e) {
    e.stopPropagation()
    onChange('')
    setAberto(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Botão de seleção */}
      <div
        onClick={() => setAberto(v => !v)}
        style={{
          height: 38, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px', cursor: 'pointer',
          border: aberto ? '1px solid var(--brand-400)' : '1px solid var(--gray-200)',
          borderRadius: 'var(--r-md)',
          background: 'var(--gray-0)',
          boxShadow: aberto ? '0 0 0 3px var(--brand-100)' : 'none',
          transition: 'all var(--t-base)',
          userSelect: 'none',
        }}
      >
        {value
          ? <i className={`fa-solid ${value}`} style={{ fontSize: 16, color: 'var(--brand-600)', width: 20, textAlign: 'center' }} />
          : <i className="fa-regular fa-image" style={{ fontSize: 14, color: 'var(--gray-300)', width: 20, textAlign: 'center' }} />
        }
        <span style={{ flex: 1, fontSize: 13, color: value ? 'var(--gray-700)' : 'var(--gray-300)' }}>
          {value ? ICONES.find(i => i.fa === value)?.label ?? value : 'Selecionar ícone...'}
        </span>
        {value && (
          <span
            onClick={limpar}
            title="Remover ícone"
            style={{ fontSize: 11, color: 'var(--gray-300)', padding: '2px 4px', borderRadius: 4 }}
          >
            <i className="fa-solid fa-xmark" />
          </span>
        )}
        <i className={`fa-solid fa-chevron-${aberto ? 'up' : 'down'}`} style={{ fontSize: 10, color: 'var(--gray-400)' }} />
      </div>

      {/* Dropdown */}
      {aberto && (
        <div style={{
          position: 'absolute', top: 42, left: 0, right: 0,
          background: 'var(--gray-0)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          zIndex: 200,
          padding: 12,
        }}>
          {/* Busca */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <i className="fa-solid fa-magnifying-glass" style={{
              position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: 'var(--gray-300)', pointerEvents: 'none',
            }} />
            <input
              autoFocus
              placeholder="Buscar ícone..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                width: '100%', height: 32, padding: '0 10px 0 28px',
                border: '1px solid var(--gray-200)', borderRadius: 'var(--r-md)',
                fontSize: 12, fontFamily: 'var(--font)', outline: 'none',
                boxSizing: 'border-box', color: 'var(--gray-700)',
              }}
            />
          </div>

          {/* Grid de ícones */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 4,
            maxHeight: 220,
            overflowY: 'auto',
          }}>
            {iconesFiltrados.map(icone => (
              <button
                key={icone.fa}
                title={icone.label}
                onClick={() => selecionar(icone.fa)}
                style={{
                  width: '100%', aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: value === icone.fa ? '2px solid var(--brand-500)' : '1px solid transparent',
                  borderRadius: 'var(--r-md)',
                  background: value === icone.fa ? 'var(--brand-50)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all var(--t-base)',
                  fontSize: 15,
                  color: value === icone.fa ? 'var(--brand-600)' : 'var(--gray-600)',
                }}
                onMouseEnter={e => { if (value !== icone.fa) { e.currentTarget.style.background = 'var(--gray-50)' } }}
                onMouseLeave={e => { if (value !== icone.fa) { e.currentTarget.style.background = 'transparent' } }}
              >
                <i className={`fa-solid ${icone.fa}`} />
              </button>
            ))}
            {iconesFiltrados.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px 0', fontSize: 12, color: 'var(--gray-400)' }}>
                Nenhum ícone encontrado
              </div>
            )}
          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gray-300)', textAlign: 'right' }}>
            {iconesFiltrados.length} ícone(s)
          </div>
        </div>
      )}
    </div>
  )
}
