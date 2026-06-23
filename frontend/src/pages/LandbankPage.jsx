import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopbarExpediente from '../components/TopbarExpediente'
import Avatar from '../components/Avatar'
import LandbankMap from '../components/landbank/LandbankMap'
import LandbankSidebar from '../components/landbank/LandbankSidebar'
import { apiFetch, logout } from '../utils/api'
import '../styles/home.css'
import '../styles/landbank.css'

const PERFIS_ACESSO = ['super_administrador', 'administrador']

const INITIAL_FILTERS = {
  search: '',
  status: null,
  years: new Set(),
  regionals: new Set(),
  cidades: new Set(),
  empreendimentos: new Set(),
}

function isLinked(item) {
  return !!(item.e && item.e.regional != null)
}

export default function LandbankPage() {
  const navigate  = useNavigate()
  const user      = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const temAcesso = PERFIS_ACESSO.includes(user?.perfil)

  const [data,           setData]           = useState(null)   // { items, colors, stats, last_updated }
  const [erro,           setErro]           = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [filters,        setFilters]        = useState(INITIAL_FILTERS)
  const [highlightedIdx, setHighlighted]    = useState(null)
  const [flyTo,          setFlyTo]          = useState(null)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const carregado = useRef(false)

  function handleLogout() { logout(navigate) }

  useEffect(() => {
    if (!temAcesso) { navigate('/'); return }
    if (carregado.current) return
    carregado.current = true

    apiFetch('/api/landbank/data')
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail || 'Erro ao carregar dados do Land Bank.')
        }
        return res.json()
      })
      .then(json => {
        setData(json)
        setLoading(false)
      })
      .catch(err => {
        setErro(err.message)
        setLoading(false)
      })
  }, [])

  // Enriquece cada item com sua cor (evita recalcular nos filhos)
  const enrichedItems = useMemo(() => {
    if (!data) return []
    return data.items.map((item, idx) => ({
      ...item,
      _color:       isLinked(item) ? (data.colors[item.e.regional] || '#7f8c8d') : '#5a6e8e',
      _originalIdx: idx,
    }))
  }, [data])

  // Filtragem
  const filteredItems = useMemo(() => {
    if (!enrichedItems.length) return []
    const searchUp = filters.search.toUpperCase()
    return enrichedItems.filter(item => {
      if (filters.status) {
        if (!isLinked(item)) return false
        const s = item.e.on_off === 1 ? 'Ativo' : 'Inativo'
        if (s !== filters.status) return false
      }
      if (filters.years.size > 0) {
        if (!isLinked(item)) return false
        if (!filters.years.has(String(item.e.year ?? ''))) return false
      }
      if (filters.regionals.size > 0) {
        if (!isLinked(item) || !filters.regionals.has(item.e.regional)) return false
      }
      if (filters.cidades.size > 0) {
        if (!isLinked(item) || !filters.cidades.has(item.e.cidade)) return false
      }
      if (filters.empreendimentos.size > 0) {
        if (!isLinked(item)) return false
        const emp = item.e.empreendimento || item.e.nome
        if (!filters.empreendimentos.has(emp)) return false
      }
      if (searchUp) {
        const hay = [
          item.n,
          item.e?.nome, item.e?.cidade, item.e?.empreendimento, item.e?.regional,
        ].filter(Boolean).join(' ').toUpperCase()
        if (!hay.includes(searchUp)) return false
      }
      return true
    })
  }, [enrichedItems, filters])

  function handleItemClick(originalIdx, zoom = 14) {
    const item = enrichedItems[originalIdx]
    if (item?.c) setFlyTo({ coords: item.c, zoom, id: originalIdx })
    setHighlighted(originalIdx)
    if (window.innerWidth <= 768) setSidebarOpen(false)
  }

  if (!temAcesso) return null

  return (
    <div className="app-shell">
      <Sidebar user={user} active="landbank" />

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Land Bank</span>
          </div>
          <div className="topbar-actions">
            <TopbarExpediente />
            <button className="topbar-btn topbar-btn-danger" title="Sair" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket" />
            </button>
            <Avatar user={user} size={34} radius={10} />
          </div>
        </header>

        {/* Conteúdo principal */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* Loading */}
          {loading && (
            <div className="lb-loading">
              <i className="fa-solid fa-map-location-dot" />
              <span>Carregando Land Bank…</span>
              <span style={{ fontSize: 11, color: 'var(--lb-text-muted)' }}>
                Aguarde, os dados podem demorar alguns instantes.
              </span>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="lb-loading">
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444' }} />
              <span style={{ color: 'var(--lb-text-muted)' }}>{erro}</span>
            </div>
          )}

          {/* App Land Bank */}
          {!loading && !erro && data && (
            <div className="lb-shell">

              {/* Overlay mobile */}
              <div
                className={`lb-overlay${sidebarOpen ? ' visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
              />

              {/* Sidebar do Land Bank */}
              <div className={`lb-sidebar${sidebarOpen ? ' open' : ''}`}>
                <div className="lb-sidebar-scroll">
                  <LandbankSidebar
                    items={enrichedItems}
                    colors={data.colors}
                    stats={data.stats}
                    lastUpdated={data.last_updated}
                    filters={filters}
                    onFiltersChange={setFilters}
                    filteredItems={filteredItems}
                    highlightedIdx={highlightedIdx}
                    onItemClick={handleItemClick}
                  />
                </div>
              </div>

              {/* Mapa */}
              <div className="lb-map-wrap">
                {/* Botão mobile */}
                <button className="lb-mobile-btn" onClick={() => setSidebarOpen(true)}>
                  <i className="fa-solid fa-list" />
                  Terrenos ({filteredItems.length})
                </button>

                <LandbankMap
                  items={filteredItems}
                  colors={data.colors}
                  flyTo={flyTo}
                  onItemSelect={handleItemClick}
                  highlightedIdx={highlightedIdx}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
