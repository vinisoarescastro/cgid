import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'
const ADMIN_PERFIS = ['master', 'administrador']

export default function TopbarExpediente() {
  const user    = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const isAdmin = ADMIN_PERFIS.includes(user.perfil)
  const [expediente, setExpediente] = useState(null)

  useEffect(() => {
    if (!user.id) return
    const url  = isAdmin ? `${API}/dashboard/expediente` : `${API}/usuarios/${user.id}/expediente`
    const opts = isAdmin ? {} : { headers: { 'X-Usuario-Id': user.id } }

    const verificar = () =>
      fetch(url, opts)
        .then(r => r.json())
        .then(data => {
          setExpediente(data)
          return data
        })
        .catch(() => null)

    const deslogar = () => {
      sessionStorage.clear()
      window.location.href = '/login'
    }

    const checarEDeslogar = () =>
      verificar().then(data => {
        if (data && !data.dentro_expediente && data.bloquear_fora) deslogar()
      })

    let timeoutId
    verificar().then(data => {
      if (!data || isAdmin || !data.hora_fim) return
      const [h, m]  = data.hora_fim.split(':').map(Number)
      const agora   = new Date()
      const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m, 0)
      const delay   = fimHoje - agora
      if (delay > 0) timeoutId = setTimeout(checarEDeslogar, delay)
    })

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checarEDeslogar()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!expediente || !expediente.configurado) return null

  const ok          = expediente.dentro_expediente
  const diaInativo  = expediente.dia_inativo
  const excecaoDia  = expediente.excecao_ativa && !expediente.hora_inicio
  const excecaoHora = expediente.excecao_ativa && !!expediente.hora_inicio

  let label, horario, stateClass
  if (isAdmin) {
    label      = ok
      ? (expediente.hora_inicio ? `Expediente: ${expediente.hora_inicio} às ${expediente.hora_fim}` : 'Expediente')
      : (expediente.hora_inicio ? `Fora do expediente: ${expediente.hora_inicio} às ${expediente.hora_fim}` : 'Fora do expediente')
    horario    = null
    stateClass = ok ? 'exp-ok' : 'exp-neutral'
  } else if (diaInativo) {
    label = 'Acesso bloqueado'; stateClass = 'exp-off'
  } else if (excecaoDia) {
    label = 'Acesso especial'; stateClass = 'exp-warn'
  } else if (ok && excecaoHora) {
    label      = expediente.janela_fim_excecao ? `Acesso em exceção até ${expediente.janela_fim_excecao}` : 'Acesso em exceção'
    horario    = null
    stateClass = 'exp-exception'
  } else if (ok) {
    label      = `Expediente: ${expediente.hora_inicio} às ${expediente.hora_fim}`
    horario    = null
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
    </div>
  )
}
