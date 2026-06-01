import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/workspace.css'
import logoSidebarFull from '../assets/logo-sidebar-full.png'
import logoSidebarIcon from '../assets/logo-sidebar-icon.png'
import Avatar from '../components/Avatar'
import IconPicker from '../components/IconPicker'

const API = 'http://localhost:8000'

const PERFIL_LABEL = {
  super_administrador: 'Super Administrador',
  administrador: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador',
  visitante: 'Visitante',
}

const ADMIN_PERFIS = ['super_administrador', 'administrador']

const STATUS_RELATORIO_LABEL = {
  publicado: 'Publicado',
  rascunho: 'Rascunho',
}

const COR_PADRAO = '#2563eb'

function wsIconStyle(ws) {
  const cor = ws.cor || COR_PADRAO
  return { background: `${cor}18`, color: cor }
}

function WsIcone({ icone, size = 18, fallback = 'fa-building-columns' }) {
  if (!icone) return <i className={`fa-solid ${fallback}`} style={{ fontSize: size }} />
  if (icone.startsWith('fa-')) return <i className={`fa-solid ${icone}`} style={{ fontSize: size }} />
  return <span style={{ fontSize: size, lineHeight: 1 }}>{icone}</span>
}

function nivelBadge(nivel) {
  if (nivel === 'total')             return { cls: 'ws-nivel-total',   label: 'Acesso total' }
  if (nivel === 'apenas_relatorios') return { cls: 'ws-nivel-parcial', label: 'Relatórios específicos' }
  return { cls: 'ws-nivel-nenhum', label: 'Sem acesso' }
}

// ─── Modal adicionar usuário ao workspace ────────────────────────────────────
function ModalAdicionarUsuario({ workspaceId, usuariosJaVinculados, onClose, onAdd }) {
  const [todos, setTodos]       = useState([])
  const [busca, setBusca]       = useState('')
  const [selecionado, setSel]   = useState(null)
  const [nivel, setNivel]       = useState('total')
  const [loading, setLoading]   = useState(false)
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    fetch(`${API}/usuarios?status=ativo`)
      .then(r => r.json())
      .then(data => {
        const vinculadosIds = new Set(usuariosJaVinculados.map(u => u.usuario_id))
        setTodos(data.filter(u => !vinculadosIds.has(u.id)))
      })
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [])

  const filtrados = todos.filter(u =>
    u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    u.email?.toLowerCase().includes(busca.toLowerCase())
  )

  async function confirmar() {
    if (!selecionado) return
    setLoading(true)
    try {
      const r = await fetch(`${API}/workspaces/${workspaceId}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: selecionado.id, nivel_acesso: nivel }),
      })
      if (!r.ok) throw new Error()
      const novo = await r.json()
      onAdd(novo)
    } catch {
      alert('Erro ao vincular usuário.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-title">Adicionar usuário ao workspace</div>

        <div className="modal-field">
          <label className="modal-label">Buscar usuário</label>
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--gray-300)' }} />
            <input
              className="modal-input"
              style={{ paddingLeft: 30 }}
              autoFocus
              placeholder="Nome ou e-mail..."
              value={busca}
              onChange={e => { setBusca(e.target.value); setSel(null) }}
            />
          </div>
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
          {loadingList ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>
              {todos.length === 0 ? 'Todos os usuários já estão vinculados.' : 'Nenhum usuário encontrado.'}
            </div>
          ) : (
            filtrados.map(u => (
              <div
                key={u.id}
                onClick={() => setSel(u)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', cursor: 'pointer',
                  background: selecionado?.id === u.id ? 'var(--brand-50)' : 'transparent',
                  borderLeft: selecionado?.id === u.id ? '3px solid var(--brand-500)' : '3px solid transparent',
                  transition: 'all var(--t-base)',
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: 'var(--brand-100)', color: 'var(--brand-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {(u.nome || u.email)?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{u.nome || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.email}</div>
                </div>
                {selecionado?.id === u.id && (
                  <i className="fa-solid fa-circle-check" style={{ marginLeft: 'auto', color: 'var(--brand-500)' }} />
                )}
              </div>
            ))
          )}
        </div>

        <div className="modal-field">
          <label className="modal-label">Nível de acesso</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'total', label: 'Acesso total', icon: 'fa-circle-check', cls: 'ws-nivel-total' },
              { value: 'apenas_relatorios', label: 'Relatórios específicos', icon: 'fa-chart-bar', cls: 'ws-nivel-parcial' },
            ].map(op => (
              <button
                key={op.value}
                type="button"
                onClick={() => setNivel(op.value)}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                  border: nivel === op.value ? '2px solid var(--brand-500)' : '1px solid var(--gray-200)',
                  background: nivel === op.value ? 'var(--brand-50)' : 'var(--gray-0)',
                  fontFamily: 'var(--font)', fontSize: 13, fontWeight: nivel === op.value ? 600 : 400,
                  color: nivel === op.value ? 'var(--brand-700)' : 'var(--gray-600)',
                  transition: 'all var(--t-base)', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <i className={`fa-solid ${op.icon}`} />
                {op.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar} disabled={loading || !selecionado}>
            {loading ? 'Adicionando...' : 'Adicionar usuário'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal criar/editar workspace ────────────────────────────────────────────
function ModalWorkspace({ workspace, onClose, onSave }) {
  const editando = !!workspace
  const [form, setForm] = useState({
    nome:             workspace?.nome             ?? '',
    icone:            workspace?.icone            ?? '',
    cor:              workspace?.cor              ?? COR_PADRAO,
    descricao:        workspace?.descricao        ?? '',
    id_workspace_pbi: workspace?.id_workspace_pbi ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function salvar() {
    if (!form.nome.trim()) { setErro('O nome é obrigatório.'); return }
    setLoading(true); setErro('')
    try {
      const url    = editando ? `${API}/workspaces/${workspace.id}` : `${API}/workspaces`
      const method = editando ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome:             form.nome.trim(),
          icone:            form.icone.trim() || null,
          cor:              form.cor || null,
          descricao:        form.descricao.trim() || null,
          id_workspace_pbi: form.id_workspace_pbi.trim() || null,
        }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail || 'Erro ao salvar.') }
      const salvo = await r.json()
      onSave(salvo, editando)
    } catch (e) {
      setErro(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-title">{editando ? 'Editar Workspace' : 'Novo Workspace'}</div>

        <div className="modal-field">
          <label className="modal-label">Nome *</label>
          <input className="modal-input" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Controladoria" />
        </div>
        <div className="modal-field" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="modal-label">Ícone</label>
            <IconPicker value={form.icone} onChange={v => set('icone', v)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="modal-label">Cor</label>
            <input type="color" value={form.cor} onChange={e => set('cor', e.target.value)}
              style={{ height: 38, width: 52, border: '1px solid var(--gray-200)', borderRadius: 'var(--r-md)', cursor: 'pointer', padding: 3 }} />
          </div>
          {/* Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="modal-label">Preview</label>
            <div style={{
              width: 38, height: 38, borderRadius: 'var(--r-md)',
              background: `${form.cor || '#2563eb'}18`,
              color: form.cor || '#2563eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, border: '1px solid var(--gray-100)',
            }}>
              {form.icone
                ? <i className={`fa-solid ${form.icone}`} />
                : <i className="fa-solid fa-building-columns" style={{ opacity: .3 }} />
              }
            </div>
          </div>
        </div>
        <div className="modal-field">
          <label className="modal-label">ID Workspace Power BI</label>
          <input className="modal-input" value={form.id_workspace_pbi} onChange={e => set('id_workspace_pbi', e.target.value)} placeholder="UUID do workspace no PBI" />
        </div>
        <div className="modal-field">
          <label className="modal-label">Descrição</label>
          <textarea className="modal-textarea" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Descrição opcional..." />
        </div>

        {erro && <div style={{ fontSize: 12, color: 'var(--red-500)', marginBottom: 8 }}>{erro}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={loading}>
            {loading ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar workspace'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const user = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)

  // list state
  const [workspaces, setWorkspaces] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  // detail state
  const [wsAtivo, setWsAtivo] = useState(null)
  const [abaAtiva, setAbaAtiva] = useState('relatorios')
  const [relatorios, setRelatorios] = useState([])
  const [loadingRel, setLoadingRel] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [usuarios, setUsuarios] = useState([])
  const [loadingUsr, setLoadingUsr] = useState(false)

  // modal workspace
  const [modal, setModal] = useState(null) // null | 'criar' | workspace_obj
  // modal adicionar usuário
  const [modalUsuario, setModalUsuario] = useState(false)

  // stats cache (from dashboard)
  const [stats, setStats] = useState({})

  function handleLogout() {
    sessionStorage.removeItem('cgid_user')
    navigate('/login')
  }

  useEffect(() => {
    carregarWorkspaces()
    fetch(`${API}/dashboard/workspaces`)
      .then(r => r.json())
      .then(data => {
        const map = {}
        data.forEach(d => { map[d.nome] = d })
        setStats(map)
      })
      .catch(() => {})
  }, [])

  async function carregarWorkspaces() {
    setLoading(true)
    try {
      let data
      if (isAdmin) {
        const r = await fetch(`${API}/workspaces`)
        data = await r.json()
        // normalize to same shape as acessos
        data = data.map(ws => ({ ...ws, espaco_trabalho_id: ws.id, nivel_acesso: 'total' }))
      } else {
        const r = await fetch(`${API}/usuarios/${user.id}/acessos`)
        data = await r.json()
        data = data.map(a => ({ ...a, id: a.espaco_trabalho_id }))
      }
      setWorkspaces(data)
    } catch {
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }

  async function abrirWorkspace(ws) {
    setWsAtivo(ws)
    setAbaAtiva('relatorios')
    setFiltroStatus('todos')
    setLoadingRel(true)
    setLoadingUsr(true)
    try {
      const [resRel, resUsr] = await Promise.all([
        fetch(`${API}/workspaces/${ws.id}/relatorios`),
        fetch(`${API}/workspaces/${ws.id}/usuarios`),
      ])
      setRelatorios(await resRel.json())
      setUsuarios(await resUsr.json())
    } catch {
      setRelatorios([])
      setUsuarios([])
    } finally {
      setLoadingRel(false)
      setLoadingUsr(false)
    }
  }

  function fecharDetalhe() {
    setWsAtivo(null)
    setRelatorios([])
    setUsuarios([])
  }

  async function arquivarWorkspace(ws) {
    if (!confirm(`Arquivar o workspace "${ws.nome}"? Ele não ficará mais visível para os usuários.`)) return
    await fetch(`${API}/workspaces/${ws.id}/arquivar`, { method: 'PATCH' })
    setWorkspaces(prev => prev.filter(w => w.id !== ws.id))
    if (wsAtivo?.id === ws.id) fecharDetalhe()
  }

  async function alterarNivelUsuario(usuarioId, novoNivel) {
    try {
      const r = await fetch(`${API}/workspaces/${wsAtivo.id}/usuarios/${usuarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel_acesso: novoNivel }),
      })
      if (!r.ok) throw new Error()
      setUsuarios(prev => prev.map(u => u.usuario_id === usuarioId ? { ...u, nivel_acesso: novoNivel } : u))
    } catch {
      alert('Erro ao alterar nível de acesso.')
    }
  }

  async function removerUsuario(usuarioId, nomeUsuario) {
    if (!confirm(`Remover "${nomeUsuario}" deste workspace?`)) return
    try {
      const r = await fetch(`${API}/workspaces/${wsAtivo.id}/usuarios/${usuarioId}`, { method: 'DELETE' })
      if (!r.ok && r.status !== 204) throw new Error()
      setUsuarios(prev => prev.filter(u => u.usuario_id !== usuarioId))
    } catch {
      alert('Erro ao remover usuário.')
    }
  }

  function aoAdicionarUsuario(novoUsuario) {
    setUsuarios(prev => [...prev, novoUsuario].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')))
    setModalUsuario(false)
  }

  function aoSalvarModal(salvo, editando) {
    const normalizado = { ...salvo, espaco_trabalho_id: salvo.id, nivel_acesso: 'total' }
    if (editando) {
      setWorkspaces(prev => prev.map(w => w.id === salvo.id ? normalizado : w))
      if (wsAtivo?.id === salvo.id) setWsAtivo(normalizado)
    } else {
      setWorkspaces(prev => [...prev, normalizado])
    }
    setModal(null)
  }

  const wsFiltrados = workspaces.filter(w =>
    w.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  const relFiltrados = relatorios.filter(r =>
    filtroStatus === 'todos' || r.status === filtroStatus
  )

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className={`sidebar${expanded ? ' expanded' : ''}`}>
        <div className="sb-header">
          {expanded
            ? <img src={logoSidebarFull} alt="Brasil Terrenos" className="sb-logo-full" />
            : <img src={logoSidebarIcon} alt="Brasil Terrenos" className="sb-logo-icon-img" />
          }
          <button className="sb-toggle" onClick={() => setExpanded(v => !v)}
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
          <div className="sb-link active">
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
            {wsAtivo ? (
              <>
                <span className="bc-item" style={{ cursor: 'pointer' }} onClick={fecharDetalhe}>Workspace</span>
                <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
                <span className="bc-current">{wsAtivo.nome}</span>
              </>
            ) : (
              <span className="bc-current">Workspace</span>
            )}
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

            {/* ── Vista de detalhe ── */}
            {wsAtivo ? (
              <>
                <button className="ws-back-btn" onClick={fecharDetalhe}>
                  <i className="fa-solid fa-arrow-left" /> Voltar aos workspaces
                </button>

                <div className="ws-detail-header">
                  <div className="ws-detail-icon" style={wsIconStyle(wsAtivo)}>
                    <WsIcone icone={wsAtivo.icone} size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="ws-detail-title">{wsAtivo.nome}</div>
                    <div className="ws-detail-sub">
                      {stats[wsAtivo.nome]
                        ? `${stats[wsAtivo.nome].reports} relatório(s) · ${stats[wsAtivo.nome].totalAccess + stats[wsAtivo.nome].partialAccess} usuário(s)`
                        : 'Carregando stats...'}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(wsAtivo)}>
                        <i className="fa-solid fa-pen" /> Editar
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }}
                        onClick={() => arquivarWorkspace(wsAtivo)}>
                        <i className="fa-solid fa-box-archive" /> Arquivar
                      </button>
                    </div>
                  )}
                </div>

                {/* ── Tabs ── */}
                <div className="ws-tabs">
                  <button
                    className={`ws-tab${abaAtiva === 'relatorios' ? ' active' : ''}`}
                    onClick={() => setAbaAtiva('relatorios')}
                  >
                    <i className="fa-solid fa-chart-bar" />
                    Relatórios
                    <span className="ws-tab-count">{relatorios.length}</span>
                  </button>
                  <button
                    className={`ws-tab${abaAtiva === 'usuarios' ? ' active' : ''}`}
                    onClick={() => setAbaAtiva('usuarios')}
                  >
                    <i className="fa-solid fa-users" />
                    Usuários vinculados
                    <span className="ws-tab-count">{usuarios.length}</span>
                  </button>
                </div>

                {/* ── Aba: Relatórios ── */}
                {abaAtiva === 'relatorios' && (
                  <div className="card">
                    <div className="card-bd">
                      <div className="ws-reports-toolbar">
                        {['todos', 'publicado', 'rascunho'].map(f => (
                          <button key={f}
                            className={`ws-filter-btn${filtroStatus === f ? ' active' : ''}`}
                            onClick={() => setFiltroStatus(f)}>
                            {f === 'todos' ? 'Todos' : STATUS_RELATORIO_LABEL[f]}
                          </button>
                        ))}
                      </div>

                      {loadingRel ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                          Carregando relatórios...
                        </div>
                      ) : relFiltrados.length === 0 ? (
                        <div className="ws-empty">
                          <i className="fa-solid fa-chart-bar" />
                          <div className="ws-empty-title">Nenhum relatório encontrado</div>
                          <div className="ws-empty-sub">
                            {filtroStatus === 'todos'
                              ? 'Este workspace ainda não possui relatórios cadastrados.'
                              : `Nenhum relatório com status "${STATUS_RELATORIO_LABEL[filtroStatus]}".`}
                          </div>
                        </div>
                      ) : (
                        <div className="ws-report-list">
                          {relFiltrados.map(r => (
                            <div className="ws-report-row" key={r.id}>
                              <div className="ws-report-icon">
                                <i className="fa-solid fa-chart-bar" />
                              </div>
                              <div className="ws-report-info">
                                <div className="ws-report-name">{r.nome}</div>
                                <div className="ws-report-cat">{r.categoria ?? 'Sem categoria'}</div>
                              </div>
                              <div className="ws-report-actions">
                                <span className={`badge ${r.status === 'publicado' ? 'badge-green' : 'badge-gray'}`}>
                                  {STATUS_RELATORIO_LABEL[r.status] ?? r.status}
                                </span>
                                {r.id_relatorio_pbi && (
                                  <button className="btn btn-ghost btn-sm" title="Abrir no Power BI">
                                    <i className="fa-solid fa-arrow-up-right-from-square" /> Abrir
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Aba: Usuários ── */}
                {abaAtiva === 'usuarios' && (
                  <div className="card">
                    {isAdmin && (
                      <div className="card-hd" style={{ borderBottom: '1px solid var(--gray-100)', paddingBottom: 12 }}>
                        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                          {usuarios.length} usuário(s) com acesso a este workspace
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setModalUsuario(true)}>
                          <i className="fa-solid fa-user-plus" /> Adicionar usuário
                        </button>
                      </div>
                    )}
                    <div className="card-bd" style={{ padding: 0 }}>
                      {loadingUsr ? (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                          Carregando usuários...
                        </div>
                      ) : usuarios.length === 0 ? (
                        <div className="ws-empty">
                          <i className="fa-solid fa-users" />
                          <div className="ws-empty-title">Nenhum usuário vinculado</div>
                          <div className="ws-empty-sub">
                            {isAdmin
                              ? 'Clique em "Adicionar usuário" para vincular alguém a este workspace.'
                              : 'Nenhum usuário ativo tem acesso a este workspace.'}
                          </div>
                        </div>
                      ) : (
                        <div className="tbl-wrap">
                          <table className="tbl">
                            <thead>
                              <tr>
                                <th>Usuário</th>
                                <th>E-mail</th>
                                <th>Perfil</th>
                                <th>Nível de acesso</th>
                                {isAdmin && <th style={{ width: 40 }} />}
                              </tr>
                            </thead>
                            <tbody>
                              {usuarios.map(u => (
                                <tr key={u.usuario_id}>
                                  <td className="td-bold">{u.nome || '—'}</td>
                                  <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>{u.email}</td>
                                  <td>
                                    <span className="badge badge-gray">
                                      {PERFIL_LABEL[u.perfil] ?? u.perfil}
                                    </span>
                                  </td>
                                  <td>
                                    {isAdmin ? (
                                      <select
                                        className="ws-acesso-nivel-inline"
                                        value={u.nivel_acesso}
                                        onChange={e => alterarNivelUsuario(u.usuario_id, e.target.value)}
                                      >
                                        <option value="total">Acesso total</option>
                                        <option value="apenas_relatorios">Relatórios específicos</option>
                                      </select>
                                    ) : (
                                      u.nivel_acesso === 'total' ? (
                                        <span className="ws-nivel-badge ws-nivel-total">
                                          <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} />
                                          Acesso total
                                        </span>
                                      ) : (
                                        <span className="ws-nivel-badge ws-nivel-parcial">
                                          <i className="fa-solid fa-chart-bar" style={{ marginRight: 4 }} />
                                          Relatórios específicos
                                        </span>
                                      )
                                    )}
                                  </td>
                                  {isAdmin && (
                                    <td>
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        title="Remover acesso"
                                        style={{ color: 'var(--red-500)', padding: '4px 8px' }}
                                        onClick={() => removerUsuario(u.usuario_id, u.nome || u.email)}
                                      >
                                        <i className="fa-solid fa-user-minus" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* ── Vista de lista ── */
              <>
                <div className="ph">
                  <div>
                    <div className="ph-title">Workspace</div>
                    <div className="ph-sub">
                      {isAdmin
                        ? 'Gerencie todos os workspaces do portal'
                        : 'Workspaces disponíveis para o seu perfil'}
                    </div>
                  </div>
                  {isAdmin && (
                    <button className="btn btn-primary" onClick={() => setModal('criar')}>
                      <i className="fa-solid fa-plus" /> Novo workspace
                    </button>
                  )}
                </div>

                <div className="ws-toolbar">
                  <div className="ws-search-wrap">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                      className="ws-search"
                      placeholder="Buscar workspace..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                    />
                  </div>
                </div>

                {loading ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                    Carregando workspaces...
                  </div>
                ) : wsFiltrados.length === 0 ? (
                  <div className="ws-empty">
                    <i className="fa-solid fa-building-columns" />
                    <div className="ws-empty-title">Nenhum workspace encontrado</div>
                    <div className="ws-empty-sub">
                      {busca ? 'Tente outro termo de busca.' : 'Você ainda não tem acesso a nenhum workspace.'}
                    </div>
                  </div>
                ) : (
                  <div className="ws-grid">
                    {wsFiltrados.map(ws => {
                      const s = stats[ws.nome]
                      const badge = nivelBadge(ws.nivel_acesso)
                      return (
                        <div className="ws-card" key={ws.id} onClick={() => abrirWorkspace(ws)}>
                          <div className="ws-card-header">
                            <div className="ws-card-icon" style={wsIconStyle(ws)}>
                              <WsIcone icone={ws.icone} size={18} />
                            </div>
                            <div>
                              <div className="ws-card-title">{ws.nome}</div>
                              {ws.descricao && <div className="ws-card-desc">{ws.descricao}</div>}
                            </div>
                          </div>

                          <div className="ws-card-stats">
                            <div className="ws-stat">
                              <i className="fa-solid fa-chart-bar" />
                              {s ? `${s.reports} relatório(s)` : '— relatórios'}
                            </div>
                            <div className="ws-stat">
                              <i className="fa-solid fa-users" />
                              {s ? `${s.totalAccess + s.partialAccess} usuário(s)` : '— usuários'}
                            </div>
                          </div>

                          <div className="ws-card-footer">
                            {!isAdmin && (
                              <span className={`ws-nivel-badge ${badge.cls}`}>{badge.label}</span>
                            )}
                            <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 'auto' }}>
                              Ver relatórios <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>

      {/* ── Modal workspace ── */}
      {modal && (
        <ModalWorkspace
          workspace={modal === 'criar' ? null : modal}
          onClose={() => setModal(null)}
          onSave={aoSalvarModal}
        />
      )}

      {/* ── Modal adicionar usuário ── */}
      {modalUsuario && wsAtivo && (
        <ModalAdicionarUsuario
          workspaceId={wsAtivo.id}
          usuariosJaVinculados={usuarios}
          onClose={() => setModalUsuario(false)}
          onAdd={aoAdicionarUsuario}
        />
      )}
    </div>
  )
}
