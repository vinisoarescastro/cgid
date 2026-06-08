import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/users.css'
import logoSidebarFull from '../assets/logo-sidebar-full.png'
import logoSidebarIcon from '../assets/logo-sidebar-icon.png'
import Avatar from '../components/Avatar'
import { apiFetch } from '../utils/api'

const API = 'http://localhost:8000'

const PERFIS = [
  { value: 'super_administrador', label: 'Super Admin' },
  { value: 'administrador',       label: 'Administrador' },
  { value: 'gerente',             label: 'Gerente' },
  { value: 'operador',            label: 'Operador' },
  { value: 'visitante',           label: 'Visitante' },
]

const STATUS = [
  { value: 'ativo',     label: 'Ativo' },
  { value: 'inativo',   label: 'Inativo' },
  { value: 'bloqueado', label: 'Bloqueado' },
]

const PERFIL_LABELS = {
  super_administrador: 'Super Admin',
  administrador: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador',
  visitante: 'Visitante',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const NIVEL_LABELS = {
  total:             'Acesso total',
  apenas_relatorios: 'Relatórios específicos',
}

// ─── Modal de Criar/Editar ────────────────────────────────────────────────────
function ModalUsuario({ usuario, acessosIniciais = [], onClose, onSave }) {
  const editando = !!usuario
  const [form, setForm] = useState({
    nome:   usuario?.nome   ?? '',
    email:  usuario?.email  ?? '',
    perfil: usuario?.perfil ?? 'operador',
    status: usuario?.status ?? 'ativo',
    senha:  '',
  })
  const [erros, setErros]       = useState({})
  const [loading, setLoading]   = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [acessos, setAcessos]   = useState(
    acessosIniciais.map(a => ({ espaco_trabalho_id: a.espaco_trabalho_id, nivel_acesso: a.nivel_acesso }))
  )
  // { wsId: [{ id, nome }] } — relatórios disponíveis por workspace
  const [relatoriosWs, setRelatoriosWs] = useState({})
  // { wsId: Set<relatorioId> } — relatórios selecionados por workspace
  const [relatoriosSel, setRelatoriosSel] = useState({})

  // carrega workspaces e — se não vieram acessos do pai — busca do backend
  useEffect(() => {
    const fetchWs = fetch(`${API}/workspaces`).then(r => r.json())
    const fetchAcessos = (editando && acessosIniciais.length === 0)
      ? fetch(`${API}/usuarios/${usuario.id}/acessos`).then(r => r.json())
      : Promise.resolve(null)

    Promise.all([fetchWs, fetchAcessos])
      .then(([wsData, acessosData]) => {
        setWorkspaces(wsData)
        const acessosFinais = acessosData !== null
          ? acessosData.map(a => ({ espaco_trabalho_id: a.espaco_trabalho_id, nivel_acesso: a.nivel_acesso }))
          : acessosIniciais.map(a => ({ espaco_trabalho_id: a.espaco_trabalho_id, nivel_acesso: a.nivel_acesso }))
        if (acessosData !== null) setAcessos(acessosFinais)

        // para cada workspace com acesso "apenas_relatorios", carrega relatórios já selecionados
        const parciais = acessosFinais.filter(a => a.nivel_acesso === 'apenas_relatorios')
        parciais.forEach(a => carregarRelatoriosWs(a.espaco_trabalho_id, true))
      })
      .catch(() => {})
  }, [])

  async function carregarRelatoriosWs(wsId, carregarSelecionados = false) {
    // busca lista de relatórios do workspace (só uma vez)
    setRelatoriosWs(prev => {
      if (prev[wsId]) return prev
      fetch(`${API}/workspaces/${wsId}/relatorios`)
        .then(r => r.json())
        .then(data => setRelatoriosWs(p => ({ ...p, [wsId]: data })))
        .catch(() => {})
      return { ...prev, [wsId]: [] }
    })
    if (carregarSelecionados && editando) {
      fetch(`${API}/workspaces/${wsId}/usuarios/${usuario.id}/relatorios`)
        .then(r => r.json())
        .then(ids => setRelatoriosSel(p => ({ ...p, [wsId]: new Set(ids) })))
        .catch(() => setRelatoriosSel(p => ({ ...p, [wsId]: new Set() })))
    } else if (!editando) {
      setRelatoriosSel(p => ({ ...p, [wsId]: p[wsId] ?? new Set() }))
    }
  }

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }))
    setErros(e => ({ ...e, [campo]: '' }))
  }

  function toggleWorkspace(wsId) {
    setAcessos(prev => {
      const exists = prev.find(a => a.espaco_trabalho_id === wsId)
      if (exists) return prev.filter(a => a.espaco_trabalho_id !== wsId)
      return [...prev, { espaco_trabalho_id: wsId, nivel_acesso: 'total' }]
    })
  }

  function setNivel(wsId, nivel) {
    setAcessos(prev => prev.map(a => a.espaco_trabalho_id === wsId ? { ...a, nivel_acesso: nivel } : a))
    if (nivel === 'apenas_relatorios') carregarRelatoriosWs(wsId, true)
  }

  function toggleRelatorio(wsId, relId) {
    setRelatoriosSel(prev => {
      const atual = new Set(prev[wsId] ?? [])
      if (atual.has(relId)) atual.delete(relId)
      else atual.add(relId)
      return { ...prev, [wsId]: atual }
    })
  }

  function validar() {
    const e = {}
    if (!form.nome.trim())  e.nome  = 'Nome obrigatório.'
    if (!form.email.trim()) e.email = 'E-mail obrigatório.'
    if (form.senha && form.senha.length < 6) e.senha = 'Mínimo 6 caracteres.'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const e2 = validar()
    if (Object.keys(e2).length) { setErros(e2); return }
    setLoading(true)
    try {
      const body = { nome: form.nome, email: form.email, perfil: form.perfil }
      if (!editando) body.senha = form.senha
      if (editando) {
        body.status = form.status
        if (form.senha) body.senha = form.senha
      }

      // 1. salva o usuário
      const res = await apiFetch(
        editando ? `/usuarios/${usuario.id}` : `/usuarios`,
        { method: editando ? 'PUT' : 'POST', body }
      )
      if (res.status === 409) { setErros({ email: 'E-mail já cadastrado.' }); return }
      if (!res.ok) throw new Error()
      const data = await res.json()

      // 2. salva os acessos
      await apiFetch(`/usuarios/${data.id}/acessos`, { method: 'PUT', body: acessos })

      // 3. salva relatórios específicos para cada workspace com acesso parcial
      const parciais = acessos.filter(a => a.nivel_acesso === 'apenas_relatorios')
      await Promise.all(parciais.map(a =>
        apiFetch(`/workspaces/${a.espaco_trabalho_id}/usuarios/${data.id}/relatorios`, {
          method: 'PUT',
          body: { relatorio_ids: [...(relatoriosSel[a.espaco_trabalho_id] ?? [])] },
        })
      ))

      onSave(data)
    } catch {
      setErros({ geral: 'Erro ao salvar. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-hd">
          <span className="modal-title">{editando ? 'Editar usuário' : 'Novo usuário'}</span>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-bd">
            {erros.geral && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-sm)', color: '#b91c1c', fontSize: 13 }}>
                {erros.geral}
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className={`form-input${erros.nome ? ' error' : ''}`} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="João Silva" />
                {erros.nome && <span className="form-error">{erros.nome}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className={`form-input${erros.email ? ' error' : ''}`} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@empresa.com" />
                {erros.email && <span className="form-error">{erros.email}</span>}
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Perfil</label>
                <select className="form-select" value={form.perfil} onChange={e => set('perfil', e.target.value)}>
                  {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              {editando && (
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                    {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">{editando ? 'Nova senha (deixe vazio para manter)' : 'Senha'}</label>
              <input
                className={`form-input${erros.senha ? ' error' : ''}`}
                type="password"
                value={form.senha}
                onChange={e => set('senha', e.target.value)}
                placeholder={editando ? '••••••••' : 'Mudar@123 (padrão)'}
              />
              {!editando && (
                <span style={{ fontSize: 11.5, color: 'var(--gray-400)', marginTop: 3 }}>
                  Deixe vazio para usar a senha padrão <strong>Mudar@123</strong>.
                </span>
              )}
              {erros.senha && <span className="form-error">{erros.senha}</span>}
            </div>

            {/* ── Acesso a Workspaces ── */}
            <div className="form-group">
              <label className="form-label">Acesso a Workspaces</label>
              {['super_administrador', 'administrador'].includes(form.perfil) ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 'var(--r-md)',
                  background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
                  color: 'var(--brand-700)', fontSize: 13,
                }}>
                  <i className="fa-solid fa-shield-halved" />
                  <span>
                    <strong>Acesso total</strong> — Super Admin e Admin têm acesso a todos os workspaces e relatórios automaticamente.
                  </span>
                </div>
              ) : workspaces.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--gray-400)', padding: '8px 0' }}>Nenhum workspace disponível.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {workspaces.map(ws => {
                    const acesso = acessos.find(a => a.espaco_trabalho_id === ws.id)
                    const ativo  = !!acesso
                    return (
                      <div key={ws.id} className={`ws-acesso-row${ativo ? ' ws-acesso-ativo' : ''}`}>
                        <div className="ws-acesso-row-top">
                          <label className="ws-acesso-check">
                            <input
                              type="checkbox"
                              checked={ativo}
                              onChange={() => toggleWorkspace(ws.id)}
                            />
                            <span className="ws-acesso-icon" style={{ background: ws.cor ? ws.cor + '22' : 'var(--gray-100)', color: ws.cor ?? 'var(--gray-500)' }}>
                              <i className={ws.icone ? `fa-solid ${ws.icone}` : 'fa-solid fa-building'} />
                            </span>
                            <span className="ws-acesso-nome">{ws.nome}</span>
                          </label>
                          {ativo && (
                            <select
                              className="ws-acesso-nivel"
                              value={acesso.nivel_acesso}
                              onChange={e => setNivel(ws.id, e.target.value)}
                            >
                              <option value="total">Acesso total</option>
                              <option value="apenas_relatorios">Relatórios específicos</option>
                            </select>
                          )}
                        </div>
                        {ativo && acesso.nivel_acesso === 'apenas_relatorios' && (
                          <div className="ws-relatorios">
                            <div className="ws-relatorios-header">
                              <i className="fa-solid fa-chart-bar" style={{ marginRight: 5 }} />
                              Relatórios permitidos
                            </div>
                            {relatoriosWs[ws.id] === undefined || (relatoriosWs[ws.id] ?? []).length === 0 ? (
                              <span className="ws-relatorios-empty">
                                {relatoriosWs[ws.id] === undefined ? 'Carregando…' : 'Nenhum relatório publicado neste workspace.'}
                              </span>
                            ) : (relatoriosWs[ws.id]).map(rel => {
                              const marcado = (relatoriosSel[ws.id] ?? new Set()).has(rel.id)
                              return (
                                <label key={rel.id} className={`ws-relatorio-item${marcado ? ' checked' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={marcado}
                                    onChange={() => toggleRelatorio(ws.id, rel.id)}
                                  />
                                  {rel.nome}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
          <div className="modal-ft">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><i className="fa-solid fa-circle-notch fa-spin" /> Salvando…</> : <><i className="fa-solid fa-floppy-disk" /> Salvar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal de Confirmação de Exclusão ────────────────────────────────────────
function ModalConfirmar({ usuario, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  async function handleConfirm() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="confirm-body">
          <div className="confirm-icon"><i className="fa-solid fa-trash" /></div>
          <div className="confirm-title">Excluir usuário?</div>
          <div className="confirm-desc">
            Tem certeza que deseja excluir <strong>{usuario.nome}</strong>?<br />
            Esta ação não pode ser desfeita.
          </div>
        </div>
        <div className="modal-ft">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleConfirm} disabled={loading}>
            {loading ? <><i className="fa-solid fa-circle-notch fa-spin" /> Excluindo…</> : <><i className="fa-solid fa-trash" /> Excluir</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UsersPage() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(() => sessionStorage.getItem('sidebar_expanded') === '1')
  const currentUser = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ['super_administrador', 'administrador'].includes(currentUser.perfil)

  const [usuarios, setUsuarios]   = useState([])
  const [acessosMap, setAcessosMap] = useState({}) // { userId: [{nome, nivel_acesso}] }
  const [busca, setBusca]         = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('')
  const [loading, setLoading]     = useState(true)

  const [modalEditar, setModalEditar]     = useState(null)  // null | usuario
  const [modalNovo, setModalNovo]         = useState(false)
  const [modalExcluir, setModalExcluir]   = useState(null)  // null | usuario
  const [modalResetSenha, setModalResetSenha] = useState(null) // null | usuario

  const fetchUsuarios = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroStatus) params.append('status', filtroStatus)
    if (filtroPerfil) params.append('perfil', filtroPerfil)
    if (busca)        params.append('busca', busca)
    try {
      const res  = await fetch(`${API}/usuarios?${params}`)
      const data = await res.json()
      setUsuarios(data)
      // carrega acessos de todos os usuários em paralelo
      const entries = await Promise.all(
        data.map(u =>
          fetch(`${API}/usuarios/${u.id}/acessos`)
            .then(r => r.json())
            .then(acessos => [u.id, acessos])
            .catch(() => [u.id, []])
        )
      )
      setAcessosMap(Object.fromEntries(entries))
    } catch {
      setUsuarios([])
    } finally {
      setLoading(false)
    }
  }, [filtroStatus, filtroPerfil, busca])

  useEffect(() => {
    const t = setTimeout(fetchUsuarios, 300)
    return () => clearTimeout(t)
  }, [fetchUsuarios])

  function handleSave() {
    setModalNovo(false)
    setModalEditar(null)
    fetchUsuarios()
  }

  async function handleExcluir() {
    await apiFetch(`/usuarios/${modalExcluir.id}`, { method: 'DELETE' })
    setUsuarios(prev => prev.filter(u => u.id !== modalExcluir.id))
    setModalExcluir(null)
  }

  async function handleResetSenha() {
    const res = await apiFetch(`/usuarios/${modalResetSenha.id}/resetar-senha`, { method: 'POST' })
    if (res.ok) setModalResetSenha(null)
  }

  async function alterarStatus(usuario, novoStatus) {
    const res = await apiFetch(`/usuarios/${usuario.id}`, {
      method: 'PUT',
      body: { status: novoStatus },
    })
    if (res.ok) {
      const atualizado = await res.json()
      setUsuarios(prev => prev.map(u => u.id === atualizado.id ? atualizado : u))
    }
  }

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
          <button className="sb-toggle" onClick={() => setExpanded(v => { sessionStorage.setItem('sidebar_expanded', v ? '' : '1'); return !v })} title={expanded ? 'Retrair' : 'Expandir'}>
            <i className={`fa-solid ${expanded ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
          </button>
        </div>
        <nav className="sb-nav">
          <div className="sb-link" onClick={() => navigate('/')}>
            <div className="sb-icon"><i className="fa-solid fa-house" /></div>
            <span className="sb-label">Home</span>
          </div>
          <div className="sb-link active">
            <div className="sb-icon"><i className="fa-solid fa-users" /></div>
            <span className="sb-label">Usuários</span>
          </div>
          <div className="sb-link" onClick={() => navigate('/workspaces')}>
            <div className="sb-icon"><i className="fa-solid fa-building-columns" /></div>
            <span className="sb-label">Workspace</span>
          </div>
          <div className="sb-link" onClick={() => navigate('/favoritos')}>
            <div className="sb-icon"><i className="fa-solid fa-star" /></div>
            <span className="sb-label">Favoritos</span>
          </div>
          {currentUser.perfil === 'super_administrador' && (
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
            <Avatar user={currentUser} size={36} radius={10} />
            <div className="sb-user-info">
              <div className="sb-user-name">{currentUser.nome || currentUser.email}</div>
              <div className="sb-user-role">{PERFIL_LABELS[currentUser.perfil] || 'Usuário'}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── App Body ── */}
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Usuários</span>
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn topbar-btn-danger" title="Sair" onClick={handleLogout}>
              <i className="fa-solid fa-right-from-bracket" />
            </button>
            <Avatar user={currentUser} size={34} radius={10} />
          </div>
        </header>

        <div className="content-area">
          <div className="page-content">

            <div className="ph">
              <div>
                <div className="ph-title">Usuários</div>
                <div className="ph-sub">Cadastro e controle de acesso por usuário</div>
              </div>
              <button className="btn-primary" onClick={() => setModalNovo(true)}>
                <i className="fa-solid fa-plus" /> Novo Usuário
              </button>
            </div>

            <div className="card">
              <div className="card-bd" style={{ paddingBottom: 0 }}>
                <div className="users-toolbar">
                  <div className="users-search-wrap">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                      className="users-search"
                      placeholder="Buscar por nome ou e-mail..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                    />
                  </div>
                  <select className="users-filter" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                    <option value="">Todos os status</option>
                    {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <select className="users-filter" value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value)}>
                    <option value="">Todos os perfis</option>
                    {PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {loading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24 }} />
                </div>
              ) : usuarios.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-users-slash" />
                  <p>Nenhum usuário encontrado.</p>
                </div>
              ) : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Usuário</th>
                        <th>E-mail</th>
                        <th>Perfil</th>
                        <th>Workspaces</th>
                        <th>Status</th>
                        <th>Último acesso</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar user={u} size={32} radius={8} />
                              <span className="td-bold">{u.nome}</span>
                            </div>
                          </td>
                          <td style={{ color: 'var(--gray-500)' }}>{u.email}</td>
                          <td>
                            <span className={`perfil-badge perfil-${u.perfil}`}>
                              {PERFIL_LABELS[u.perfil]}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {['super_administrador', 'administrador'].includes(u.perfil) ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  padding: '2px 8px', borderRadius: 99,
                                  background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
                                  color: 'var(--brand-700)', fontSize: 11, fontWeight: 600,
                                }}>
                                  <i className="fa-solid fa-shield-halved" style={{ fontSize: 9 }} />
                                  Todos os workspaces
                                </span>
                              ) : (acessosMap[u.id] ?? []).length === 0
                                ? <span style={{ color: 'var(--gray-300)', fontSize: 12 }}>—</span>
                                : (acessosMap[u.id] ?? []).map(a => (
                                    <span key={a.espaco_trabalho_id} title={NIVEL_LABELS[a.nivel_acesso]} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '2px 8px', borderRadius: 99,
                                      background: 'var(--brand-50)', border: '1px solid var(--brand-100)',
                                      color: 'var(--brand-700)', fontSize: 11, fontWeight: 600,
                                    }}>
                                      {a.nome}
                                      {a.nivel_acesso === 'apenas_relatorios' &&
                                        <i className="fa-solid fa-list" style={{ fontSize: 9, opacity: .7 }} />
                                      }
                                    </span>
                                  ))
                              }
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge status-${u.status}`}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                              {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                            </span>
                          </td>
                          <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>
                            {u.ultimo_login ? formatDate(u.ultimo_login) : <span style={{ color: 'var(--gray-300)' }}>Nunca acessou</span>}
                          </td>
                          <td>
                            <div className="tbl-actions">
                              <button className="btn-action" title="Editar" onClick={() => setModalEditar(u)}>
                                <i className="fa-solid fa-pen" />
                              </button>
                              <button className="btn-action" title="Resetar senha para Mudar@123" onClick={() => setModalResetSenha(u)}>
                                <i className="fa-solid fa-key" />
                              </button>
                              {u.status === 'bloqueado' ? (
                                <button className="btn-action success" title="Desbloquear" onClick={() => alterarStatus(u, 'ativo')}>
                                  <i className="fa-solid fa-lock-open" />
                                </button>
                              ) : u.status === 'ativo' ? (
                                <button className="btn-action" title="Bloquear" onClick={() => alterarStatus(u, 'bloqueado')}>
                                  <i className="fa-solid fa-lock" />
                                </button>
                              ) : (
                                <button className="btn-action success" title="Ativar" onClick={() => alterarStatus(u, 'ativo')}>
                                  <i className="fa-solid fa-circle-check" />
                                </button>
                              )}
                              <button className="btn-action danger" title="Excluir" onClick={() => setModalExcluir(u)}>
                                <i className="fa-solid fa-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Modais ── */}
      {(modalNovo || modalEditar) && (
        <ModalUsuario
          usuario={modalEditar}
          acessosIniciais={modalEditar ? (acessosMap[modalEditar.id] ?? []) : []}
          onClose={() => { setModalNovo(false); setModalEditar(null) }}
          onSave={handleSave}
        />
      )}
      {modalExcluir && (
        <ModalConfirmar
          usuario={modalExcluir}
          onClose={() => setModalExcluir(null)}
          onConfirm={handleExcluir}
        />
      )}
      {modalResetSenha && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalResetSenha(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="confirm-body">
              <div className="confirm-icon" style={{ background: '#eff6ff' }}>
                <i className="fa-solid fa-key" style={{ color: '#3b82f6' }} />
              </div>
              <div className="confirm-title">Resetar senha?</div>
              <div className="confirm-desc">
                A senha de <strong>{modalResetSenha.nome}</strong> será redefinida para a senha padrão:<br />
                <code style={{ display: 'inline-block', marginTop: 8, padding: '4px 10px', background: 'var(--gray-100)', borderRadius: 6, fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
                  Mudar@123
                </code><br />
                <span style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 6, display: 'block' }}>
                  Informe ao usuário para trocar a senha no próximo acesso.
                </span>
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn-secondary" onClick={() => setModalResetSenha(null)}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handleResetSenha}
              >
                <i className="fa-solid fa-key" /> Resetar senha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
