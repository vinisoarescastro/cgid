import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/home.css'
import '../styles/settings.css'
import '../styles/access-control.css'
import Avatar from '../components/Avatar'
import Sidebar from '../components/Sidebar'
import TopbarExpediente from '../components/TopbarExpediente'
import { apiFetch, logout, temPermissao } from '../utils/api'

const MODULOS_LABEL = {
  usuarios:       'Usuários',
  permissoes:     'Permissões',
  relatorios:     'Relatórios',
  workspaces:     'Workspaces',
  auditoria:      'Auditoria',
  seguranca:      'Segurança',
  configuracoes:  'Configurações',
  expediente:     'Expediente',
  grupos_excecao: 'Grupos de Exceção',
  landbank:       'Land Bank',
}

const PERFIS_LABEL = {
  master:        'Master',
  administrador: 'Administrador',
  coordenador:   'Coordenador',
  colaborador:   'Colaborador',
  convidado:     'Convidado',
}

const ACOES = ['visualizar', 'criar', 'editar', 'excluir', 'exportar', 'gerenciar']
const ACOES_LABEL = {
  visualizar: 'Ver', criar: 'Criar', editar: 'Editar',
  excluir: 'Excluir', exportar: 'Exportar', gerenciar: 'Gerenciar',
}

const GRUPOS_MODULOS = {
  'Acesso e Dados': ['usuarios', 'permissoes', 'relatorios', 'landbank'],
  'Operações':      ['workspaces', 'expediente', 'grupos_excecao'],
  'Administração':  ['auditoria', 'seguranca', 'configuracoes'],
}

const PERFIS_OPCOES = [
  { value: 'master',        label: 'Master' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'coordenador',   label: 'Coordenador' },
  { value: 'colaborador',   label: 'Colaborador' },
  { value: 'convidado',     label: 'Convidado' },
]

const POR_PAGINA = 10

// ─── Paginação ────────────────────────────────────────────────────────────────
function Paginacao({ pagina, total, onMudar }) {
  if (total <= 1) return null
  const paginas = Array.from({ length: total }, (_, i) => i + 1)
  return (
    <div className="ac-paginacao">
      <button className="ac-pag-btn" disabled={pagina === 1} onClick={() => onMudar(pagina - 1)}>
        <i className="fa-solid fa-chevron-left" />
      </button>
      {paginas.map(p => {
        const mostrar = p === 1 || p === total || Math.abs(p - pagina) <= 1
        if (!mostrar) {
          if ((p === 2 && pagina > 3) || (p === total - 1 && pagina < total - 2)) {
            return <span key={p} className="ac-pag-ellipsis">…</span>
          }
          return null
        }
        return (
          <button key={p} className={`ac-pag-btn${p === pagina ? ' active' : ''}`} onClick={() => onMudar(p)}>
            {p}
          </button>
        )
      })}
      <button className="ac-pag-btn" disabled={pagina === total} onClick={() => onMudar(pagina + 1)}>
        <i className="fa-solid fa-chevron-right" />
      </button>
    </div>
  )
}

// ─── Modal de Pacote ──────────────────────────────────────────────────────────
function ModalPacote({ pacote, onClose, onSave }) {
  const editando = !!pacote
  const [nome, setNome]           = useState(pacote?.nome ?? '')
  const [descricao, setDescricao] = useState(pacote?.descricao ?? '')
  const [itens, setItens] = useState(() => {
    const base = {}
    Object.keys(MODULOS_LABEL).forEach(m => {
      const ex = pacote?.itens?.find(i => i.modulo === m)
      base[m] = ex
        ? { ...ex }
        : { pode_visualizar: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_exportar: false, pode_gerenciar: false }
    })
    return base
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')
  const [gruposAbertos, setGruposAbertos] = useState(
    Object.fromEntries(Object.keys(GRUPOS_MODULOS).map(g => [g, true]))
  )

  function toggleAcao(modulo, campo) {
    setItens(prev => ({ ...prev, [modulo]: { ...prev[modulo], [campo]: !prev[modulo][campo] } }))
  }

  async function handleSave() {
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    setLoading(true); setErro('')
    try {
      const body = {
        nome: nome.trim(), descricao: descricao.trim() || null,
        itens: Object.entries(itens)
          .filter(([, v]) => ACOES.some(a => v[`pode_${a}`]))
          .map(([modulo, v]) => ({ modulo, ...v })),
      }
      const res = await apiFetch(
        editando ? `/api/controle-acesso/pacotes/${pacote.id}` : '/api/controle-acesso/pacotes',
        { method: editando ? 'PUT' : 'POST', body }
      )
      if (res.status === 409) { setErro('Já existe um pacote com esse nome.'); return }
      if (!res.ok) throw new Error()
      onSave()
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-hd">
          <span className="modal-title">{editando ? 'Editar pacote' : 'Novo pacote de permissões'}</span>
          <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="modal-bd">
          {erro && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--r-sm)', color: '#b91c1c', fontSize: 13 }}>
              {erro}
            </div>
          )}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Nome do pacote *</label>
              <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Acesso Land Bank" />
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <input className="form-input" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição opcional" />
            </div>
          </div>
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Permissões concedidas</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 }}>
              Permissões aditivas — somam-se às permissões do papel do usuário.
            </div>
            {Object.entries(GRUPOS_MODULOS).map(([grupo, modulos]) => (
              <div key={grupo} className="perm-group" style={{ marginBottom: 8 }}>
                <button className="perm-group-header" onClick={() => setGruposAbertos(prev => ({ ...prev, [grupo]: !prev[grupo] }))}>
                  <i className={`fa-solid ${gruposAbertos[grupo] !== false ? 'fa-chevron-down' : 'fa-chevron-right'} perm-group-chevron`} />
                  <span className="perm-group-title">{grupo}</span>
                </button>
                {gruposAbertos[grupo] !== false && modulos.map(modulo => (
                  <div key={modulo} className="perm-row">
                    <div className="perm-row-nome">{MODULOS_LABEL[modulo]}</div>
                    <div className="perm-chips">
                      {ACOES.map(a => {
                        const campo = `pode_${a}`
                        const ativo = !!itens[modulo]?.[campo]
                        return (
                          <button
                            key={a}
                            type="button"
                            className={`perm-chip${ativo ? ' perm-chip-on' : ' perm-chip-off'}`}
                            onClick={() => toggleAcao(modulo, campo)}
                          >
                            <i className={`fa-solid ${ativo ? 'fa-check' : 'fa-xmark'}`} />
                            {ACOES_LABEL[a]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-ft">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <><i className="fa-solid fa-circle-notch fa-spin" /> Salvando…</> : <><i className="fa-solid fa-floppy-disk" /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Pacotes ──────────────────────────────────────────────────────────────
function AbaPacotes({ podeEditar }) {
  const [pacotes, setPacotes]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [modalNovo, setModalNovo]     = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [confirmExcluir, setConfirmExcluir] = useState(null)
  const [excluindo, setExcluindo]     = useState(false)

  const carregar = useCallback(() => {
    setLoading(true)
    apiFetch('/api/controle-acesso/pacotes')
      .then(r => r.json())
      .then(setPacotes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function handleExcluir(id) {
    setExcluindo(true)
    await apiFetch(`/api/controle-acesso/pacotes/${id}`, { method: 'DELETE' })
    setConfirmExcluir(null)
    setExcluindo(false)
    carregar()
  }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>
  )

  return (
    <div>
      <div className="ac-toolbar">
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Pacotes de permissões</div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
            Conjuntos reutilizáveis de permissões atribuídos a usuários individualmente.
          </div>
        </div>
        {podeEditar && (
          <button className="btn btn-primary btn-sm" onClick={() => setModalNovo(true)}>
            <i className="fa-solid fa-plus" /> Novo pacote
          </button>
        )}
      </div>

      {pacotes.length === 0 ? (
        <div className="ac-empty">
          <i className="fa-solid fa-box-open" />
          <div>Nenhum pacote criado ainda.</div>
          {podeEditar && (
            <button className="btn btn-primary btn-sm" onClick={() => setModalNovo(true)}>
              Criar primeiro pacote
            </button>
          )}
        </div>
      ) : (
        <div className="ac-pacotes-grid">
          {pacotes.map(p => {
            const totalAcoes = p.itens.reduce((sum, i) => sum + ACOES.filter(a => i[`pode_${a}`]).length, 0)
            return (
              <div key={p.id} className="ac-pacote-card">
                <div className="ac-pacote-header">
                  <div className="ac-pacote-icon"><i className="fa-solid fa-box" /></div>
                  <div style={{ flex: 1 }}>
                    <div className="ac-pacote-nome">{p.nome}</div>
                    {p.descricao && <div className="ac-pacote-desc">{p.descricao}</div>}
                  </div>
                  {podeEditar && (
                    <div className="ac-pacote-actions">
                      <button className="icon-btn" onClick={() => setModalEditar(p)} title="Editar">
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setConfirmExcluir(p)} title="Excluir">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="ac-pacote-stats">
                  <span><i className="fa-solid fa-users" /> {p.n_usuarios} usuário{p.n_usuarios !== 1 ? 's' : ''}</span>
                  <span><i className="fa-solid fa-shield-check" /> {totalAcoes} permissão{totalAcoes !== 1 ? 'ões' : ''}</span>
                  <span><i className="fa-solid fa-layer-group" /> {p.itens.length} módulo{p.itens.length !== 1 ? 's' : ''}</span>
                </div>
                {p.itens.length > 0 && (
                  <div className="ac-pacote-modulos">
                    {p.itens.map(item => (
                      <span key={item.modulo} className="ac-modulo-chip">
                        {MODULOS_LABEL[item.modulo] || item.modulo}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modalNovo && (
        <ModalPacote onClose={() => setModalNovo(false)} onSave={() => { setModalNovo(false); carregar() }} />
      )}
      {modalEditar && (
        <ModalPacote pacote={modalEditar} onClose={() => setModalEditar(null)} onSave={() => { setModalEditar(null); carregar() }} />
      )}
      {confirmExcluir && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmExcluir(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="confirm-body">
              <div className="confirm-icon"><i className="fa-solid fa-trash" /></div>
              <div className="confirm-title">Excluir pacote?</div>
              <div className="confirm-desc">
                Tem certeza que deseja excluir <strong>{confirmExcluir.nome}</strong>?
                {confirmExcluir.n_usuarios > 0 && (
                  <><br /><span style={{ color: '#b91c1c' }}>
                    Está atribuído a {confirmExcluir.n_usuarios} usuário{confirmExcluir.n_usuarios !== 1 ? 's' : ''} e será removido deles.
                  </span></>
                )}
              </div>
            </div>
            <div className="modal-ft">
              <button className="btn-secondary" onClick={() => setConfirmExcluir(null)}>Cancelar</button>
              <button className="btn-danger" onClick={() => handleExcluir(confirmExcluir.id)} disabled={excluindo}>
                {excluindo ? <><i className="fa-solid fa-circle-notch fa-spin" /> Excluindo…</> : <><i className="fa-solid fa-trash" /> Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba Usuários ─────────────────────────────────────────────────────────────
function AbaUsuarios({ podeEditar, isMaster }) {
  const [usuarios, setUsuarios] = useState([])
  const [pacotes, setPacotes]   = useState([])
  const [loading, setLoading]   = useState(true)
  // local = { [uid]: { perfil?: string, pacotes?: string[] } }
  const [local, setLocal]       = useState({})
  const [salvando, setSalvando] = useState(false)
  const [erros, setErros]       = useState({})
  const [salvoOk, setSalvoOk]   = useState(false)
  const [busca, setBusca]       = useState('')
  const [filtroPerfil, setFiltroPerfil] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [pagina, setPagina]     = useState(1)
  const [popoverUid, setPopoverUid] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, pRes] = await Promise.all([
        apiFetch('/api/controle-acesso/usuarios').then(r => r.json()),
        apiFetch('/api/controle-acesso/pacotes').then(r => r.json()),
      ])
      setUsuarios(uRes)
      setPacotes(pRes)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setPagina(1) }, [busca, filtroPerfil, filtroStatus])

  // ── Estado efetivo (local sobrepõe original) ──
  function getEfetivoPerfil(u) { return local[u.id]?.perfil ?? u.perfil }
  function getEfetivoPacotes(u) {
    return local[u.id]?.pacotes ?? (u.pacotes || []).map(p => p.id)
  }

  // ── Detecta se o usuário tem alterações pendentes ──
  function temAlteracoes(u) {
    const c = local[u.id]
    if (!c) return false
    if (c.perfil !== undefined && c.perfil !== u.perfil) return true
    if (c.pacotes !== undefined) {
      const orig = (u.pacotes || []).map(p => p.id).sort().join(',')
      return [...c.pacotes].sort().join(',') !== orig
    }
    return false
  }

  const nAlteracoes = useMemo(
    () => usuarios.filter(u => temAlteracoes(u)).length,
    [usuarios, local] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // ── Filtro + paginação ──
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const efPerfil = local[u.id]?.perfil ?? u.perfil
      if (filtroPerfil && efPerfil !== filtroPerfil) return false
      if (filtroStatus && u.status !== filtroStatus) return false
      if (busca) {
        const q = busca.toLowerCase()
        return u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      }
      return true
    })
  }, [usuarios, local, busca, filtroPerfil, filtroStatus])

  const totalPaginas  = Math.max(1, Math.ceil(usuariosFiltrados.length / POR_PAGINA))
  const paginaAtual   = Math.min(pagina, totalPaginas)
  const usuariosPagina = usuariosFiltrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  // ── Mutações locais ──
  function setPerfil(uid, perfil) {
    setLocal(prev => ({ ...prev, [uid]: { ...prev[uid], perfil } }))
  }

  function togglePacoteLocal(uid, pacoteId, efetivos) {
    const novos = efetivos.includes(pacoteId)
      ? efetivos.filter(id => id !== pacoteId)
      : [...efetivos, pacoteId]
    setLocal(prev => ({ ...prev, [uid]: { ...prev[uid], pacotes: novos } }))
  }

  // ── Salvar tudo ──
  async function salvarTudo() {
    setSalvando(true)
    setErros({})

    const tarefas = []
    for (const u of usuarios) {
      if (!temAlteracoes(u)) continue
      const c = local[u.id] || {}

      if (c.perfil !== undefined && c.perfil !== u.perfil) {
        const uid = u.id
        tarefas.push({
          uid,
          fn: () => apiFetch(`/api/controle-acesso/usuarios/${uid}/papel`, { method: 'PATCH', body: { perfil: c.perfil } }),
        })
      }

      if (c.pacotes !== undefined) {
        const origIds = new Set((u.pacotes || []).map(p => p.id))
        const newIds  = new Set(c.pacotes)
        const uid = u.id
        for (const id of origIds) {
          if (!newIds.has(id)) {
            const pid = id
            tarefas.push({ uid, fn: () => apiFetch(`/api/controle-acesso/usuarios/${uid}/pacotes/${pid}`, { method: 'DELETE' }) })
          }
        }
        for (const id of newIds) {
          if (!origIds.has(id)) {
            const pid = id
            tarefas.push({ uid, fn: () => apiFetch(`/api/controle-acesso/usuarios/${uid}/pacotes/${pid}`, { method: 'POST' }) })
          }
        }
      }
    }

    const resultados = await Promise.allSettled(tarefas.map(t => t.fn()))
    const novosErros = {}
    resultados.forEach((r, i) => {
      if (r.status === 'rejected' || (r.value && !r.value.ok)) {
        const uid = tarefas[i].uid
        novosErros[uid] = novosErros[uid] || 'Erro ao salvar.'
      }
    })

    await carregar()
    setLocal({})
    setErros(novosErros)
    if (!Object.keys(novosErros).length) {
      setSalvoOk(true)
      setTimeout(() => setSalvoOk(false), 2500)
    }
    setSalvando(false)
  }

  function descartar() { setLocal({}); setErros({}) }

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>Carregando...</div>
  )

  return (
    <div style={{ position: 'relative' }} onClick={() => setPopoverUid(null)}>

      {/* ── Filtros ── */}
      <div className="ac-toolbar" style={{ marginBottom: 16 }}>
        <div className="perm-search-wrap" style={{ flex: 1 }}>
          <i className="fa-solid fa-magnifying-glass perm-search-icon" />
          <input className="perm-search" placeholder="Buscar por nome ou e-mail…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 160, fontSize: 12 }} value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value)}>
          <option value="">Todos os papéis</option>
          {PERFIS_OPCOES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select className="form-select" style={{ width: 140, fontSize: 12 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
          <option value="bloqueado">Bloqueado</option>
        </select>
      </div>

      {/* ── Tabela ── */}
      <div className="ac-users-table">
        <div className="ac-users-header">
          <div>Usuário</div>
          <div>Papel</div>
          <div>Pacotes de permissão</div>
          <div>Status</div>
        </div>

        {usuariosPagina.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--gray-400)' }}>
            Nenhum usuário encontrado.
          </div>
        ) : (
          usuariosPagina.map(u => {
            const efPerfil  = getEfetivoPerfil(u)
            const efPacotes = getEfetivoPacotes(u)
            const alterado  = temAlteracoes(u)
            const temErro   = erros[u.id]
            const podeAlterar = podeEditar && (isMaster || u.perfil !== 'master')
            const mostrarPopover = popoverUid === u.id

            return (
              <div key={u.id} className={`ac-user-row${alterado ? ' ac-row-alterado' : ''}`}>
                {/* ─ Usuário ─ */}
                <div className="ac-col-user">
                  <div className="ac-user-avatar">
                    {u.foto_url
                      ? <img src={u.foto_url} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} alt="" />
                      : (u.nome || u.email)[0].toUpperCase()
                    }
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{u.nome}</span>
                      {alterado && <span className="ac-badge-alterado">não salvo</span>}
                      {temErro && <span className="ac-badge-erro"><i className="fa-solid fa-circle-exclamation" /> {temErro}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{u.email}</div>
                  </div>
                </div>

                {/* ─ Papel ─ */}
                <div className="ac-col-papel">
                  {podeAlterar ? (
                    <select
                      className={`ac-papel-select ac-papel-${efPerfil}`}
                      value={efPerfil}
                      onChange={e => setPerfil(u.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      {PERFIS_OPCOES
                        .filter(p => isMaster || p.value !== 'master')
                        .map(p => <option key={p.value} value={p.value}>{p.label}</option>)
                      }
                    </select>
                  ) : (
                    <span className={`ac-papel-badge ac-papel-${efPerfil}`}>{PERFIS_LABEL[efPerfil]}</span>
                  )}
                </div>

                {/* ─ Pacotes ─ */}
                <div className="ac-col-pacotes" onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    {/* Chips dos pacotes atribuídos */}
                    {efPacotes.map(pid => {
                      const pacote = pacotes.find(p => p.id === pid)
                      if (!pacote) return null
                      return (
                        <span key={pid} className="ac-pacote-chip">
                          {pacote.nome}
                          {podeAlterar && (
                            <button
                              className="ac-chip-remove"
                              onClick={() => togglePacoteLocal(u.id, pid, efPacotes)}
                              title="Remover pacote"
                            >
                              <i className="fa-solid fa-xmark" />
                            </button>
                          )}
                        </span>
                      )
                    })}

                    {/* Botão para abrir seletor de pacotes */}
                    {podeAlterar && pacotes.length > 0 && (
                      <div style={{ position: 'relative' }}>
                        <button
                          className="ac-add-pacote-btn"
                          onClick={() => setPopoverUid(mostrarPopover ? null : u.id)}
                          title="Gerenciar pacotes"
                        >
                          <i className="fa-solid fa-plus" />
                        </button>

                        {mostrarPopover && (
                          <div className="ac-pacote-popover" onClick={e => e.stopPropagation()}>
                            <div className="ac-popover-title">Pacotes de permissão</div>
                            <div className="ac-popover-list">
                              {pacotes.map(p => {
                                const atribuido = efPacotes.includes(p.id)
                                return (
                                  <label key={p.id} className={`ac-popover-check${atribuido ? ' on' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={atribuido}
                                      onChange={() => togglePacoteLocal(u.id, p.id, efPacotes)}
                                    />
                                    <div className="ac-popover-check-info">
                                      <span className="ac-popover-check-nome">{p.nome}</span>
                                      {p.descricao && <span className="ac-popover-check-desc">{p.descricao}</span>}
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vazio */}
                    {efPacotes.length === 0 && !podeAlterar && (
                      <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>—</span>
                    )}
                  </div>
                </div>

                {/* ─ Status ─ */}
                <div className="ac-col-status">
                  <span className={`ac-status-badge ac-status-${u.status}`}>
                    {u.status === 'ativo' ? 'Ativo' : u.status === 'inativo' ? 'Inativo' : 'Bloqueado'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Rodapé: paginação + contagem ── */}
      <div className="ac-table-footer">
        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
          {usuariosFiltrados.length} usuário{usuariosFiltrados.length !== 1 ? 's' : ''}
          {usuariosFiltrados.length !== usuarios.length && ` de ${usuarios.length}`}
        </span>
        <Paginacao pagina={paginaAtual} total={totalPaginas} onMudar={setPagina} />
      </div>

      {/* ── Barra de salvamento ── */}
      {nAlteracoes > 0 && (
        <div className="perm-save-bar">
          <span className="perm-save-info">
            <i className="fa-solid fa-circle-dot" />
            {nAlteracoes} usuário{nAlteracoes > 1 ? 's' : ''} com alterações não salvas
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={descartar} disabled={salvando}>
              Descartar
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={salvarTudo} disabled={salvando}>
              {salvando
                ? <><i className="fa-solid fa-spinner fa-spin" /> Salvando...</>
                : salvoOk
                  ? <><i className="fa-solid fa-check" /> Salvo</>
                  : <><i className="fa-solid fa-floppy-disk" /> Salvar alterações</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AccessControlPage() {
  const navigate  = useNavigate()
  const user      = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isMaster  = user.perfil === 'master'
  const isAdmin   = ['master', 'administrador'].includes(user.perfil)
  const podeEditar = temPermissao('permissoes', 'editar')
  const [aba, setAba] = useState('pacotes')

  useEffect(() => {
    if (!temPermissao('permissoes')) navigate('/')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleLogout() { logout(navigate) }

  return (
    <div className="app-shell">
      <Sidebar user={user} active="controle-acesso" />
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span className="bc-item">Portal</span>
            <span className="bc-sep"><i className="fa-solid fa-chevron-right" /></span>
            <span className="bc-current">Controle de Acesso</span>
          </div>
          <div className="topbar-actions">
            <TopbarExpediente />
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
                <div className="ph-title">Controle de Acesso</div>
                <div className="ph-sub">Gerencie pacotes de permissões e atribuições dos usuários</div>
              </div>
            </div>

            <div className="card">
              <div className="card-bd">
                <div className="cfg-tabs">
                  {isAdmin && (
                    <button className={`cfg-tab${aba === 'pacotes' ? ' active' : ''}`} onClick={() => setAba('pacotes')}>
                      <i className="fa-solid fa-box" /> Pacotes
                    </button>
                  )}
                  {isAdmin && (
                    <button className={`cfg-tab${aba === 'usuarios' ? ' active' : ''}`} onClick={() => setAba('usuarios')}>
                      <i className="fa-solid fa-users" /> Usuários
                    </button>
                  )}
                </div>

                {aba === 'pacotes'  && isAdmin && <AbaPacotes podeEditar={podeEditar} />}
                {aba === 'usuarios' && isAdmin && <AbaUsuarios podeEditar={podeEditar} isMaster={isMaster} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
