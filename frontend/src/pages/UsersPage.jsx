import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/users.css'
import Avatar from '../components/Avatar'
import Sidebar from '../components/Sidebar'
import TopbarExpediente from '../components/TopbarExpediente'
import { apiFetch, logout, temPermissao } from '../utils/api'

const API = 'http://localhost:8000'

const PERFIS = [
  { value: 'master',        label: 'Master' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'coordenador',   label: 'Coordenador' },
  { value: 'colaborador',   label: 'Colaborador' },
  { value: 'convidado',     label: 'Convidado' },
]

const STATUS = [
  { value: 'ativo',     label: 'Ativo' },
  { value: 'inativo',   label: 'Inativo' },
  { value: 'bloqueado', label: 'Bloqueado' },
]

const PERFIL_LABELS = {
  master:        'Master',
  administrador: 'Administrador',
  coordenador:   'Coordenador',
  colaborador:   'Colaborador',
  convidado:     'Convidado',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const NIVEL_LABELS = {
  total:             'Acesso total',
  apenas_relatorios: 'Relatórios específicos',
}

// ─── Modal Departamentos ──────────────────────────────────────────────────────
function ModalDepartamentos({ onClose, onChange }) {
  const [deps, setDeps]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [formNome, setFormNome]   = useState('')
  const [formCod, setFormCod]     = useState('')
  const [formDesc, setFormDesc]   = useState('')
  const [editando, setEditando]   = useState(null) // dep obj
  const [erro, setErro]           = useState('')
  const [salvando, setSalvando]   = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/departamentos?apenas_ativos=false`)
      setDeps(await r.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function iniciarEdicao(dep) {
    setEditando(dep)
    setFormNome(dep.nome)
    setFormCod(dep.codigo ?? '')
    setFormDesc(dep.descricao ?? '')
    setErro('')
  }

  function cancelarEdicao() {
    setEditando(null)
    setFormNome('')
    setFormCod('')
    setFormDesc('')
    setErro('')
  }

  async function salvar() {
    if (!formNome.trim()) { setErro('Nome obrigatório.'); return }
    setSalvando(true); setErro('')
    try {
      const body = { nome: formNome.trim(), codigo: formCod.trim() || null, descricao: formDesc.trim() || null }
      const r = editando
        ? await apiFetch(`/departamentos/${editando.id}`, { method: 'PUT', body })
        : await apiFetch('/departamentos', { method: 'POST', body })
      if (r.status === 409) { setErro('Já existe um departamento com esse nome.'); return }
      if (!r.ok) throw new Error()
      cancelarEdicao()
      await carregar()
      onChange()
    } catch {
      setErro('Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function desativar(dep) {
    await apiFetch(`/departamentos/${dep.id}`, { method: 'DELETE' })
    await carregar()
    onChange()
  }

  async function reativar(dep) {
    await apiFetch(`/departamentos/${dep.id}`, { method: 'PUT', body: { ativo: true } })
    await carregar()
    onChange()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-hd">
          <span className="modal-title">Gerenciar Departamentos</span>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="modal-bd" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Formulário */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: 'var(--gray-50)', borderRadius: 'var(--r-md)', border: '1px solid var(--gray-200)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {editando ? 'Editar departamento' : 'Novo departamento'}
            </div>
            <div className="form-grid-2">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nome *</label>
                <input className="form-input" value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Ex: Financeiro" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Código</label>
                <input className="form-input" value={formCod} onChange={e => setFormCod(e.target.value)} placeholder="Ex: FIN" />
              </div>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Descrição</label>
              <input className="form-input" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Opcional" />
            </div>
            {erro && <div style={{ fontSize: 12, color: '#b91c1c' }}>{erro}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {editando && (
                <button className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={cancelarEdicao}>Cancelar</button>
              )}
              <button className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={salvar} disabled={salvando}>
                {salvando ? <><i className="fa-solid fa-circle-notch fa-spin" /> Salvando…</> : editando ? <><i className="fa-solid fa-floppy-disk" /> Salvar</> : <><i className="fa-solid fa-plus" /> Adicionar</>}
              </button>
            </div>
          </div>

          {/* Lista */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>
              <i className="fa-solid fa-circle-notch fa-spin" />
            </div>
          ) : deps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)', fontSize: 13 }}>
              Nenhum departamento cadastrado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {deps.map(dep => (
                <div key={dep.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 'var(--r-md)',
                  border: `1px solid ${dep.ativo ? 'var(--gray-200)' : 'var(--gray-100)'}`,
                  background: dep.ativo ? '#fff' : 'var(--gray-50)',
                  opacity: dep.ativo ? 1 : 0.6,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {dep.nome}
                      {dep.codigo && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>{dep.codigo}</span>}
                      {!dep.ativo && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-400)', background: 'var(--gray-100)', borderRadius: 99, padding: '1px 7px' }}>Inativo</span>}
                    </div>
                    {dep.descricao && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{dep.descricao}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn-action" title="Editar" onClick={() => iniciarEdicao(dep)}>
                      <i className="fa-solid fa-pen" />
                    </button>
                    {dep.ativo ? (
                      <button className="btn-action danger" title="Desativar" onClick={() => desativar(dep)}>
                        <i className="fa-solid fa-ban" />
                      </button>
                    ) : (
                      <button className="btn-action success" title="Reativar" onClick={() => reativar(dep)}>
                        <i className="fa-solid fa-circle-check" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-ft">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de Criar/Editar ────────────────────────────────────────────────────
function ModalUsuario({ usuario, acessosIniciais = [], departamentos = [], onClose, onSave }) {
  const editando = !!usuario
  const [abaAtiva, setAbaAtiva] = useState('dados')
  const [form, setForm] = useState({
    nome:            usuario?.nome            ?? '',
    email:           usuario?.email           ?? '',
    perfil:          usuario?.perfil          ?? 'colaborador',
    status:          usuario?.status          ?? 'ativo',
    senha:           '',
    departamento_id: usuario?.departamento_id ?? '',
  })
  const [erros, setErros]       = useState({})
  const [loading, setLoading]   = useState(false)
  const [workspaces, setWorkspaces] = useState([])
  const [acessos, setAcessos]   = useState(
    acessosIniciais.map(a => ({ espaco_trabalho_id: a.espaco_trabalho_id, nivel_acesso: a.nivel_acesso }))
  )
  const [relatoriosWs, setRelatoriosWs]   = useState({})
  const [relatoriosSel, setRelatoriosSel] = useState({})

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
        const parciais = acessosFinais.filter(a => a.nivel_acesso === 'apenas_relatorios')
        parciais.forEach(a => carregarRelatoriosWs(a.espaco_trabalho_id, true))
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function carregarRelatoriosWs(wsId, carregarSelecionados = false) {
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
    if (Object.keys(e2).length) {
      setErros(e2)
      if (editando) setAbaAtiva('dados')
      return
    }
    setLoading(true)
    try {
      const body = { nome: form.nome, email: form.email, perfil: form.perfil, departamento_id: form.departamento_id || null }
      if (!editando) body.senha = form.senha
      if (editando) {
        body.status = form.status
        if (form.senha) body.senha = form.senha
      }
      const res = await apiFetch(
        editando ? `/usuarios/${usuario.id}` : `/usuarios`,
        { method: editando ? 'PUT' : 'POST', body }
      )
      if (res.status === 409) { setErros({ email: 'E-mail já cadastrado.' }); if (editando) setAbaAtiva('dados'); return }
      if (!res.ok) throw new Error()
      const data = await res.json()
      await apiFetch(`/usuarios/${data.id}/acessos`, { method: 'PUT', body: acessos })
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

  // conteúdo da seção de workspaces (reutilizado em tab e em criação)
  const conteudoWorkspaces = (
    <div className="form-group">
      {!editando && <label className="form-label">Acesso a Workspaces</label>}
      {['master', 'administrador'].includes(form.perfil) ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 'var(--r-md)',
          background: 'var(--brand-50)', border: '1px solid var(--brand-200)',
          color: 'var(--brand-700)', fontSize: 13,
        }}>
          <i className="fa-solid fa-shield-halved" />
          <span>
            <strong>Acesso total</strong> — Master e Admin têm acesso a todos os workspaces e relatórios automaticamente.
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
                    <input type="checkbox" checked={ativo} onChange={() => toggleWorkspace(ws.id)} />
                    <span className="ws-acesso-icon" style={{ background: ws.cor ? ws.cor + '22' : 'var(--gray-100)', color: ws.cor ?? 'var(--gray-500)' }}>
                      <i className={ws.icone ? `fa-solid ${ws.icone}` : 'fa-solid fa-building'} />
                    </span>
                    <span className="ws-acesso-nome">{ws.nome}</span>
                  </label>
                  {ativo && (
                    <select className="ws-acesso-nivel" value={acesso.nivel_acesso} onChange={e => setNivel(ws.id, e.target.value)}>
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
                          <input type="checkbox" checked={marcado} onChange={() => toggleRelatorio(ws.id, rel.id)} />
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
  )

  const showFooter = true

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${editando ? ' modal-lg' : ''}`} style={!editando ? { maxWidth: 580 } : undefined}>
        <div className="modal-hd">
          <span className="modal-title">{editando ? 'Editar usuário' : 'Novo usuário'}</span>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        {editando && (
          <div className="modal-tabs">
            {[
              { id: 'dados',       label: 'Dados',       icon: 'fa-user' },
              { id: 'workspaces',  label: 'Workspaces',  icon: 'fa-building' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`modal-tab${abaAtiva === tab.id ? ' active' : ''}`}
                onClick={() => setAbaAtiva(tab.id)}
              >
                <i className={`fa-solid ${tab.icon}`} />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-bd">
            {erros.geral && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-sm)', color: '#b91c1c', fontSize: 13 }}>
                {erros.geral}
              </div>
            )}

            {/* ── Tab Dados (ou bloco único em criação) ── */}
            {(!editando || abaAtiva === 'dados') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  <label className="form-label">Departamento</label>
                  <select className="form-select" value={form.departamento_id} onChange={e => setForm(p => ({ ...p, departamento_id: e.target.value }))}>
                    <option value="">Sem departamento</option>
                    {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
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

                {/* Workspaces aparece junto com dados apenas na criação */}
                {!editando && conteudoWorkspaces}
              </div>
            )}

            {/* ── Tab Workspaces (só quando editando) ── */}
            {editando && abaAtiva === 'workspaces' && conteudoWorkspaces}

          </div>

          {showFooter && (
            <div className="modal-ft">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><i className="fa-solid fa-circle-notch fa-spin" /> Salvando…</> : <><i className="fa-solid fa-floppy-disk" /> Salvar</>}
              </button>
            </div>
          )}
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
  const currentUser = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const podeCriar   = temPermissao('usuarios', 'criar')
  const podeEditar  = temPermissao('usuarios', 'editar')
  const podeExcluir = temPermissao('usuarios', 'excluir')

  useEffect(() => {
    if (!temPermissao('usuarios')) navigate('/')
    fetch(`${API}/departamentos`).then(r => r.json()).then(setDepartamentos).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [usuarios, setUsuarios]   = useState([])
  const [acessosMap, setAcessosMap] = useState({}) // { userId: [{nome, nivel_acesso}] }
  const [departamentos, setDepartamentos] = useState([])
  const [busca, setBusca]         = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('')
  const [loading, setLoading]     = useState(true)

  const [modalEditar, setModalEditar]     = useState(null)  // null | usuario
  const [modalNovo, setModalNovo]         = useState(false)
  const [modalExcluir, setModalExcluir]   = useState(null)  // null | usuario
  const [modalResetSenha, setModalResetSenha] = useState(null) // null | usuario
  const [modalDeps, setModalDeps]         = useState(false)
  const podeGerenciarDeps = temPermissao('usuarios', 'gerenciar')

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

  function recarregarDepartamentos() {
    fetch(`${API}/departamentos`).then(r => r.json()).then(setDepartamentos).catch(() => {})
  }

  function handleLogout() { logout(navigate) }

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <Sidebar user={currentUser} active="usuarios" />

      {/* ── App Body ── */}
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Usuários</span>
          </div>
          <div className="topbar-actions">
            <TopbarExpediente />
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
              <div style={{ display: 'flex', gap: 8 }}>
                {podeGerenciarDeps && (
                  <button className="btn-secondary" onClick={() => setModalDeps(true)}>
                    <i className="fa-solid fa-sitemap" /> Departamentos
                  </button>
                )}
                {podeCriar && (
                  <button className="btn-primary" onClick={() => setModalNovo(true)}>
                    <i className="fa-solid fa-plus" /> Novo Usuário
                  </button>
                )}
              </div>
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
                        <th>Perfil</th>
                        <th>Departamento</th>
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
                          <td>
                            <span className={`perfil-badge perfil-${u.perfil}`}>
                              {PERFIL_LABELS[u.perfil]}
                            </span>
                          </td>
                          <td style={{ color: 'var(--gray-500)', fontSize: 13 }}>
                            {u.departamento_nome ?? <span style={{ color: 'var(--gray-300)' }}>—</span>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {['master', 'administrador'].includes(u.perfil) ? (
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
                              {podeEditar && (
                                <button className="btn-action" title="Editar" onClick={() => setModalEditar(u)}>
                                  <i className="fa-solid fa-pen" />
                                </button>
                              )}
                              {podeEditar && (
                                <button className="btn-action" title="Resetar senha para Mudar@123" onClick={() => setModalResetSenha(u)}>
                                  <i className="fa-solid fa-key" />
                                </button>
                              )}
                              {podeEditar && (u.status === 'bloqueado' ? (
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
                              ))}
                              {podeExcluir && (
                                <button className="btn-action danger" title="Excluir" onClick={() => setModalExcluir(u)}>
                                  <i className="fa-solid fa-trash" />
                                </button>
                              )}
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
      {modalDeps && (
        <ModalDepartamentos
          onClose={() => setModalDeps(false)}
          onChange={recarregarDepartamentos}
        />
      )}
      {(modalNovo || modalEditar) && (
        <ModalUsuario
          usuario={modalEditar}
          acessosIniciais={modalEditar ? (acessosMap[modalEditar.id] ?? []) : []}
          departamentos={departamentos}
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
