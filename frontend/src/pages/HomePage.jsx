import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
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

const ADMIN_PERFIS = ['super_administrador', 'administrador']

export default function HomePage() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const user = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)

  const [kpis, setKpis] = useState(null)
  const [events, setEvents] = useState([])
  const [workspaces, setWorkspaces] = useState([])

  useEffect(() => {
    fetch(`${API}/dashboard/kpis`)
      .then(r => r.json()).then(setKpis).catch(console.error)
    fetch(`${API}/dashboard/eventos`)
      .then(r => r.json()).then(setEvents).catch(console.error)
    fetch(`${API}/dashboard/workspaces`)
      .then(r => r.json()).then(setWorkspaces).catch(console.error)
  }, [])

  // calcula pct relativo ao maior valor para as barras
  const maxReports = Math.max(...workspaces.map(w => w.reports), 1)

  function handleLogout() {
    sessionStorage.removeItem('cgid_user')
    navigate('/login')
  }

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className={`sidebar${expanded ? ' expanded' : ''}`}>
        <div className="sb-header">
          {expanded
            ? <img src={logoSidebarFull} alt="Brasil Terrenos" className="sb-logo-full" />
            : <img src={logoSidebarIcon} alt="Brasil Terrenos" className="sb-logo-icon-img" />
          }
          <button
            className="sb-toggle"
            onClick={() => setExpanded(v => !v)}
            title={expanded ? 'Retrair menu' : 'Expandir menu'}
          >
            <i className={`fa-solid ${expanded ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
          </button>
        </div>

        <nav className="sb-nav">
          <div className="sb-link active">
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
          <div className="sb-link">
            <div className="sb-icon"><i className="fa-solid fa-bookmark" /></div>
            <span className="sb-label">Favoritos</span>
          </div>
          <div className="sb-link">
            <div className="sb-icon"><i className="fa-solid fa-gear" /></div>
            <span className="sb-label">Configurações</span>
          </div>
        </nav>

        <div className="sb-footer">
          <div className="sb-user">
            <Avatar user={user} size={36} radius={10} />
            <div className="sb-user-info">
              <div className="sb-user-name">{user.email}</div>
              <div className="sb-user-role">{PERFIL_LABEL[user.perfil] ?? user.perfil}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── App Body ── */}
      <div className="app-body">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Home</span>
          </div>
          <div className="topbar-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input type="text" placeholder="Buscar..." />
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn" title="Notificações">
              <i className="fa-solid fa-bell" />
              <span className="topbar-notif" />
            </button>
            <button className="topbar-btn" title="Sair" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket" />
            </button>
            <Avatar user={user} size={34} radius={10} />
          </div>
        </header>

        {/* Content */}
        <div className="content-area">
          <div className="page-content">

            <div className="ph">
              <div>
                <div className="ph-title">Home</div>
                <div className="ph-sub">Visão geral do portal e dos acessos Power BI</div>
              </div>
            </div>

            {!isAdmin && (
              <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--gray-500)' }}>
                <i className="fa-solid fa-chart-pie" style={{ fontSize: 40, marginBottom: 12, color: 'var(--brand-400)' }} />
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Bem-vindo ao portal CGID</div>
                <div style={{ fontSize: 14 }}>Utilize o menu lateral para acessar os recursos disponíveis para o seu perfil.</div>
              </div>
            )}

            {/* Dashboard — somente admins */}
            {isAdmin && (<>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-card-top">
                  <div>
                    <div className="stat-val">{kpis?.usuarios_ativos ?? '—'}</div>
                    <div className="stat-label">Usuários ativos</div>
                  </div>
                  <div className="stat-icon-wrap green"><i className="fa-solid fa-users" /></div>
                </div>
                <span className="stat-trend up"><i className="fa-solid fa-arrow-up" /> atualizado agora</span>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div>
                    <div className="stat-val">{kpis?.usuarios_bloqueados ?? '—'}</div>
                    <div className="stat-label">Usuários bloqueados</div>
                  </div>
                  <div className="stat-icon-wrap amber"><i className="fa-solid fa-user-lock" /></div>
                </div>
                <span className="stat-trend down"><i className="fa-solid fa-arrow-up" /> verificar</span>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div>
                    <div className="stat-val">{kpis?.acessos_negados_hoje ?? '—'}</div>
                    <div className="stat-label">Acessos negados hoje</div>
                  </div>
                  <div className="stat-icon-wrap red"><i className="fa-solid fa-ban" /></div>
                </div>
                <span className="stat-trend down"><i className="fa-solid fa-clock" /> fora expediente</span>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div>
                    <div className="stat-val">{kpis?.workspaces_ativos ?? '—'}</div>
                    <div className="stat-label">Workspaces ativos</div>
                  </div>
                  <div className="stat-icon-wrap blue"><i className="fa-solid fa-building" /></div>
                </div>
                <span className="stat-trend neutral"><i className="fa-solid fa-check" /> 100% online</span>
              </div>
            </div>

            {/* Eventos + Barras */}
            <div className="two-col" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="card-hd">
                  <div>
                    <div className="card-title">Eventos Recentes</div>
                    <div className="card-sub">Últimas atividades no portal</div>
                  </div>
                  <button className="btn btn-ghost btn-sm">
                    Ver todos <i className="fa-solid fa-arrow-right" />
                  </button>
                </div>
                <div className="card-bd" style={{ padding: '8px 12px' }}>
                  <div className="activity-list">
                    {events.map((ev, i) => (
                      <div className="activity-item" key={i}>
                        <div className="activity-icon" style={{ background: ev.color }}>
                          <i className={`fa-solid ${ev.icon}`} style={{ color: ev.iconColor }} />
                        </div>
                        <div className="activity-info">
                          <div className="activity-title">{ev.title}</div>
                          <div className="activity-sub">{ev.sub}</div>
                        </div>
                        <div className="activity-time">{ev.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-hd">
                  <div>
                    <div className="card-title">Distribuição por Workspace</div>
                    <div className="card-sub">Usuários por departamento</div>
                  </div>
                </div>
                <div className="card-bd">
                  {workspaces.map(b => (
                    <div className="bar-row" key={b.nome}>
                      <div className="bar-meta">
                        <span className="bar-name">{b.nome}</span>
                        <span className="bar-count">{b.reports}</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.round((b.reports / maxReports) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="fa-solid fa-clock" style={{ color: 'var(--brand-500)', fontSize: 14 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-800)' }}>Expediente ativo</div>
                        <div style={{ fontSize: 12, color: 'var(--brand-600)' }}>08:00 — 18:00 · Acesso normal</div>
                      </div>
                    </div>
                    <span className="status-pill status-online">
                      <span className="status-dot green" />Online
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabela de Workspaces */}
            <div className="card">
              <div className="card-hd">
                <div>
                  <div className="card-title">Acessos Power BI por Workspace</div>
                  <div className="card-sub">Controle de permissões de relatórios</div>
                </div>
                <span className="pbi-badge"><i className="fa-solid fa-chart-pie" /> Power BI Embedded</span>
              </div>
              <div className="card-bd" style={{ padding: 0 }}>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Workspace</th>
                        <th>Relatórios</th>
                        <th>Usuários com acesso total</th>
                        <th>Usuários com acesso parcial</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaces.map(ws => (
                        <tr key={ws.nome}>
                          <td className="td-bold">{ws.nome}</td>
                          <td>{ws.reports}</td>
                          <td>{ws.totalAccess}</td>
                          <td>{ws.partialAccess}</td>
                          <td><span className="badge badge-green"><i className="fa-solid fa-circle-check" />Ativo</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            </>)}

          </div>
        </div>
      </div>
    </div>
  )
}
