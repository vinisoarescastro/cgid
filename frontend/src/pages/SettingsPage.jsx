import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/settings.css'
import logoSidebarFull from '../assets/logo-sidebar-full.png'
import logoSidebarIcon from '../assets/logo-sidebar-icon.png'
import Avatar from '../components/Avatar'
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
const SUPER_ADMIN  = 'super_administrador'

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

// ─── Aba Expediente ───────────────────────────────────────────────────────────
function AbaExpediente() {
  const [regras, setRegras]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [salvando, setSalvando] = useState(null) // dia_semana sendo salvo
  const [ok, setOk]             = useState(null) // dia_semana com feedback OK
  const [erros, setErros]       = useState({})  // { [dia_semana]: mensagem }

  useEffect(() => {
    fetch(`${API}/configuracoes/expediente`)
      .then(r => r.json())
      .then(setRegras)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(dia, campo, valor) {
    setRegras(prev => prev.map(r => r.dia_semana === dia ? { ...r, [campo]: valor } : r))
  }

  async function salvar(dia) {
    const r = regras.find(x => x.dia_semana === dia)
    if (!r.hora_inicio || !r.hora_fim) return
    setSalvando(dia)
    try {
      const res = await apiFetch(`/configuracoes/expediente/${dia}`, {
        method: 'PUT',
        body: { hora_inicio: r.hora_inicio, hora_fim: r.hora_fim, ativo: r.ativo, bloquear_fora: r.bloquear_fora },
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail) }
      setOk(dia)
      setErros(prev => ({ ...prev, [dia]: null }))
      setTimeout(() => setOk(v => v === dia ? null : v), 2000)
    } catch (e) {
      setErros(prev => ({ ...prev, [dia]: e.message || 'Erro ao salvar.' }))
    } finally {
      setSalvando(null)
    }
  }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>
      Carregando...
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
        Configure os horários de acesso ao portal por dia da semana. Dias inativos não bloqueiam o acesso, apenas dias <strong>ativos com "bloquear fora"</strong> impedem o login fora do horário.
      </div>
      <div className="sched-grid">
        <div className="sched-header">
          <span>Dia</span>
          <span>Início</span>
          <span>Fim</span>
          <span>Ativo</span>
          <span>Bloquear fora</span>
          <span />
        </div>
        {regras.map(r => (
          <div className={`sched-row${r.ativo ? '' : ' inativo'}`} key={r.dia_semana}>
            <div className="sched-dia">{r.nome_dia}</div>

            <input
              type="time"
              className="sched-time-input"
              value={r.hora_inicio ?? ''}
              disabled={!r.ativo}
              onChange={e => set(r.dia_semana, 'hora_inicio', e.target.value)}
            />

            <input
              type="time"
              className="sched-time-input"
              value={r.hora_fim ?? ''}
              disabled={!r.ativo}
              onChange={e => set(r.dia_semana, 'hora_fim', e.target.value)}
            />

            <div className="sched-toggle-wrap">
              <Toggle checked={r.ativo} onChange={v => set(r.dia_semana, 'ativo', v)} />
            </div>

            <div className="sched-toggle-wrap">
              <Toggle
                checked={r.bloquear_fora}
                onChange={v => set(r.dia_semana, 'bloquear_fora', v)}
              />
            </div>

            <button
              className="btn btn-ghost btn-sm"
              style={{ whiteSpace: 'nowrap', fontSize: 12 }}
              disabled={salvando === r.dia_semana || !r.ativo}
              onClick={() => salvar(r.dia_semana)}
            >
              {salvando === r.dia_semana
                ? <i className="fa-solid fa-spinner fa-spin" />
                : ok === r.dia_semana
                  ? <><i className="fa-solid fa-check" style={{ color: 'var(--brand-500)' }} /> Salvo</>
                  : erros[r.dia_semana]
                    ? <><i className="fa-solid fa-circle-exclamation" style={{ color: '#ef4444' }} /> Erro</>
                    : 'Salvar'}
            </button>
          </div>
          {erros[r.dia_semana] && (
            <div style={{ fontSize: 11, color: '#ef4444', padding: '2px 0 6px 0' }}>
              {erros[r.dia_semana]}
            </div>
          )}
        ))}
      </div>
    </div>
  )
}

// ─── Modal grupo ──────────────────────────────────────────────────────────────
function ModalGrupo({ grupo, onClose, onSave }) {
  const editando = !!grupo
  const [form, setForm] = useState({
    nome:          grupo?.nome          ?? '',
    fora_horario:  grupo?.fora_horario  ?? true,
    janela_inicio: grupo?.janela_inicio ?? '',
    janela_fim:    grupo?.janela_fim    ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome obrigatório.'); return }
    setLoading(true); setErro('')
    try {
      const path   = editando ? `/configuracoes/grupos-excecao/${grupo.id}` : `/configuracoes/grupos-excecao`
      const method = editando ? 'PUT' : 'POST'
      const r = await apiFetch(path, {
        method,
        body: { nome: form.nome.trim(), fora_horario: form.fora_horario,
                janela_inicio: form.janela_inicio || null, janela_fim: form.janela_fim || null },
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail) }
      onSave(await r.json())
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-title">{editando ? 'Editar grupo' : 'Novo grupo de exceção'}</div>

        <div className="modal-field">
          <label className="modal-label">Nome *</label>
          <input className="modal-input" autoFocus value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Diretoria" />
        </div>

        <div className="modal-field" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Toggle checked={form.fora_horario} onChange={v => set('fora_horario', v)} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>Acesso fora do expediente</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Membros podem acessar fora do horário padrão</div>
          </div>
        </div>

        {form.fora_horario && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="modal-field" style={{ flex: 1 }}>
              <label className="modal-label">Janela início</label>
              <input type="time" className="modal-input" value={form.janela_inicio} onChange={e => set('janela_inicio', e.target.value)} />
            </div>
            <div className="modal-field" style={{ flex: 1 }}>
              <label className="modal-label">Janela fim</label>
              <input type="time" className="modal-input" value={form.janela_fim} onChange={e => set('janela_fim', e.target.value)} />
            </div>
          </div>
        )}

        {erro && <div style={{ fontSize: 12, color: 'var(--red-500)', marginBottom: 8 }}>{erro}</div>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={loading}>
            {loading ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar grupo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal adicionar membro ───────────────────────────────────────────────────
function ModalAdicionarMembro({ grupoId, membrosAtuais, onClose, onAdd }) {
  const [todos, setTodos]           = useState([])
  const [busca, setBusca]           = useState('')
  const [selecionado, setSel]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [erro, setErro]             = useState(null)

  useEffect(() => {
    fetch(`${API}/usuarios?status=ativo`)
      .then(r => r.json())
      .then(data => {
        const ids = new Set(membrosAtuais.map(m => m.usuario_id))
        setTodos(data.filter(u => !ids.has(u.id)))
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
      const r = await apiFetch(`/configuracoes/grupos-excecao/${grupoId}/membros`, {
        method: 'POST',
        body: { usuario_id: selecionado.id },
      })
      if (!r.ok) throw new Error()
      onAdd(await r.json())
    } catch {
      setErro('Não foi possível adicionar o membro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="modal-title">Adicionar membro ao grupo</div>
        <div className="modal-field">
          <label className="modal-label">Buscar usuário</label>
          <div style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--gray-300)' }} />
            <input className="modal-input" style={{ paddingLeft: 30 }} autoFocus placeholder="Nome ou e-mail..."
              value={busca} onChange={e => { setBusca(e.target.value); setSel(null) }} />
          </div>
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
          {loadingList ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>
              {todos.length === 0 ? 'Todos os usuários já são membros.' : 'Nenhum resultado.'}
            </div>
          ) : filtrados.map(u => (
            <div key={u.id} onClick={() => setSel(u)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer',
              background: selecionado?.id === u.id ? 'var(--brand-50)' : 'transparent',
              borderLeft: selecionado?.id === u.id ? '3px solid var(--brand-500)' : '3px solid transparent',
              transition: 'all var(--t-base)',
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: 'var(--brand-100)', color: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                {(u.nome || u.email)?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{u.nome || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{u.email}</div>
              </div>
              {selecionado?.id === u.id && <i className="fa-solid fa-circle-check" style={{ marginLeft: 'auto', color: 'var(--brand-500)' }} />}
            </div>
          ))}
        </div>
        {erro && (
          <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-md)', padding: '8px 12px', marginBottom: 12 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{erro}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar} disabled={loading || !selecionado}>
            {loading ? 'Adicionando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Grupos de Exceção ────────────────────────────────────────────────────
function AbaGrupos() {
  const [grupos, setGrupos]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalGrupo, setModalGrupo]   = useState(null) // null | 'criar' | grupo_obj
  const [modalMembro, setModalMembro] = useState(null) // null | grupo_obj
  const [modalConfirm, setModalConfirm] = useState(null)

  function abrirConfirm(opcoes) {
    return new Promise(resolve => {
      setModalConfirm({
        ...opcoes,
        onConfirmar: () => { setModalConfirm(null); resolve(true) },
        onCancelar:  () => { setModalConfirm(null); resolve(false) },
      })
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API}/configuracoes/grupos-excecao`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setGrupos(data); setLoading(false) })
      .catch(() => setLoading(false))
    return () => controller.abort()
  }, [])

  function aoSalvarGrupo(salvo) {
    setGrupos(prev => {
      const existe = prev.find(g => g.id === salvo.id)
      return existe
        ? prev.map(g => g.id === salvo.id ? salvo : g)
        : [...prev, salvo].sort((a, b) => a.nome.localeCompare(b.nome))
    })
    setModalGrupo(null)
  }

  async function excluirGrupo(grupo) {
    const ok = await abrirConfirm({
      titulo: 'Excluir grupo',
      mensagem: `O grupo "${grupo.nome}" será excluído permanentemente, incluindo todos os membros vinculados.`,
      labelConfirmar: 'Excluir',
      variante: 'danger',
    })
    if (!ok) return
    await fetch(`${API}/configuracoes/grupos-excecao/${grupo.id}`, { method: 'DELETE' })
    setGrupos(prev => prev.filter(g => g.id !== grupo.id))
  }

  async function removerMembro(grupoId, usuarioId) {
    await fetch(`${API}/configuracoes/grupos-excecao/${grupoId}/membros/${usuarioId}`, { method: 'DELETE' })
    setGrupos(prev => prev.map(g =>
      g.id === grupoId ? { ...g, membros: g.membros.filter(m => m.usuario_id !== usuarioId) } : g
    ))
  }

  function aoAdicionarMembro(grupoAtualizado) {
    setGrupos(prev => prev.map(g => g.id === grupoAtualizado.id ? grupoAtualizado : g))
    setModalMembro(null)
  }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          Grupos que permitem acesso fora do expediente padrão, dentro de uma janela específica.
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModalGrupo('criar')}>
          <i className="fa-solid fa-plus" /> Novo grupo
        </button>
      </div>

      {grupos.length === 0 ? (
        <div className="ws-empty">
          <i className="fa-solid fa-users-slash" />
          <div className="ws-empty-title">Nenhum grupo de exceção</div>
          <div className="ws-empty-sub">Crie um grupo para permitir acesso fora do expediente padrão.</div>
        </div>
      ) : grupos.map(g => (
        <div className="grupo-card" key={g.id}>
          <div className="grupo-card-header">
            <i className="fa-solid fa-users" style={{ color: 'var(--brand-500)', fontSize: 14 }} />
            <div className="grupo-card-nome">{g.nome}</div>
            <span className="grupo-card-meta">
              {g.fora_horario
                ? g.janela_inicio && g.janela_fim
                  ? `Janela: ${g.janela_inicio} – ${g.janela_fim}`
                  : 'Acesso irrestrito fora do expediente'
                : 'Sem acesso fora do expediente'}
            </span>
            <span className={`badge ${g.status === 'ativo' ? 'badge-green' : 'badge-gray'}`}>{g.status}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setModalGrupo(g)}>
              <i className="fa-solid fa-pen" />
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-500)' }} onClick={() => excluirGrupo(g)}>
              <i className="fa-solid fa-trash" />
            </button>
          </div>
          <div className="grupo-membros">
            {g.membros.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--gray-400)', alignSelf: 'center' }}>Nenhum membro</span>
            ) : g.membros.map(m => (
              <div className="grupo-membro-chip" key={m.usuario_id}>
                {m.nome || m.email}
                <button onClick={() => removerMembro(g.id, m.usuario_id)} title="Remover">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setModalMembro(g)}>
              <i className="fa-solid fa-user-plus" /> Adicionar membro
            </button>
          </div>
        </div>
      ))}

      {modalGrupo && (
        <ModalGrupo
          grupo={modalGrupo === 'criar' ? null : modalGrupo}
          onClose={() => setModalGrupo(null)}
          onSave={aoSalvarGrupo}
        />
      )}
      {modalMembro && (
        <ModalAdicionarMembro
          grupoId={modalMembro.id}
          membrosAtuais={modalMembro.membros}
          onClose={() => setModalMembro(null)}
          onAdd={aoAdicionarMembro}
        />
      )}

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

// ─── Aba Credenciais Power BI ─────────────────────────────────────────────────
function AbaCredenciaisPBI() {
  const [form, setForm]         = useState({ tenant_id: '', client_id: '', client_secret: '' })
  const [loading, setLoading]   = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mostrarSecret, setMostrarSecret] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [erro, setErro]         = useState('')

  useEffect(() => {
    fetch(`${API}/configuracoes/pbi`)
      .then(r => r.json())
      .then(d => setForm({ tenant_id: d.tenant_id, client_id: d.client_id, client_secret: d.client_secret }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function salvar() {
    setSalvando(true); setErro(''); setFeedback('')
    try {
      const r = await apiFetch(`/configuracoes/pbi`, {
        method: 'PUT',
        body: form,
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.detail) }
      const salvo = await r.json()
      setForm(f => ({ ...f, client_secret: salvo.client_secret }))
      setFeedback('Credenciais salvas com sucesso.')
      setTimeout(() => setFeedback(''), 3000)
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>
  )

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
        Credenciais do <strong>Service Principal</strong> no Azure AD usadas para gerar tokens de embed do Power BI. Armazenadas de forma segura no banco de dados.
      </div>
      <div className="pbi-form">
        <div className="modal-field">
          <label className="modal-label">Tenant ID (Directory ID)</label>
          <input className="modal-input" value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
        <div className="modal-field">
          <label className="modal-label">Client ID (Application ID)</label>
          <input className="modal-input" value={form.client_id} onChange={e => set('client_id', e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
        <div className="modal-field">
          <label className="modal-label">Client Secret</label>
          <div className="pbi-secret-wrap">
            <input
              className="modal-input"
              type={mostrarSecret ? 'text' : 'password'}
              value={form.client_secret}
              onChange={e => set('client_secret', e.target.value)}
              placeholder="Deixe em branco para manter o atual"
            />
            <button className="pbi-secret-toggle" onClick={() => setMostrarSecret(v => !v)} type="button">
              <i className={`fa-solid ${mostrarSecret ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
            O secret é exibido mascarado após salvar. Preencha apenas para alterar.
          </div>
        </div>

        {erro && <div style={{ fontSize: 12, color: 'var(--red-500)' }}>{erro}</div>}

        <div className="cfg-save-bar">
          {feedback && (
            <span className="cfg-save-feedback">
              <i className="fa-solid fa-circle-check" /> {feedback}
            </span>
          )}
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar credenciais'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const navigate  = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const user    = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)
  const isSuperAdmin = user.perfil === SUPER_ADMIN

  const [aba, setAba] = useState('expediente')

  function handleLogout() {
    sessionStorage.removeItem('cgid_user')
    navigate('/login')
  }

  useEffect(() => {
    if (!isAdmin) navigate('/')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const abas = [
    { id: 'expediente', label: 'Expediente', icon: 'fa-clock' },
    { id: 'grupos',     label: 'Grupos de Exceção', icon: 'fa-users' },
    ...(isSuperAdmin ? [{ id: 'pbi', label: 'Credenciais Power BI', icon: 'fa-chart-pie' }] : []),
  ]

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
          <div className="sb-link" onClick={() => navigate('/workspaces')}>
            <div className="sb-icon"><i className="fa-solid fa-building-columns" /></div>
            <span className="sb-label">Workspace</span>
          </div>
          <div className="sb-link" onClick={() => navigate('/favoritos')}>
            <div className="sb-icon"><i className="fa-solid fa-bookmark" /></div>
            <span className="sb-label">Favoritos</span>
          </div>
          {isSuperAdmin && (
            <div className="sb-link" onClick={() => navigate('/auditoria')}>
              <div className="sb-icon"><i className="fa-solid fa-file-lines" /></div>
              <span className="sb-label">Auditoria</span>
            </div>
          )}
          <div className="sb-link active">
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
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Configurações</span>
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

        <div className="content-area">
          <div className="page-content">
            <div className="ph">
              <div>
                <div className="ph-title">Configurações</div>
                <div className="ph-sub">Gerencie expediente, grupos de exceção e integrações do portal</div>
              </div>
            </div>

            <div className="card">
              <div className="card-bd">
                <div className="cfg-tabs">
                  {abas.map(a => (
                    <button key={a.id} className={`cfg-tab${aba === a.id ? ' active' : ''}`} onClick={() => setAba(a.id)}>
                      <i className={`fa-solid ${a.icon}`} />
                      {a.label}
                    </button>
                  ))}
                </div>

                {aba === 'expediente' && <AbaExpediente />}
                {aba === 'grupos'     && <AbaGrupos />}
                {aba === 'pbi'        && isSuperAdmin && <AbaCredenciaisPBI />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
