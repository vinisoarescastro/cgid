import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/workspace.css'
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
  const [expanded, setExpanded] = useState(() => sessionStorage.getItem('sidebar_expanded') === '1')
  const user = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)

  const [kpis, setKpis] = useState(null)
  const [events, setEvents] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [expediente, setExpediente] = useState(null)

  // estado para usuário não-admin
  const [minhaHome, setMinhaHome] = useState(null)
  const [wsExpandido, setWsExpandido] = useState({})

  useEffect(() => {
    if (isAdmin) {
      fetch(`${API}/dashboard/expediente`)
        .then(r => r.json()).then(setExpediente).catch(console.error)
      fetch(`${API}/dashboard/kpis`)
        .then(r => r.json()).then(setKpis).catch(console.error)
      fetch(`${API}/dashboard/eventos`)
        .then(r => r.json()).then(setEvents).catch(console.error)
      fetch(`${API}/dashboard/workspaces`)
        .then(r => r.json()).then(setWorkspaces).catch(console.error)
    } else {
      fetch(`${API}/usuarios/${user.id}/expediente`, {
        headers: { 'X-Usuario-Id': user.id },
      }).then(r => r.json()).then(setExpediente).catch(console.error)

      fetch(`${API}/usuarios/${user.id}/minha-home`, {
        headers: { 'X-Usuario-Id': user.id },
      }).then(r => r.json()).then(data => {
        setMinhaHome(data)
        // expande o primeiro workspace por padrão
        if (data.length > 0) setWsExpandido({ [data[0].id]: true })
      }).catch(console.error)
    }
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
            onClick={() => setExpanded(v => { sessionStorage.setItem('sidebar_expanded', v ? '' : '1'); return !v })}
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
          <div className="sb-link" onClick={() => navigate('/favoritos')}>
            <div className="sb-icon"><i className="fa-solid fa-star" /></div>
            <span className="sb-label">Favoritos</span>
          </div>
          {user.perfil === 'super_administrador' && (
            <div className="sb-link" onClick={() => navigate('/auditoria')}>
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

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Home</span>
          </div>

          {expediente && expediente.configurado && (() => {
            const ok = expediente.dentro_expediente
            const diaInativo = expediente.dia_inativo
            const excecaoDia = expediente.excecao_ativa && !expediente.hora_inicio
            const excecaoHora = expediente.excecao_ativa && !!expediente.hora_inicio

            let label, horario, stateClass
            if (isAdmin) {
              label = ok ? 'Expediente' : 'Fora do expediente'
              horario = expediente.hora_inicio ? `${expediente.hora_inicio} – ${expediente.hora_fim}` : null
              stateClass = ok ? 'exp-ok' : 'exp-neutral'
            } else if (diaInativo) {
              label = 'Acesso bloqueado'; stateClass = 'exp-off'
            } else if (excecaoDia) {
              label = 'Acesso especial'; stateClass = 'exp-warn'
            } else if (ok) {
              label = 'Expediente'
              horario = excecaoHora ? expediente.janela_excecao : `${expediente.hora_inicio} – ${expediente.hora_fim}`
              stateClass = 'exp-ok'
            } else {
              label = 'Fora do expediente'
              horario = `${expediente.hora_inicio} – ${expediente.hora_fim}`
              stateClass = 'exp-off'
            }

            return (
              <div className={`topbar-exp ${stateClass}`}>
                <span className="topbar-exp-dot" />
                <span className="topbar-exp-label">{label}</span>
                {horario && <span className="topbar-exp-divider" />}
                {horario && <span className="topbar-exp-horario">{horario}</span>}
                {!isAdmin && expediente.excecao_ativa && (
                  <span className="topbar-exp-badge">
                    <i className="fa-solid fa-shield-halved" />
                    {excecaoDia ? 'Dia bloqueado' : 'Exceção'}
                  </span>
                )}
              </div>
            )
          })()}

          <div className="topbar-actions">
            <button className="topbar-btn topbar-btn-danger" title="Sair" onClick={handleLogout}>
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

            {!isAdmin && (<>

              {/* ── Boas-vindas ── */}
              <div className="card home-welcome">
                <Avatar user={user} size={48} radius={13} />
                <div className="home-welcome-info">
                  <div className="home-welcome-name">Olá, {user.nome?.split(' ')[0] || user.email} 👋</div>
                  <div className="home-welcome-role">{PERFIL_LABEL[user.perfil] ?? user.perfil} · {user.email}</div>
                </div>
              </div>

              {/* ── Meus workspaces e relatórios ── */}
              <div className="ph" style={{ marginBottom: 12 }}>
                <div>
                  <div className="ph-title">Meus acessos</div>
                  <div className="ph-sub">Workspaces e relatórios disponíveis para você</div>
                </div>
              </div>

              {minhaHome === null && (
                <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 22 }} />
                </div>
              )}

              {minhaHome?.length === 0 && (
                <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <i className="fa-solid fa-folder-open" style={{ fontSize: 36, marginBottom: 12, color: 'var(--gray-300)' }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum acesso configurado</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Solicite ao administrador para liberar seus acessos.</div>
                </div>
              )}

              {minhaHome?.length > 0 && (
                <div className="home-ws-list">
                  {minhaHome.map(ws => (
                    <div className="card home-ws-card" key={ws.id}>
                      <div
                        className="home-ws-header"
                        onClick={() => setWsExpandido(v => ({ ...v, [ws.id]: !v[ws.id] }))}
                      >
                        <div className="home-ws-icon" style={{ background: ws.cor || 'var(--brand-500)' }}>
                          <i className={`fa-solid ${ws.icone || 'fa-building-columns'}`} />
                        </div>
                        <div className="home-ws-meta">
                          <div className="home-ws-nome">{ws.nome}</div>
                          <div className="home-ws-sub">
                            {ws.relatorios.length} {ws.relatorios.length !== 1 ? 'relatórios disponíveis' : 'relatório disponível'}
                          </div>
                        </div>
                        <i className={`fa-solid fa-chevron-${wsExpandido[ws.id] ? 'up' : 'down'} home-ws-chevron`} />
                      </div>

                      {wsExpandido[ws.id] && (
                        <div className="home-ws-relatorios">
                          {ws.relatorios.length === 0 ? (
                            <div className="home-ws-empty">Nenhum relatório publicado neste workspace.</div>
                          ) : ws.relatorios.map(r => (
                            <div key={r.id} className="ws-report-row" style={{ cursor: 'default' }}>
                              <div className="ws-report-icon">
                                <i className="fa-solid fa-chart-bar" />
                              </div>
                              <div className="ws-report-info">
                                <div className="ws-report-name">{r.nome}</div>
                                <div className="ws-report-cat">{r.categoria ?? 'Sem categoria'}</div>
                              </div>
                              <div className="ws-report-actions">
                                <button
                                  className="btn btn-ghost btn-sm"
                                  title={r.id_relatorio_pbi ? 'Visualizar relatório' : 'Sem link configurado'}
                                  disabled={!r.id_relatorio_pbi}
                                  onClick={() => r.id_relatorio_pbi && navigate(`/workspaces?ws=${ws.id}&rel=${r.id}`)}
                                  style={!r.id_relatorio_pbi ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square" /> Abrir
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </>)}

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
                <span className="stat-trend up">
                  <i className="fa-solid fa-arrow-right-to-bracket" />
                  {kpis?.logins_hoje ?? 0} login(s) hoje
                </span>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div>
                    <div className="stat-val">{kpis?.usuarios_bloqueados ?? '—'}</div>
                    <div className="stat-label">Usuários bloqueados</div>
                  </div>
                  <div className="stat-icon-wrap amber"><i className="fa-solid fa-user-lock" /></div>
                </div>
                <span className="stat-trend down">
                  <i className="fa-solid fa-arrow-up" />
                  {kpis?.bloqueados_hoje > 0 ? `+${kpis.bloqueados_hoje} bloqueado(s) hoje` : 'nenhum bloqueado hoje'}
                </span>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div>
                    <div className="stat-val">{kpis?.acessos_negados_hoje ?? '—'}</div>
                    <div className="stat-label">Acessos negados hoje</div>
                  </div>
                  <div className="stat-icon-wrap red"><i className="fa-solid fa-ban" /></div>
                </div>
                <span className="stat-trend down">
                  <i className="fa-solid fa-arrow-trend-up" />
                  {kpis?.media_semanal_negados != null
                    ? kpis.acessos_negados_hoje > kpis.media_semanal_negados
                      ? `+${Math.round(((kpis.acessos_negados_hoje - kpis.media_semanal_negados) / (kpis.media_semanal_negados || 1)) * 100)}% vs média semanal`
                      : kpis.acessos_negados_hoje < kpis.media_semanal_negados
                        ? `-${Math.round(((kpis.media_semanal_negados - kpis.acessos_negados_hoje) / (kpis.media_semanal_negados || 1)) * 100)}% vs média semanal`
                        : 'igual à média semanal'
                    : 'senha incorreta ou fora do expediente'}
                </span>
              </div>
              <div className="stat-card">
                <div className="stat-card-top">
                  <div>
                    <div className="stat-val">{kpis?.workspaces_ativos ?? '—'}</div>
                    <div className="stat-label">Workspaces ativos</div>
                  </div>
                  <div className="stat-icon-wrap blue"><i className="fa-solid fa-building" /></div>
                </div>
                <span className="stat-trend neutral">
                  <i className="fa-solid fa-check" />
                  {kpis?.workspaces_total > 0
                    ? `${Math.round((kpis.workspaces_ativos / kpis.workspaces_total) * 100)}% ativos (${kpis.workspaces_ativos} de ${kpis.workspaces_total})`
                    : '—'}
                </span>
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
                  {user.perfil === 'super_administrador' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/auditoria')}>
                      Ver todos <i className="fa-solid fa-arrow-right" />
                    </button>
                  )}
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
                    <div className="card-sub">Relatórios publicados por workspace</div>
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
                        <div className="bar-fill" style={{ width: `${Math.round((b.reports / maxReports) * 100)}%`, background: b.cor ?? undefined }} />
                      </div>
                    </div>
                  ))}
                  {expediente && (
                    <div style={{
                      marginTop: 16, padding: '12px 16px', borderRadius: 'var(--r-md)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: expediente.dentro_expediente ? 'var(--brand-50)' : '#fef2f2',
                      border: `1px solid ${expediente.dentro_expediente ? 'var(--brand-100)' : '#fecaca'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <i className="fa-solid fa-clock" style={{ fontSize: 14, color: expediente.dentro_expediente ? 'var(--brand-500)' : '#ef4444' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: expediente.dentro_expediente ? 'var(--brand-800)' : '#991b1b' }}>
                            {!expediente.configurado
                              ? 'Expediente não configurado'
                              : expediente.dentro_expediente
                                ? 'Dentro do expediente'
                                : 'Fora do expediente'}
                          </div>
                          <div style={{ fontSize: 12, color: expediente.dentro_expediente ? 'var(--brand-600)' : '#b91c1c' }}>
                            {expediente.configurado
                              ? `${expediente.hora_inicio} — ${expediente.hora_fim} · Agora: ${expediente.hora_atual}`
                              : `Hora atual: ${expediente.hora_atual}`}
                          </div>
                        </div>
                      </div>
                      {expediente.configurado && (
                        <span className={`status-pill ${expediente.dentro_expediente ? 'status-online' : 'status-offline'}`}>
                          <span className={`status-dot ${expediente.dentro_expediente ? 'green' : 'red'}`} />
                          {expediente.dentro_expediente ? 'Online' : expediente.bloquear_fora ? 'Bloqueado' : 'Fora do horário'}
                        </span>
                      )}
                    </div>
                  )}
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
