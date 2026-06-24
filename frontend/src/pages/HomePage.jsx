import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from 'recharts'
import '../styles/home.css'
import '../styles/workspace.css'
import Avatar from '../components/Avatar'
import Sidebar from '../components/Sidebar'
import TopbarExpediente from '../components/TopbarExpediente'
import { logout } from '../utils/api'

const API = 'http://localhost:8000'

const PERFIL_LABEL = {
  master:        'Master',
  administrador: 'Administrador',
  coordenador:   'Coordenador',
  colaborador:   'Colaborador',
  convidado:     'Convidado',
}

const ADMIN_PERFIS = ['master', 'administrador']

export default function HomePage() {
  const navigate = useNavigate()
const user = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)

  const [kpis, setKpis] = useState(null)
  const [events, setEvents] = useState([])
  const [workspaces, setWorkspaces] = useState([])

  const [acessosPorDia, setAcessosPorDia] = useState([])
  const [topRelatorios, setTopRelatorios] = useState([])
  const [periodoTop, setPeriodoTop] = useState('semanal')
  const [dataTop, setDataTop] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodo, setPeriodo] = useState('semanal')
  const [dataDiario, setDataDiario] = useState(() => new Date().toISOString().slice(0, 10))
  // estado para usuário não-admin
  const [minhaHome, setMinhaHome] = useState(null)
  const [wsExpandido, setWsExpandido] = useState({})

  useEffect(() => {
    if (isAdmin) {
      fetch(`${API}/dashboard/kpis`)
        .then(r => r.json()).then(setKpis).catch(console.error)
      fetch(`${API}/dashboard/eventos`)
        .then(r => r.json()).then(setEvents).catch(console.error)
      fetch(`${API}/dashboard/workspaces`)
        .then(r => r.json()).then(setWorkspaces).catch(console.error)
    } else {
      fetch(`${API}/usuarios/${user.id}/minha-home`, {
        headers: { 'X-Usuario-Id': user.id },
      }).then(r => r.json()).then(data => {
        setMinhaHome(data)
        if (data.length > 0) setWsExpandido({ [data[0].id]: true })
      }).catch(console.error)
    }
  }, [isAdmin, user.id])

  useEffect(() => {
    if (!isAdmin) return
    const params = new URLSearchParams({ periodo })
    if (periodo === 'diario') params.set('data', dataDiario)
    fetch(`${API}/dashboard/acessos-por-dia?${params}`)
      .then(r => r.json()).then(setAcessosPorDia).catch(console.error)
  }, [isAdmin, periodo, dataDiario])

  useEffect(() => {
    if (!isAdmin) return
    const params = new URLSearchParams({ periodo: periodoTop })
    if (periodoTop === 'diario') params.set('data', dataTop)
    fetch(`${API}/dashboard/top-relatorios?${params}`)
      .then(r => r.json()).then(setTopRelatorios).catch(console.error)
  }, [isAdmin, periodoTop, dataTop])

  function handleLogout() { logout(navigate) }

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <Sidebar user={user} active="home" />

      {/* ── App Body ── */}
      <div className="app-body">

        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Home</span>
          </div>

          <TopbarExpediente />

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

            {/* Linha + Rosca lado a lado */}
            <div className="two-col" style={{ marginBottom: 16, gridTemplateColumns: '5fr 3fr' }}>

              {/* Acessos ao longo do tempo */}
              <div className="card">
                <div className="card-hd">
                  <div>
                    <div className="card-title">Acessos ao longo do tempo</div>
                    <div className="card-sub">
                      {periodo === 'diario' ? `Por hora · ${dataDiario.split('-').reverse().join('/')}` : periodo === 'semanal' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {periodo === 'diario' && (
                      <input
                        type="date"
                        value={dataDiario}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={e => setDataDiario(e.target.value)}
                        style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--gray-200)', color: 'var(--gray-600)', outline: 'none' }}
                      />
                    )}
                    {['diario', 'semanal', 'mensal'].map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriodo(p)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid',
                          background: periodo === p ? 'var(--brand-500)' : 'transparent',
                          color: periodo === p ? '#fff' : 'var(--gray-500)',
                          borderColor: periodo === p ? 'var(--brand-500)' : 'var(--gray-200)',
                        }}
                      >
                        {p === 'diario' ? 'Diário' : p === 'semanal' ? 'Semanal' : 'Mensal'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card-bd" style={{ paddingTop: 4 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={acessosPorDia} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradLogins" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#475569" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#475569" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradNegados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-400)' }} tickLine={false} axisLine={false} width={28} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: 12, padding: '6px 12px' }}
                        formatter={(val, name) => [val, name === 'logins' ? 'Logins' : 'Acessos negados']}
                      />
                      <Legend formatter={name => name === 'logins' ? 'Logins' : 'Acessos negados'} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="logins" stroke="#475569" strokeWidth={2} fill="url(#gradLogins)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                      <Area type="monotone" dataKey="negados" stroke="#ef4444" strokeWidth={2} fill="url(#gradNegados)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Distribuição por Workspace */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="card-hd">
                  <div>
                    <div className="card-title">Distribuição por Workspace</div>
                    <div className="card-sub">Relatórios publicados por workspace</div>
                  </div>
                </div>
                <div className="card-bd" style={{ paddingTop: 4, flex: 1, minHeight: 0 }}>
                  {(() => {
                    const dados = workspaces
                      .filter(w => w.publicados > 0)
                      .sort((a, b) => b.publicados - a.publicados)

                    if (dados.length === 0) return null
                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={dados}
                          layout="vertical"
                          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--gray-100)" />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: 'var(--gray-500)' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="nome"
                            width={120}
                            tick={{ fontSize: 12, fill: 'var(--gray-700)' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={name => name.length > 16 ? name.slice(0, 15) + '…' : name}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: '1px solid var(--gray-100)', fontSize: 12, padding: '6px 10px' }}
                            formatter={(val, name) => [`${val} relatório${val !== 1 ? 's' : ''}`, name]}
                            cursor={{ fill: 'var(--gray-50)' }}
                          />
                          <Bar dataKey="publicados" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                            {dados.map((ws, i) => (
                              <Cell key={ws.nome} fill={ws.cor || `hsl(${i * 47}, 60%, 50%)`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* Eventos Recentes + Top Relatórios */}
            <div className="two-col" style={{ marginBottom: 16 }}>

              <div className="card">
                <div className="card-hd">
                  <div>
                    <div className="card-title">Eventos Recentes</div>
                    <div className="card-sub">Últimas atividades no portal</div>
                  </div>
                  {user.perfil === 'master' && (
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
                    <div className="card-title">Top Relatórios Acessados</div>
                    <div className="card-sub">
                      {periodoTop === 'diario' ? `Por dia · ${dataTop.split('-').reverse().join('/')}` : periodoTop === 'semanal' ? 'Últimos 7 dias' : 'Últimos 30 dias'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {periodoTop === 'diario' && (
                      <input type="date" value={dataTop} max={new Date().toISOString().slice(0, 10)}
                        onChange={e => setDataTop(e.target.value)}
                        style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--gray-200)', color: 'var(--gray-600)', outline: 'none' }}
                      />
                    )}
                    {['diario', 'semanal', 'mensal'].map(p => (
                      <button key={p} onClick={() => setPeriodoTop(p)} style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid',
                        background: periodoTop === p ? 'var(--brand-500)' : 'transparent',
                        color: periodoTop === p ? '#fff' : 'var(--gray-500)',
                        borderColor: periodoTop === p ? 'var(--brand-500)' : 'var(--gray-200)',
                      }}>
                        {p === 'diario' ? 'Diário' : p === 'semanal' ? 'Semanal' : 'Mensal'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card-bd" style={{ padding: '4px 0' }}>
                  {topRelatorios.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-300)' }}>
                      <i className="fa-solid fa-chart-bar" style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
                      <div style={{ fontSize: 13 }}>Nenhum acesso registrado ainda</div>
                    </div>
                  ) : (() => {
                    const max = topRelatorios[0]?.acessos || 1
                    return topRelatorios.map((r, i) => {
                      const cor = r.cor || 'var(--brand-500)'
                      const pct = Math.round((r.acessos / max) * 100)
                      return (
                        <div key={r.nome} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', overflow: 'hidden' }}>
                          {/* barra de fundo proporcional */}
                          <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: cor, opacity: 0.10, transition: 'width 0.5s ease', pointerEvents: 'none' }} />
                          {/* rank */}
                          <span style={{ fontSize: 13, fontWeight: 800, color: cor, width: 18, flexShrink: 0, textAlign: 'center', opacity: 0.9 }}>
                            {i + 1}
                          </span>
                          {/* nome */}
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--gray-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.nome}
                          </span>
                          {/* pill de contagem */}
                          <span style={{
                            flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 8px',
                            borderRadius: 99, background: cor + '1a', color: cor,
                          }}>
                            {r.acessos}×
                          </span>
                        </div>
                      )
                    })
                  })()}
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
