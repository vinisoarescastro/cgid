import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/workspace.css'
import logoSidebarFull from '../assets/logo-sidebar-full.png'
import logoSidebarIcon from '../assets/logo-sidebar-icon.png'
import Avatar from '../components/Avatar'
import VisualizadorRelatorio from '../components/VisualizadorRelatorio'

const API = 'http://localhost:8000'

const PERFIL_LABEL = {
  super_administrador: 'Super Administrador',
  administrador: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador',
  visitante: 'Visitante',
}

const ADMIN_PERFIS = ['super_administrador', 'administrador']

function WsIcone({ icone, cor, size = 14 }) {
  const c = cor || '#2563eb'
  const bg = `${c}18`
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
      background: bg, color: c,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size,
    }}>
      {icone?.startsWith('fa-')
        ? <i className={`fa-solid ${icone}`} />
        : icone
          ? <span>{icone}</span>
          : <i className="fa-solid fa-building-columns" />
      }
    </div>
  )
}

export default function FavoritosPage() {
  const navigate   = useNavigate()
  const [expanded, setExpanded] = useState(() => sessionStorage.getItem('sidebar_expanded') === '1')
  const user    = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)

  const [favoritos, setFavoritos]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [busca, setBusca]                 = useState('')
  const [relatorioAberto, setRelatorioAberto] = useState(null)

  function handleLogout() {
    sessionStorage.removeItem('cgid_user')
    navigate('/login')
  }

  useEffect(() => {
    fetch(`${API}/usuarios/${user.id}/favoritos`)
      .then(r => r.json())
      .then(setFavoritos)
      .catch(() => setFavoritos([]))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function removerFavorito(relatorioId) {
    await fetch(`${API}/usuarios/${user.id}/favoritos/${relatorioId}`, { method: 'DELETE' })
    setFavoritos(prev => prev.filter(f => f.relatorio_id !== relatorioId))
  }

  const filtrados = favoritos.filter(f =>
    f.relatorio_nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.workspace_nome.toLowerCase().includes(busca.toLowerCase())
  )

  // agrupa por workspace para exibir seções
  const porWorkspace = filtrados.reduce((acc, f) => {
    if (!acc[f.workspace_id]) acc[f.workspace_id] = { nome: f.workspace_nome, icone: f.workspace_icone, cor: f.workspace_cor, itens: [] }
    acc[f.workspace_id].itens.push(f)
    return acc
  }, {})

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
          <div className="sb-link active">
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
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Favoritos</span>
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
                <div className="ph-title">Favoritos</div>
                <div className="ph-sub">
                  {favoritos.length > 0
                    ? `${favoritos.length} relatório(s) favoritado(s)`
                    : 'Seus relatórios favoritos aparecem aqui'}
                </div>
              </div>
            </div>

            {/* Busca */}
            {favoritos.length > 0 && (
              <div className="ws-toolbar">
                <div className="ws-search-wrap">
                  <i className="fa-solid fa-magnifying-glass" />
                  <input
                    className="ws-search"
                    placeholder="Buscar por relatório ou workspace..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                  />
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                Carregando favoritos...
              </div>
            ) : favoritos.length === 0 ? (
              <div className="ws-empty">
                <i className="fa-regular fa-star" style={{ fontSize: 40, color: 'var(--gray-200)' }} />
                <div className="ws-empty-title">Nenhum favorito ainda</div>
                <div className="ws-empty-sub">
                  Clique na estrela ao lado de um relatório no Workspace para adicioná-lo aqui.
                </div>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/workspaces')}>
                  <i className="fa-solid fa-building-columns" /> Ir para Workspaces
                </button>
              </div>
            ) : filtrados.length === 0 ? (
              <div className="ws-empty">
                <i className="fa-solid fa-magnifying-glass" />
                <div className="ws-empty-title">Nenhum resultado</div>
                <div className="ws-empty-sub">Tente outro termo de busca.</div>
              </div>
            ) : (
              Object.values(porWorkspace).map(ws => (
                <div key={ws.nome} style={{ marginBottom: 24 }}>
                  {/* Cabeçalho do workspace */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <WsIcone icone={ws.icone} cor={ws.cor} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>{ws.nome}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>· {ws.itens.length} relatório(s)</span>
                  </div>

                  <div className="card">
                    <div className="card-bd" style={{ padding: 0 }}>
                      <div className="ws-report-list">
                        {ws.itens.map(f => (
                          <div className="ws-report-row" key={f.relatorio_id}>
                            <div className="ws-report-icon">
                              <i className="fa-solid fa-chart-bar" />
                            </div>
                            <div className="ws-report-info">
                              <div className="ws-report-name">{f.relatorio_nome}</div>
                              <div className="ws-report-cat" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="fa-solid fa-building-columns" style={{ fontSize: 10 }} />
                                {f.workspace_nome}
                              </div>
                            </div>
                            <div className="ws-report-actions">
                              <button
                                className="btn btn-ghost btn-sm"
                                title="Remover dos favoritos"
                                style={{ color: 'var(--brand-500)' }}
                                onClick={() => removerFavorito(f.relatorio_id)}
                              >
                                <i className="fa-solid fa-star" />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                title={f.id_relatorio_pbi ? 'Visualizar relatório' : 'Sem link configurado'}
                                disabled={!f.id_relatorio_pbi}
                                onClick={() => f.id_relatorio_pbi && setRelatorioAberto(f)}
                                style={!f.id_relatorio_pbi ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                              >
                                <i className="fa-solid fa-arrow-up-right-from-square" /> Abrir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

          </div>
        </div>
      </div>

      {relatorioAberto && (
        <VisualizadorRelatorio
          relatorio={{ id: relatorioAberto.relatorio_id, nome: relatorioAberto.relatorio_nome, id_relatorio_pbi: relatorioAberto.id_relatorio_pbi }}
          onClose={() => setRelatorioAberto(null)}
        />
      )}
    </div>
  )
}
