import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'
const ADMIN_PERFIS = ['master', 'administrador']

export default function TopbarExpediente() {
  const user    = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)
  const [expediente, setExpediente] = useState(null)

  useEffect(() => {
    if (!user.id) return
    const url    = isAdmin
      ? `${API}/dashboard/expediente`
      : `${API}/usuarios/${user.id}/expediente`
    const opts   = isAdmin ? {} : { headers: { 'X-Usuario-Id': user.id } }
    fetch(url, opts)
      .then(r => r.json())
      .then(setExpediente)
      .catch(() => {})
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!expediente || !expediente.configurado) return null

  const ok          = expediente.dentro_expediente
  const diaInativo  = expediente.dia_inativo
  const excecaoDia  = expediente.excecao_ativa && !expediente.hora_inicio
  const excecaoHora = expediente.excecao_ativa && !!expediente.hora_inicio

  let label, horario, stateClass
  if (isAdmin) {
    label      = ok ? 'Expediente' : 'Fora do expediente'
    horario    = expediente.hora_inicio ? `${expediente.hora_inicio} – ${expediente.hora_fim}` : null
    stateClass = ok ? 'exp-ok' : 'exp-neutral'
  } else if (diaInativo) {
    label = 'Acesso bloqueado'; stateClass = 'exp-off'
  } else if (excecaoDia) {
    label = 'Acesso especial'; stateClass = 'exp-warn'
  } else if (ok) {
    label      = 'Expediente'
    horario    = excecaoHora ? expediente.janela_excecao : `${expediente.hora_inicio} – ${expediente.hora_fim}`
    stateClass = 'exp-ok'
  } else {
    label      = 'Fora do expediente'
    horario    = `${expediente.hora_inicio} – ${expediente.hora_fim}`
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
}
