import { useState, useMemo, useRef, useEffect } from 'react'

// ── Formatadores ──────────────────────────────────────────────────────────────
const fmtNum  = n => (n != null && !isNaN(n)) ? Number(n).toLocaleString('pt-BR') : '—'
const fmtBRL  = n => {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' bi'
  return 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi'
}
const fmtArea = n => n ? (n / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' ha' : '—'
const isLinked = item => !!(item.e && item.e.regional != null)

// ── Dropdown simples (status e ano) ──────────────────────────────────────────
function Dropdown({ options, selected, multi, colors, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const hasFilter = multi ? selected.size > 0 : !!selected

  const btnLabel = multi
    ? (selected.size === 0 ? 'Todos' : `${selected.size} selecionado${selected.size > 1 ? 's' : ''}`)
    : (selected || 'Todos')

  function toggle(val) {
    if (multi) {
      const next = new Set(selected)
      next.has(val) ? next.delete(val) : next.add(val)
      onChange(next)
    } else {
      onChange(selected === val ? null : val)
      setOpen(false)
    }
  }

  return (
    <div className="lb-dropdown" ref={ref}>
      <button
        type="button"
        className={`lb-dropdown-btn${hasFilter ? ' active' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{btnLabel}</span>
        <i className="fa-solid fa-chevron-down" />
      </button>
      {open && (
        <div className="lb-dropdown-panel">
          {!multi && (
            <label className="lb-option">
              <input type="radio" checked={!selected} onChange={() => { onChange(null); setOpen(false) }} />
              Todos
            </label>
          )}
          {multi && (
            <label className="lb-option">
              <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} />
              Todos
            </label>
          )}
          {options.map(val => (
            <label key={val} className="lb-option">
              <input
                type={multi ? 'checkbox' : 'radio'}
                checked={multi ? selected.has(val) : selected === val}
                onChange={() => toggle(val)}
              />
              {colors?.[val] && <span className="lb-dot" style={{ background: colors[val] }} />}
              {val}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tree filter (regional → cidade → empreendimento) ─────────────────────────
function TreeFilter({ items, colors, filters, onChange }) {
  const [open, setOpen]         = useState(false)
  const [expanded, setExpanded] = useState({ regionals: new Set(), cidades: new Set() })
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const regionals = useMemo(() =>
    [...new Set(items.filter(isLinked).map(i => i.e.regional).filter(Boolean).filter(r => r !== 'None'))].sort()
  , [items])

  const hasFilter = filters.regionals.size > 0 || filters.cidades.size > 0 || filters.empreendimentos.size > 0

  function getLabel() {
    const parts = []
    if (filters.regionals.size > 0) parts.push(`${filters.regionals.size} regional${filters.regionals.size > 1 ? 'is' : ''}`)
    if (filters.cidades.size > 0) parts.push(`${filters.cidades.size} cidade${filters.cidades.size > 1 ? 's' : ''}`)
    if (filters.empreendimentos.size > 0) parts.push(`${filters.empreendimentos.size} empreend.`)
    return parts.length > 0 ? parts.join(', ') : 'Todos'
  }

  function clearAll() {
    onChange({ regionals: new Set(), cidades: new Set(), empreendimentos: new Set() })
  }

  function toggleRegional(regional) {
    const next = {
      regionals:      new Set(filters.regionals),
      cidades:        new Set(filters.cidades),
      empreendimentos: new Set(filters.empreendimentos),
    }
    if (next.regionals.has(regional)) {
      next.regionals.delete(regional)
      items.filter(i => isLinked(i) && i.e.regional === regional).forEach(i => {
        next.cidades.delete(i.e.cidade)
        next.empreendimentos.delete(i.e.empreendimento || i.e.nome)
      })
    } else {
      next.regionals.add(regional)
    }
    onChange(next)
  }

  function toggleCidade(regional, cidade) {
    const next = {
      regionals:      new Set(filters.regionals),
      cidades:        new Set(filters.cidades),
      empreendimentos: new Set(filters.empreendimentos),
    }
    if (next.cidades.has(cidade)) {
      next.cidades.delete(cidade)
      items.filter(i => isLinked(i) && i.e.cidade === cidade)
        .forEach(i => next.empreendimentos.delete(i.e.empreendimento || i.e.nome))
    } else {
      next.cidades.add(cidade)
    }
    onChange(next)
  }

  function toggleEmp(emp) {
    const next = {
      regionals:      new Set(filters.regionals),
      cidades:        new Set(filters.cidades),
      empreendimentos: new Set(filters.empreendimentos),
    }
    next.empreendimentos.has(emp) ? next.empreendimentos.delete(emp) : next.empreendimentos.add(emp)
    onChange(next)
  }

  function toggleExpand(type, key) {
    setExpanded(prev => {
      const next = { ...prev, [type]: new Set(prev[type]) }
      next[type].has(key) ? next[type].delete(key) : next[type].add(key)
      return next
    })
  }

  function getCidades(regional) {
    return [...new Set(items.filter(i => isLinked(i) && i.e.regional === regional).map(i => i.e.cidade).filter(Boolean))].sort()
  }

  function getEmps(regional, cidade) {
    return [...new Set(items.filter(i => isLinked(i) && i.e.regional === regional && i.e.cidade === cidade).map(i => i.e.empreendimento || i.e.nome).filter(Boolean))].sort()
  }

  return (
    <div className="lb-dropdown" ref={ref}>
      <button
        type="button"
        className={`lb-dropdown-btn${hasFilter ? ' active' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{getLabel()}</span>
        <i className="fa-solid fa-chevron-down" />
      </button>
      {open && (
        <div className="lb-tree-panel">
          <div className="lb-tree-all" onClick={clearAll}>
            <input type="checkbox" checked={!hasFilter} onChange={clearAll} onClick={e => e.stopPropagation()} />
            Todos
          </div>
          {regionals.map(regional => {
            const color = colors?.[regional] || '#7f8c8d'
            const isExpanded = expanded.regionals.has(regional)
            const cidades = isExpanded ? getCidades(regional) : []
            return (
              <div key={regional}>
                <div className="lb-tree-regional">
                  <span
                    className={`lb-tree-toggle${isExpanded ? ' open' : ''}`}
                    onClick={() => toggleExpand('regionals', regional)}
                  >▶</span>
                  <input
                    type="checkbox"
                    checked={filters.regionals.has(regional)}
                    onChange={() => toggleRegional(regional)}
                  />
                  <span className="lb-dot" style={{ background: color }} />
                  <span onClick={() => toggleRegional(regional)} style={{ cursor: 'pointer' }}>{regional}</span>
                </div>
                <div className={`lb-tree-children${isExpanded ? ' open' : ''}`}>
                  {cidades.map(cidade => {
                    const cidKey = `${regional}::${cidade}`
                    const cidExpanded = expanded.cidades.has(cidKey)
                    const emps = cidExpanded ? getEmps(regional, cidade) : []
                    return (
                      <div key={cidade}>
                        <div className="lb-tree-cidade">
                          <span
                            className={`lb-tree-toggle${cidExpanded ? ' open' : ''}`}
                            onClick={() => toggleExpand('cidades', cidKey)}
                          >▶</span>
                          <input
                            type="checkbox"
                            checked={filters.cidades.has(cidade)}
                            onChange={() => toggleCidade(regional, cidade)}
                          />
                          <span onClick={() => toggleCidade(regional, cidade)} style={{ cursor: 'pointer' }}>{cidade}</span>
                        </div>
                        <div className={`lb-tree-children${cidExpanded ? ' open' : ''}`}>
                          {emps.map(emp => (
                            <div key={emp} className="lb-tree-emp">
                              <input
                                type="checkbox"
                                checked={filters.empreendimentos.has(emp)}
                                onChange={() => toggleEmp(emp)}
                              />
                              <span onClick={() => toggleEmp(emp)} style={{ cursor: 'pointer' }}>{emp}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sidebar principal ─────────────────────────────────────────────────────────
export default function LandbankSidebar({
  items, colors, stats, lastUpdated,
  filters, onFiltersChange,
  filteredItems, highlightedIdx, onItemClick,
}) {
  const allYears = useMemo(() =>
    [...new Set(items.filter(i => isLinked(i) && i.e.year)
      .map(i => String(i.e.year))
      .filter(y => y && y !== 'null' && y !== 'None' && y.trim() !== ''))].sort()
  , [items])

  const hasAnyFilter = filters.search || filters.status || filters.years.size > 0
    || filters.regionals.size > 0 || filters.cidades.size > 0 || filters.empreendimentos.size > 0

  function clearAll() {
    onFiltersChange({
      search: '', status: null,
      years: new Set(),
      regionals: new Set(), cidades: new Set(), empreendimentos: new Set(),
    })
  }

  // Stats calculados sobre os itens filtrados
  const calcStats = useMemo(() => {
    const linked = filteredItems.filter(isLinked)
    return {
      count:   linked.length,
      units:   linked.reduce((s, i) => s + (i.e.total_unidades || 0), 0),
      area:    linked.reduce((s, i) => s + (i.e.area_total     || 0), 0),
      vgv:     linked.reduce((s, i) => s + (i.e.vgv_total      || 0), 0),
      vgv_bt:  linked.reduce((s, i) => s + (i.e.vgv_bt         || 0), 0),
      cidades: new Set(linked.filter(i => i.e.cidade).map(i => i.e.cidade)).size,
      estados: new Set(linked.filter(i => i.e.uf).map(i => i.e.uf)).size,
    }
  }, [filteredItems])

  const displayCount = !hasAnyFilter && stats ? stats.total_planilha : calcStats.count

  return (
    <>
      {/* Última atualização */}
      {lastUpdated && (
        <div className="lb-updated">
          <i className="fa-solid fa-database" />
          <span>{lastUpdated}</span>
        </div>
      )}

      {/* Stats */}
      <div className="lb-stats">
        <div className="lb-stat lb-stat-full">
          <span className="lb-stat-val">{fmtNum(displayCount)}</span>
          <span className="lb-stat-lbl">Empreendimentos</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val">{fmtNum(calcStats.cidades)}</span>
          <span className="lb-stat-lbl">Cidades</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val">{fmtNum(calcStats.estados)}</span>
          <span className="lb-stat-lbl">Estados</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val">{fmtNum(Math.round(calcStats.units))}</span>
          <span className="lb-stat-lbl">Unidades</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val">{fmtArea(calcStats.area)}</span>
          <span className="lb-stat-lbl">Área Total</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val green">{fmtBRL(calcStats.vgv)}</span>
          <span className="lb-stat-lbl">VGV Total</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-val green">{fmtBRL(calcStats.vgv_bt)}</span>
          <span className="lb-stat-lbl">VGV Total BT</span>
        </div>
      </div>

      {/* Busca */}
      <div className="lb-search">
        <div className="lb-search-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            className="lb-search-input"
            placeholder="Buscar terreno, cidade ou regional…"
            value={filters.search}
            onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <i
              className="fa-solid fa-xmark"
              style={{ cursor: 'pointer', color: 'var(--lb-text-muted)' }}
              onClick={() => onFiltersChange({ ...filters, search: '' })}
            />
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="lb-filters">
        <div className="lb-filter-row">
          <div className="lb-filter-group">
            <span className="lb-filter-label">Status</span>
            <Dropdown
              options={['Ativo', 'Inativo']}
              selected={filters.status}
              multi={false}
              onChange={v => onFiltersChange({ ...filters, status: v })}
            />
          </div>
          <div className="lb-filter-group">
            <span className="lb-filter-label">Ano Previsto</span>
            <Dropdown
              options={allYears}
              selected={filters.years}
              multi={true}
              onChange={v => onFiltersChange({ ...filters, years: v })}
            />
          </div>
        </div>
        <div className="lb-filter-group">
          <span className="lb-filter-label">Localização</span>
          <TreeFilter
            items={items}
            colors={colors}
            filters={filters}
            onChange={loc => onFiltersChange({ ...filters, ...loc })}
          />
        </div>
      </div>

      {/* Banner filtros ativos */}
      {hasAnyFilter && (
        <div className="lb-filter-notice">
          <span>Filtros ativos — exibindo dados correspondentes.</span>
          <button onClick={clearAll}>Limpar filtros</button>
        </div>
      )}

      {/* Lista */}
      <div className="lb-list-header">
        Lista de empreendimentos ({filteredItems.length})
      </div>
      <div className="lb-list">
        {filteredItems.map((item, listIdx) => {
          const idx     = item._originalIdx
          const linked  = isLinked(item)
          const name    = linked ? (item.e.empreendimento || item.e.nome || item.n) : item.n
          const city    = linked ? item.e.cidade  || '' : ''
          const uf      = linked ? item.e.uf      || '' : ''
          const regional = linked ? item.e.regional || '' : ''
          const units   = linked && item.e.total_unidades ? fmtNum(item.e.total_unidades) + ' un.' : ''
          const isActive = linked ? item.e.on_off === 1 : null
          const color   = item._color
          const hasCentroid = !!(item.c)

          return (
            <div
              key={listIdx}
              className={`lb-item${highlightedIdx === idx ? ' highlight' : ''}`}
              onClick={() => onItemClick(idx)}
            >
              <div className="lb-item-meta">
                {regional && <span className="lb-tag" style={{ background: color }}>{regional}</span>}
                {city     && <span className="lb-item-city">{city}{uf ? `, ${uf}` : ''}</span>}
                {units    && <span className="lb-item-units">{units}</span>}
                {!linked  && <span className="lb-badge-nodata">sem dados</span>}
                {!hasCentroid && <span className="lb-badge-nodata">sem localização</span>}
              </div>
              <div className="lb-item-header">
                <span className="lb-item-name" title={item.n}>{name}</span>
                {isActive !== null && (
                  <span className={isActive ? 'lb-status-active' : 'lb-status-inactive'}>
                    {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
        {filteredItems.length === 0 && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--lb-text-muted)', fontSize: 13 }}>
            Nenhum resultado para os filtros aplicados.
          </div>
        )}
      </div>
    </>
  )
}
