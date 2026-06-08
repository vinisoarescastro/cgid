import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/workspace.css'
import logoSidebarFull from '../assets/logo-sidebar-full.png'
import logoSidebarIcon from '../assets/logo-sidebar-icon.png'
import Avatar from '../components/Avatar'
import IconPicker from '../components/IconPicker'
import VisualizadorRelatorio from '../components/VisualizadorRelatorio'
import { apiFetch } from '../utils/api'
import ModalConfirmacao from '../components/ModalConfirmacao'

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

// ─── Modal selecionar relatórios específicos ──────────────────────────────────
function ModalRelatoriosAcesso({ workspaceId, usuarioId, usuarioNome, relatoriosWs, onClose, onSave }) {
  const [selecionados, setSelecionados] = useState(new Set())
  const [loading, setLoading]           = useState(false)
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [erro, setErro]                 = useState(null)

  useEffect(() => {
    fetch(`${API}/workspaces/${workspaceId}/usuarios/${usuarioId}/relatorios`)
      .then(r => r.json())
      .then(ids => setSelecionados(new Set(ids)))
      .catch(() => {})
      .finally(() => setLoadingInicial(false))
  }, [])

  function toggle(id) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function salvar() {
    setLoading(true)
    try {
      const r = await apiFetch(`/workspaces/${workspaceId}/usuarios/${usuarioId}/relatorios`, {
        method: 'PUT',
        body: { relatorio_ids: [...selecionados] },
      })
      if (!r.ok) throw new Error()
      onSave([...selecionados])
    } catch {
      setErro('Não foi possível salvar os acessos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const publicados = relatoriosWs.filter(r => r.status === 'publicado')

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="modal-title">Relatórios específicos</div>
        <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
          Selecione quais relatórios <strong>{usuarioNome}</strong> poderá acessar neste workspace.
        </div>

        {loadingInicial ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>
        ) : publicados.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>
            Nenhum relatório publicado neste workspace.
          </div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
            {publicados.map(rel => {
              const checked = selecionados.has(rel.id)
              return (
                <label
                  key={rel.id}
                  onClick={() => toggle(rel.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', cursor: 'pointer',
                    background: checked ? 'var(--brand-50)' : 'transparent',
                    borderLeft: checked ? '3px solid var(--brand-500)' : '3px solid transparent',
                    transition: 'all var(--t-base)',
                  }}
                >
                  <input type="checkbox" readOnly checked={checked}
                    style={{ accentColor: 'var(--brand-500)', width: 15, height: 15, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{rel.nome}</div>
                    {rel.categoria && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{rel.categoria}</div>}
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>
          {selecionados.size} relatório(s) selecionado(s)
        </div>

        {erro && (
          <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{erro}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={loading || loadingInicial}>
            {loading ? 'Salvando...' : 'Salvar acessos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal adicionar usuário ao workspace ────────────────────────────────────
function ModalAdicionarUsuario({ workspaceId, relatoriosWs, usuariosJaVinculados, onClose, onAdd }) {
  const [todos, setTodos]       = useState([])
  const [busca, setBusca]       = useState('')
  const [selecionado, setSel]   = useState(null)
  const [nivel, setNivel]       = useState('total')
  const [relsSelecionadas, setRelsSelecionadas] = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [erro, setErro]         = useState(null)

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

  function toggleRel(id) {
    setRelsSelecionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function confirmar() {
    if (!selecionado) return
    setLoading(true)
    try {
      const r = await apiFetch(`/workspaces/${workspaceId}/usuarios`, {
        method: 'POST',
        body: { usuario_id: selecionado.id, nivel_acesso: nivel },
      })
      if (!r.ok) throw new Error()
      const novo = await r.json()
      if (nivel === 'apenas_relatorios' && relsSelecionadas.size > 0) {
        await apiFetch(`/workspaces/${workspaceId}/usuarios/${selecionado.id}/relatorios`, {
          method: 'PUT',
          body: { relatorio_ids: [...relsSelecionadas] },
        })
      }
      onAdd(novo)
    } catch {
      setErro('Não foi possível vincular o usuário. Tente novamente.')
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

        {nivel === 'apenas_relatorios' && (
          <div className="modal-field">
            <label className="modal-label">Relatórios permitidos</label>
            {relatoriosWs.filter(r => r.status === 'publicado').length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--gray-400)', padding: '10px 0' }}>
                Nenhum relatório publicado neste workspace.
              </div>
            ) : (
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--r-md)' }}>
                {relatoriosWs.filter(r => r.status === 'publicado').map(rel => {
                  const checked = relsSelecionadas.has(rel.id)
                  return (
                    <label
                      key={rel.id}
                      onClick={() => toggleRel(rel.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', cursor: 'pointer',
                        background: checked ? 'var(--brand-50)' : 'transparent',
                        borderLeft: checked ? '3px solid var(--brand-500)' : '3px solid transparent',
                        transition: 'all var(--t-base)',
                      }}
                    >
                      <input type="checkbox" readOnly checked={checked}
                        style={{ accentColor: 'var(--brand-500)', width: 14, height: 14, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: checked ? 600 : 400, color: 'var(--gray-800)' }}>{rel.nome}</div>
                        {rel.categoria && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{rel.categoria}</div>}
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
              {relsSelecionadas.size} selecionado(s)
            </div>
          </div>
        )}

        {erro && (
          <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{erro}
          </div>
        )}

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

// ─── Modal criar/editar relatório ────────────────────────────────────────────
function ModalRelatorio({ workspaceId, relatorio, onClose, onSave }) {
  const editando = !!relatorio
  const [form, setForm] = useState({
    nome:             relatorio?.nome             ?? '',
    categoria:        relatorio?.categoria        ?? '',
    status:           relatorio?.status           ?? 'publicado',
    descricao:        relatorio?.descricao        ?? '',
    id_relatorio_pbi: relatorio?.id_relatorio_pbi ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function salvar() {
    if (!form.nome.trim()) { setErro('O nome é obrigatório.'); return }
    setLoading(true); setErro('')
    try {
      const path   = editando
        ? `/workspaces/${workspaceId}/relatorios/${relatorio.id}`
        : `/workspaces/${workspaceId}/relatorios`
      const method = editando ? 'PUT' : 'POST'
      const r = await apiFetch(path, {
        method,
        body: {
          nome:             form.nome.trim(),
          categoria:        form.categoria.trim() || null,
          status:           form.status,
          descricao:        form.descricao.trim() || null,
          id_relatorio_pbi: form.id_relatorio_pbi.trim() || null,
        },
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
        <div className="modal-title">{editando ? 'Editar Relatório' : 'Novo Relatório'}</div>

        <div className="modal-field">
          <label className="modal-label">Nome *</label>
          <input className="modal-input" autoFocus value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Painel de Vendas" />
        </div>
        <div className="modal-field">
          <label className="modal-label">Categoria</label>
          <input className="modal-input" value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Ex: Financeiro, Operacional..." />
        </div>
        <div className="modal-field">
          <label className="modal-label">Status</label>
          <select className="modal-input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="publicado">Publicado</option>
            <option value="rascunho">Rascunho</option>
          </select>
        </div>
        <div className="modal-field">
          <label className="modal-label">ID Relatório Power BI</label>
          <input className="modal-input" value={form.id_relatorio_pbi} onChange={e => set('id_relatorio_pbi', e.target.value)} placeholder="UUID do relatório no Power BI" />
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
            Encontre na URL do Power BI: app.powerbi.com/groups/.../reports/<strong>{'<este-id>'}</strong>
          </div>
        </div>
        <div className="modal-field">
          <label className="modal-label">Descrição</label>
          <textarea className="modal-textarea" value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Descrição opcional..." />
        </div>

        {erro && <div style={{ fontSize: 12, color: 'var(--red-500)', marginBottom: 8 }}>{erro}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={loading}>
            {loading ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar relatório'}
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
      const path   = editando ? `/workspaces/${workspace.id}` : `/workspaces`
      const method = editando ? 'PUT' : 'POST'
      const r = await apiFetch(path, {
        method,
        body: {
          nome:             form.nome.trim(),
          icone:            form.icone.trim() || null,
          cor:              form.cor || null,
          descricao:        form.descricao.trim() || null,
          id_workspace_pbi: form.id_workspace_pbi.trim() || null,
        },
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
  const [mostrarArquivados, setMostrarArquivados] = useState(false)

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
  // modal gerenciar relatórios específicos de um usuário já vinculado
  const [modalRelAcesso, setModalRelAcesso] = useState(null) // null | usuario_obj
  // modal relatório
  const [modalRelatorio, setModalRelatorio] = useState(null) // null | 'criar' | relatorio_obj
  // visualizador Power BI
  const [relatorioAberto, setRelatorioAberto] = useState(null)
  // modal de confirmação/alerta genérico
  const [modalConfirm, setModalConfirm] = useState(null) // null | { titulo, mensagem, variante, icone, labelConfirmar, onConfirmar, modo }

  function abrirConfirm(opcoes) {
    return new Promise(resolve => {
      setModalConfirm({
        ...opcoes,
        onConfirmar: () => { setModalConfirm(null); resolve(true) },
        onCancelar:  () => { setModalConfirm(null); resolve(false) },
      })
    })
  }
  // favoritos do usuário (Set de relatorio_id)
  const [favoritos, setFavoritos] = useState(new Set())

  // stats cache (from dashboard)
  const [stats, setStats] = useState({})

  function handleLogout() {
    sessionStorage.removeItem('cgid_user')
    navigate('/login')
  }

  useEffect(() => {
    // carrega workspaces
    const uid = user.id
    const admin = isAdmin
    ;(async () => {
      try {
        let data
        if (admin) {
          const url = mostrarArquivados ? `${API}/workspaces?incluir_arquivados=true` : `${API}/workspaces`
          const r = await fetch(url)
          data = (await r.json()).map(ws => ({ ...ws, espaco_trabalho_id: ws.id, nivel_acesso: 'total' }))
        } else {
          const r = await fetch(`${API}/usuarios/${uid}/acessos`)
          data = (await r.json()).map(a => ({ ...a, id: a.espaco_trabalho_id }))
        }
        setWorkspaces(data)
      } catch {
        setWorkspaces([])
      } finally {
        setLoading(false)
      }
    })()

    fetch(`${API}/dashboard/workspaces`)
      .then(r => r.json())
      .then(data => { const map = {}; data.forEach(d => { map[d.nome] = d }); setStats(map) })
      .catch(() => {})

    fetch(`${API}/usuarios/${uid}/favoritos`)
      .then(r => r.json())
      .then(data => setFavoritos(new Set(data.map(f => f.relatorio_id))))
      .catch(() => {})
  }, [mostrarArquivados]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleFavorito(relatorioId) {
    const isFav = favoritos.has(relatorioId)
    if (isFav) {
      await fetch(`${API}/usuarios/${user.id}/favoritos/${relatorioId}`, { method: 'DELETE' })
      setFavoritos(prev => { const next = new Set(prev); next.delete(relatorioId); return next })
    } else {
      await fetch(`${API}/usuarios/${user.id}/favoritos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatorio_id: relatorioId }),
      })
      setFavoritos(prev => new Set([...prev, relatorioId]))
    }
  }

  async function abrirWorkspace(ws) {
    setWsAtivo(ws)
    setAbaAtiva('relatorios')
    setFiltroStatus('todos')
    setLoadingRel(true)
    setLoadingUsr(true)
    try {
      const relUrl = isAdmin
        ? `${API}/workspaces/${ws.id}/relatorios`
        : `${API}/workspaces/${ws.id}/relatorios?usuario_id=${user.id}`
      const [resRel, resUsr] = await Promise.all([
        fetch(relUrl),
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
    const ok = await abrirConfirm({
      titulo: 'Arquivar workspace',
      mensagem: `O workspace "${ws.nome}" ficará invisível para os usuários. Você poderá reativá-lo depois.`,
      labelConfirmar: 'Arquivar',
      variante: 'danger',
    })
    if (!ok) return
    await apiFetch(`/workspaces/${ws.id}/arquivar`, { method: 'PATCH' })
    setWorkspaces(prev => mostrarArquivados
      ? prev.map(w => w.id === ws.id ? { ...w, status: 'arquivado' } : w)
      : prev.filter(w => w.id !== ws.id)
    )
    if (wsAtivo?.id === ws.id) fecharDetalhe()
  }

  async function reativarWorkspace(ws) {
    const ok = await abrirConfirm({
      titulo: 'Reativar workspace',
      mensagem: `O workspace "${ws.nome}" voltará a aparecer para os usuários vinculados.`,
      labelConfirmar: 'Reativar',
      variante: 'primary',
      icone: 'fa-rotate-left',
    })
    if (!ok) return
    await apiFetch(`/workspaces/${ws.id}/reativar`, { method: 'PATCH' })
    setWorkspaces(prev => prev.map(w => w.id === ws.id ? { ...w, status: 'ativo' } : w))
    if (wsAtivo?.id === ws.id) setWsAtivo(w => ({ ...w, status: 'ativo' }))
  }

  async function alterarNivelUsuario(usuarioId, novoNivel) {
    try {
      const r = await apiFetch(`/workspaces/${wsAtivo.id}/usuarios/${usuarioId}`, {
        method: 'PATCH',
        body: { nivel_acesso: novoNivel },
      })
      if (!r.ok) throw new Error()
      setUsuarios(prev => prev.map(u => u.usuario_id === usuarioId ? { ...u, nivel_acesso: novoNivel } : u))
    } catch {
      await abrirConfirm({
        titulo: 'Erro',
        mensagem: 'Não foi possível alterar o nível de acesso. Tente novamente.',
        labelConfirmar: 'Ok',
        variante: 'danger',
        modo: 'alert',
      })
    }
  }

  async function removerUsuario(usuarioId, nomeUsuario) {
    const ok = await abrirConfirm({
      titulo: 'Remover usuário',
      mensagem: `"${nomeUsuario}" perderá o acesso a este workspace.`,
      labelConfirmar: 'Remover',
      variante: 'danger',
    })
    if (!ok) return
    try {
      const r = await apiFetch(`/workspaces/${wsAtivo.id}/usuarios/${usuarioId}`, { method: 'DELETE' })
      if (!r.ok && r.status !== 204) throw new Error()
      setUsuarios(prev => prev.filter(u => u.usuario_id !== usuarioId))
    } catch {
      await abrirConfirm({
        titulo: 'Erro',
        mensagem: 'Não foi possível remover o usuário. Tente novamente.',
        labelConfirmar: 'Ok',
        variante: 'danger',
        modo: 'alert',
      })
    }
  }

  function aoAdicionarUsuario(novoUsuario) {
    setUsuarios(prev => [...prev, novoUsuario].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')))
    setModalUsuario(false)
  }

  function aoSalvarRelatorio(salvo, editando) {
    if (editando) {
      setRelatorios(prev => prev.map(r => r.id === salvo.id ? salvo : r))
    } else {
      setRelatorios(prev => [...prev, salvo].sort((a, b) => a.nome.localeCompare(b.nome)))
    }
    setModalRelatorio(null)
  }

  async function excluirRelatorio(relatorio) {
    const ok = await abrirConfirm({
      titulo: 'Excluir relatório',
      mensagem: `O relatório "${relatorio.nome}" será excluído permanentemente. Esta ação não pode ser desfeita.`,
      labelConfirmar: 'Excluir',
      variante: 'danger',
    })
    if (!ok) return
    try {
      const r = await apiFetch(`/workspaces/${wsAtivo.id}/relatorios/${relatorio.id}`, { method: 'DELETE' })
      if (!r.ok && r.status !== 204) throw new Error()
      setRelatorios(prev => prev.filter(rel => rel.id !== relatorio.id))
    } catch {
      await abrirConfirm({
        titulo: 'Erro',
        mensagem: 'Não foi possível excluir o relatório. Tente novamente.',
        labelConfirmar: 'Ok',
        variante: 'danger',
        modo: 'alert',
      })
    }
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
          <div className="sb-link" onClick={() => navigate('/favoritos')}>
            <div className="sb-icon"><i className="fa-solid fa-bookmark" /></div>
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {wsAtivo.status === 'arquivado' && (
                        <span className="badge badge-gray">
                          <i className="fa-solid fa-box-archive" style={{ marginRight: 4 }} />
                          Arquivado
                        </span>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(wsAtivo)}>
                        <i className="fa-solid fa-pen" /> Editar
                      </button>
                      {wsAtivo.status === 'arquivado' ? (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--brand-600)' }}
                          onClick={() => reativarWorkspace(wsAtivo)}>
                          <i className="fa-solid fa-rotate-left" /> Reativar
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }}
                          onClick={() => arquivarWorkspace(wsAtivo)}>
                          <i className="fa-solid fa-box-archive" /> Arquivar
                        </button>
                      )}
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
                  {isAdmin && (
                    <button
                      className={`ws-tab${abaAtiva === 'usuarios' ? ' active' : ''}`}
                      onClick={() => setAbaAtiva('usuarios')}
                    >
                      <i className="fa-solid fa-users" />
                      Usuários vinculados
                      <span className="ws-tab-count">{usuarios.length}</span>
                    </button>
                  )}
                </div>

                {/* ── Aba: Relatórios ── */}
                {abaAtiva === 'relatorios' && (
                  <div className="card">
                    <div className="card-bd">
                      <div className="ws-reports-toolbar">
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['todos', 'publicado', 'rascunho'].map(f => (
                            <button key={f}
                              className={`ws-filter-btn${filtroStatus === f ? ' active' : ''}`}
                              onClick={() => setFiltroStatus(f)}>
                              {f === 'todos' ? 'Todos' : STATUS_RELATORIO_LABEL[f]}
                            </button>
                          ))}
                        </div>
                        {isAdmin && (
                          <button className="btn btn-primary btn-sm" onClick={() => setModalRelatorio('criar')}>
                            <i className="fa-solid fa-plus" /> Novo relatório
                          </button>
                        )}
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
                                <button
                                  className="btn btn-ghost btn-sm"
                                  title={favoritos.has(r.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                  onClick={() => toggleFavorito(r.id)}
                                  style={{ color: favoritos.has(r.id) ? 'var(--brand-500)' : 'var(--gray-300)' }}
                                >
                                  <i className={`fa-${favoritos.has(r.id) ? 'solid' : 'regular'} fa-star`} />
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  title={r.id_relatorio_pbi ? 'Visualizar relatório' : 'Sem link configurado'}
                                  disabled={!r.id_relatorio_pbi}
                                  onClick={() => r.id_relatorio_pbi && setRelatorioAberto(r)}
                                  style={!r.id_relatorio_pbi ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                                >
                                  <i className="fa-solid fa-arrow-up-right-from-square" /> Abrir
                                </button>
                                {isAdmin && (
                                  <>
                                    <button className="btn btn-ghost btn-sm" title="Editar relatório"
                                      onClick={() => setModalRelatorio(r)}>
                                      <i className="fa-solid fa-pen" />
                                    </button>
                                    <button className="btn btn-ghost btn-sm" title="Excluir relatório"
                                      style={{ color: 'var(--red-500)' }}
                                      onClick={() => excluirRelatorio(r)}>
                                      <i className="fa-solid fa-trash" />
                                    </button>
                                  </>
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
                                    <td style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                      {u.nivel_acesso === 'apenas_relatorios' && (
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          title="Gerenciar relatórios específicos"
                                          style={{ padding: '4px 8px' }}
                                          onClick={() => setModalRelAcesso(u)}
                                        >
                                          <i className="fa-solid fa-list-check" />
                                        </button>
                                      )}
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
                  {isAdmin && (
                    <button
                      className={`ws-filter-btn${mostrarArquivados ? ' active' : ''}`}
                      onClick={() => setMostrarArquivados(v => !v)}
                    >
                      <i className="fa-solid fa-box-archive" />
                      {mostrarArquivados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
                    </button>
                  )}
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
                      const arquivado = ws.status === 'arquivado'
                      return (
                        <div
                          className={`ws-card${arquivado ? ' ws-card-arquivado' : ''}`}
                          key={ws.id}
                          onClick={() => (!arquivado || isAdmin) && abrirWorkspace(ws)}
                          style={arquivado && !isAdmin ? { cursor: 'default' } : {}}
                        >
                          {arquivado && (
                            <div className="ws-card-arquivado-bar">
                              <i className="fa-solid fa-box-archive" />
                              Arquivado
                              <button
                                className="ws-card-reativar-btn"
                                onClick={e => { e.stopPropagation(); reativarWorkspace(ws) }}
                              >
                                <i className="fa-solid fa-rotate-left" /> Reativar
                              </button>
                            </div>
                          )}

                          <div className="ws-card-header">
                            <div className="ws-card-icon" style={wsIconStyle(ws)}>
                              <WsIcone icone={ws.icone} size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="ws-card-title">{ws.nome}</div>
                              {ws.descricao && <div className="ws-card-desc">{ws.descricao}</div>}
                            </div>
                          </div>

                          {!arquivado && (
                            <>
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
                            </>
                          )}
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
          relatoriosWs={relatorios}
          usuariosJaVinculados={usuarios}
          onClose={() => setModalUsuario(false)}
          onAdd={aoAdicionarUsuario}
        />
      )}

      {/* ── Modal gerenciar relatórios específicos ── */}
      {modalRelAcesso && wsAtivo && (
        <ModalRelatoriosAcesso
          workspaceId={wsAtivo.id}
          usuarioId={modalRelAcesso.usuario_id}
          usuarioNome={modalRelAcesso.nome || modalRelAcesso.email}
          relatoriosWs={relatorios}
          onClose={() => setModalRelAcesso(null)}
          onSave={() => setModalRelAcesso(null)}
        />
      )}

      {/* ── Modal relatório ── */}
      {modalRelatorio && wsAtivo && (
        <ModalRelatorio
          workspaceId={wsAtivo.id}
          relatorio={modalRelatorio === 'criar' ? null : modalRelatorio}
          onClose={() => setModalRelatorio(null)}
          onSave={aoSalvarRelatorio}
        />
      )}

      {/* ── Visualizador Power BI ── */}
      {relatorioAberto && (
        <VisualizadorRelatorio
          relatorio={relatorioAberto}
          onClose={() => setRelatorioAberto(null)}
        />
      )}

      {/* ── Modal de confirmação/alerta ── */}
      {modalConfirm && (
        <ModalConfirmacao
          titulo={modalConfirm.titulo}
          mensagem={modalConfirm.mensagem}
          variante={modalConfirm.variante}
          icone={modalConfirm.icone}
          labelConfirmar={modalConfirm.labelConfirmar}
          modo={modalConfirm.modo ?? 'confirm'}
          onConfirmar={modalConfirm.onConfirmar}
          onCancelar={modalConfirm.onCancelar}
        />
      )}
    </div>
  )
}
