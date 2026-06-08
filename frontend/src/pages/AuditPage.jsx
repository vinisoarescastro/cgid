import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/audit.css'
import logoSidebarFull from '../assets/logo-sidebar-full.png'
import logoSidebarIcon from '../assets/logo-sidebar-icon.png'
import Avatar from '../components/Avatar'

const API = 'http://localhost:8000'

const PERFIL_LABEL = {
  super_administrador: 'Super Administrador',
  administrador: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador',
  visitante: 'Visitante',
}

const ADMIN_PERFIS  = ['super_administrador', 'administrador']
const SUPER_ADMIN   = 'super_administrador'
const POR_PAGINA    = 50

const TIPO_META = {
  autenticacao: { icon: 'fa-right-to-bracket', label: 'Autenticação' },
  seguranca:    { icon: 'fa-shield-halved',    label: 'Segurança'    },
  usuario:      { icon: 'fa-user-pen',         label: 'Usuário'      },
  permissao:    { icon: 'fa-key',              label: 'Permissão'    },
  acesso:       { icon: 'fa-ban',              label: 'Acesso'       },
  relatorio:    { icon: 'fa-chart-bar',        label: 'Relatório'    },
  sistema:      { icon: 'fa-gear',             label: 'Sistema'      },
}

function TipoBadge({ tipo }) {
  const meta = TIPO_META[tipo] ?? { icon: 'fa-circle', label: tipo }
  return (
    <span className={`aud-badge ${tipo}`}>
      <i className={`fa-solid ${meta.icon}`} />
      {meta.label}
    </span>
  )
}

function formatarMomento(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AuditPage() {
  const navigate   = useNavigate()
  const [expanded, setExpanded] = useState(() => sessionStorage.getItem('sidebar_expanded') === '1')
  const user       = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin    = ADMIN_PERFIS.includes(user.perfil)
  const isSuperAdmin = user.perfil === SUPER_ADMIN

  // filtros
  const [filtros, setFiltros] = useState({
    tipo_evento: '', modulo: '', usuario: '', ip: '', data_inicio: '', data_fim: '',
  })
  const [tiposDisponiveis,   setTiposDisponiveis]   = useState([])
  const [modulosDisponiveis, setModulosDisponiveis] = useState([])

  // dados
  const [dados,    setDados]    = useState({ total: 0, pagina: 1, paginas: 1, itens: [] })
  const [loading,  setLoading]  = useState(false)
  const [pagina,   setPagina]   = useState(1)

  // linha expandida
  const [expandido, setExpandido] = useState(null)

  function handleLogout() {
    sessionStorage.removeItem('cgid_user')
    navigate('/login')
  }

  // Redireciona não-admins
  useEffect(() => {
    if (!isAdmin) navigate('/')
  }, [])

  useEffect(() => {
    fetch(`${API}/auditoria/tipos`).then(r => r.json()).then(setTiposDisponiveis).catch(() => {})
    fetch(`${API}/auditoria/modulos`).then(r => r.json()).then(setModulosDisponiveis).catch(() => {})
  }, [])

  const buscar = useCallback((pg = 1) => {
    setLoading(true)
    const p = new URLSearchParams({ pagina: pg, por_pagina: POR_PAGINA })
    if (filtros.tipo_evento) p.set('tipo_evento', filtros.tipo_evento)
    if (filtros.modulo)      p.set('modulo',      filtros.modulo)
    if (filtros.usuario)     p.set('usuario',     filtros.usuario)
    if (filtros.ip)          p.set('ip',          filtros.ip)
    if (filtros.data_inicio) p.set('data_inicio', filtros.data_inicio)
    if (filtros.data_fim)    p.set('data_fim',    filtros.data_fim)
    fetch(`${API}/auditoria?${p}`)
      .then(r => r.json())
      .then(d => { setDados(d); setPagina(pg) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filtros])

  useEffect(() => { buscar(1) }, [])

  function aplicarFiltros(e) {
    e.preventDefault()
    buscar(1)
  }

  function limparFiltros() {
    setFiltros({ tipo_evento: '', modulo: '', usuario: '', ip: '', data_inicio: '', data_fim: '' })
    // busca sem filtros manualmente
    setLoading(true)
    fetch(`${API}/auditoria?pagina=1&por_pagina=${POR_PAGINA}`)
      .then(r => r.json())
      .then(d => { setDados(d); setPagina(1) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function exportarCSV() {
    const p = new URLSearchParams()
    if (filtros.tipo_evento) p.set('tipo_evento', filtros.tipo_evento)
    if (filtros.modulo)      p.set('modulo',      filtros.modulo)
    if (filtros.usuario)     p.set('usuario',     filtros.usuario)
    if (filtros.ip)          p.set('ip',          filtros.ip)
    if (filtros.data_inicio) p.set('data_inicio', filtros.data_inicio)
    if (filtros.data_fim)    p.set('data_fim',    filtros.data_fim)
    window.open(`${API}/auditoria/export-csv?${p}`, '_blank')
  }

  function set(k, v) { setFiltros(f => ({ ...f, [k]: v })) }

  function irPara(pg) {
    if (pg < 1 || pg > dados.paginas) return
    buscar(pg)
  }

  function paginasVisiveis() {
    const total = dados.paginas
    const atual = pagina
    const paginas = []
    const inicio = Math.max(1, atual - 2)
    const fim    = Math.min(total, atual + 2)
    for (let i = inicio; i <= fim; i++) paginas.push(i)
    return paginas
  }

  if (!isAdmin) return null

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className={`sidebar${expanded ? ' expanded' : ''}`}>
        <div className="sb-header">
          {expanded
            ? <img src={logoSidebarFull} alt="Brasil Terrenos" className="sb-logo-full" />
            : <img src={logoSidebarIcon} alt="Brasil Terrenos" className="sb-logo-icon-img" />
          }
          <button className="sb-toggle" onClick={() => setExpanded(v => { sessionStorage.setItem('sidebar_expanded', v ? '' : '1'); return !v })}
            title={expanded ? 'Retrair menu' : 'Expandir menu'}>
            <i className={`fa-solid ${expanded ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
          </button>
        </div>
        <nav className="sb-nav">
          <div className="sb-link" onClick={() => navigate('/')}>
            <div className="sb-icon"><i className="fa-solid fa-house" /></div>
            <span className="sb-label">Home</span>
          </div>
          {isAdmin && (
            <div className="sb-link" onClick={() => navigate('/usuarios')}>
              <div className="sb-icon"><i className="fa-solid fa-users" /></div>
              <span className="sb-label">Usuários</span>
            </div>
          )}
          <div className="sb-link" onClick={() => navigate('/workspaces')}>
            <div className="sb-icon"><i className="fa-solid fa-building-columns" /></div>
            <span className="sb-label">Workspace</span>
          </div>
          <div className="sb-link" onClick={() => navigate('/favoritos')}>
            <div className="sb-icon"><i className="fa-solid fa-star" /></div>
            <span className="sb-label">Favoritos</span>
          </div>
          {isSuperAdmin && (
            <div className="sb-link active">
              <div className="sb-icon"><i className="fa-solid fa-file-lines" /></div>
              <span className="sb-label">Auditoria</span>
            </div>
          )}
          {isAdmin && (
            <div className="sb-link" onClick={() => navigate('/configuracoes')}>
              <div className="sb-icon"><i className="fa-solid fa-gear" /></div>
              <span className="sb-label">Configurações</span>
            </div>
          )}
        </nav>
        <div className="sb-footer">
          <div className="sb-user">
            <Avatar user={user} size={36} radius={10} />
            <div className="sb-user-info">
              <div className="sb-user-name">{user.nome}</div>
              <div className="sb-user-email">{user.email}</div>
              <div className="sb-user-role">{PERFIL_LABEL[user.perfil] ?? user.perfil}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── App Body ── */}
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Auditoria</span>
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn topbar-btn-danger" title="Sair" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket" />
            </button>
            <Avatar user={user} size={34} radius={10} />
          </div>
        </header>

        <div className="content-area">
          <div className="page-content">

            <div className="ph">
              <div>
                <div className="ph-title">Auditoria</div>
                <div className="ph-sub">Registro imutável de todas as ações do sistema</div>
              </div>
              <button className="btn btn-ghost" onClick={exportarCSV}>
                <i className="fa-solid fa-file-csv" /> Exportar CSV
              </button>
            </div>

            {/* ── Filtros ── */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-bd">
                <form onSubmit={aplicarFiltros}>
                  <div className="aud-toolbar">
                    <div className="aud-filter-group">
                      <span className="aud-filter-label">Tipo de evento</span>
                      <select className="aud-filter-input" value={filtros.tipo_evento} onChange={e => set('tipo_evento', e.target.value)}>
                        <option value="">Todos</option>
                        {tiposDisponiveis.map(t => (
                          <option key={t} value={t}>{TIPO_META[t]?.label ?? t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="aud-filter-group">
                      <span className="aud-filter-label">Módulo</span>
                      <select className="aud-filter-input" value={filtros.modulo} onChange={e => set('modulo', e.target.value)}>
                        <option value="">Todos</option>
                        {modulosDisponiveis.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="aud-filter-group">
                      <span className="aud-filter-label">Usuário</span>
                      <input className="aud-filter-input wide" placeholder="Nome ou e-mail..." value={filtros.usuario} onChange={e => set('usuario', e.target.value)} />
                    </div>
                    <div className="aud-filter-group">
                      <span className="aud-filter-label">IP</span>
                      <input className="aud-filter-input" placeholder="Ex: 192.168..." value={filtros.ip} onChange={e => set('ip', e.target.value)} />
                    </div>
                    <div className="aud-filter-group">
                      <span className="aud-filter-label">Data início</span>
                      <input type="date" className="aud-filter-input" value={filtros.data_inicio} onChange={e => set('data_inicio', e.target.value)} />
                    </div>
                    <div className="aud-filter-group">
                      <span className="aud-filter-label">Data fim</span>
                      <input type="date" className="aud-filter-input" value={filtros.data_fim} onChange={e => set('data_fim', e.target.value)} />
                    </div>
                    <div className="aud-filter-group" style={{ justifyContent: 'flex-end' }}>
                      <span className="aud-filter-label" style={{ opacity: 0 }}>.</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={limparFiltros}>Limpar</button>
                        <button type="submit" className="btn btn-primary btn-sm">
                          <i className="fa-solid fa-magnifying-glass" /> Filtrar
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            {/* ── Tabela ── */}
            <div className="card">
              <div className="card-bd" style={{ padding: 0 }}>
                {loading ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>
                    Carregando...
                  </div>
                ) : dados.itens.length === 0 ? (
                  <div className="ws-empty" style={{ padding: '40px 0' }}>
                    <i className="fa-solid fa-file-lines" />
                    <div className="ws-empty-title">Nenhum registro encontrado</div>
                    <div className="ws-empty-sub">Tente ajustar os filtros.</div>
                  </div>
                ) : (
                  <div className="aud-table-wrap">
                    <table className="aud-table">
                      <thead>
                        <tr>
                          <th>Momento</th>
                          <th>Tipo</th>
                          <th>Módulo</th>
                          <th>Usuário</th>
                          <th>Detalhe</th>
                          <th>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.itens.map(log => (
                          <>
                            <tr
                              key={log.id}
                              style={{ cursor: (log.valor_anterior || log.valor_novo) ? 'pointer' : 'default' }}
                              onClick={() => {
                                if (!log.valor_anterior && !log.valor_novo) return
                                setExpandido(v => v === log.id ? null : log.id)
                              }}
                            >
                              <td className="momento">{formatarMomento(log.momento)}</td>
                              <td><TipoBadge tipo={log.tipo_evento} /></td>
                              <td style={{ fontSize: 11, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>{log.modulo}</td>
                              <td className="usuario-col">
                                {log.nome_usuario
                                  ? <div>
                                      <div style={{ fontWeight: 600, fontSize: 12 }}>{log.nome_usuario}</div>
                                      <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{log.email_usuario}</div>
                                    </div>
                                  : <span style={{ color: 'var(--gray-300)', fontSize: 11 }}>sistema</span>
                                }
                              </td>
                              <td className="detalhe" title={log.detalhe}>
                                {log.detalhe}
                                {(log.valor_anterior || log.valor_novo) && (
                                  <i className={`fa-solid ${expandido === log.id ? 'fa-chevron-up' : 'fa-chevron-down'}`}
                                    style={{ marginLeft: 6, fontSize: 9, color: 'var(--gray-400)' }} />
                                )}
                              </td>
                              <td className="ip-col">{log.endereco_ip || '—'}</td>
                            </tr>
                            {expandido === log.id && (
                              <tr className="aud-detail-row" key={`${log.id}-detail`}>
                                <td colSpan={6}>
                                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    {log.valor_anterior && (
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', marginBottom: 4 }}>ANTES</div>
                                        <pre className="aud-detail-pre">{log.valor_anterior}</pre>
                                      </div>
                                    )}
                                    {log.valor_novo && (
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--brand-500)', marginBottom: 4 }}>DEPOIS</div>
                                        <pre className="aud-detail-pre">{log.valor_novo}</pre>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Paginação ── */}
                {!loading && dados.total > 0 && (
                  <div className="aud-pagination" style={{ padding: '12px 16px' }}>
                    <span>
                      {((pagina - 1) * POR_PAGINA) + 1}–{Math.min(pagina * POR_PAGINA, dados.total)} de {dados.total.toLocaleString('pt-BR')} registros
                    </span>
                    <div className="aud-pagination-btns">
                      <button className="aud-page-btn" disabled={pagina === 1} onClick={() => irPara(1)}>
                        <i className="fa-solid fa-angles-left" />
                      </button>
                      <button className="aud-page-btn" disabled={pagina === 1} onClick={() => irPara(pagina - 1)}>
                        <i className="fa-solid fa-angle-left" />
                      </button>
                      {paginasVisiveis().map(p => (
                        <button key={p} className={`aud-page-btn${p === pagina ? ' active' : ''}`} onClick={() => irPara(p)}>
                          {p}
                        </button>
                      ))}
                      <button className="aud-page-btn" disabled={pagina === dados.paginas} onClick={() => irPara(pagina + 1)}>
                        <i className="fa-solid fa-angle-right" />
                      </button>
                      <button className="aud-page-btn" disabled={pagina === dados.paginas} onClick={() => irPara(dados.paginas)}>
                        <i className="fa-solid fa-angles-right" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
