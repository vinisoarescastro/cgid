import { useEffect, useState } from 'react'
import { apiFetch } from '../utils/api'

const INTERVALO_MS = 20_000

export default function SessaoGuard({ children }) {
  const [revogada, setRevogada] = useState(false)
  const [contador, setContador] = useState(15)

  function encerrar() {
    sessionStorage.removeItem('cgid_user')
    sessionStorage.removeItem('cgid_session_token')
    window.location.href = '/login?motivo=sessao_revogada'
  }

  useEffect(() => {
    function onRevogada() {
      console.log('[SessaoGuard] evento cgid:sessao_revogada recebido')
      setRevogada(true)
    }
    window.addEventListener('cgid:sessao_revogada', onRevogada)
    console.log('[SessaoGuard] listener registrado')
    return () => window.removeEventListener('cgid:sessao_revogada', onRevogada)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const token = sessionStorage.getItem('cgid_session_token')
      if (!token) return
      apiFetch('/sessao/ping').catch(() => {})
    }, INTERVALO_MS)

    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!revogada) return
    if (contador <= 0) { encerrar(); return }
    const id = setTimeout(() => setContador(c => c - 1), 1000)
    return () => clearTimeout(id)
  }, [revogada, contador])

  return (
    <>
      {children}

      {revogada && (
        <div style={estilos.overlay}>
          <div style={estilos.caixa}>
            <div style={estilos.icone}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f59e0b', fontSize: 32 }} />
            </div>
            <div style={estilos.titulo}>Sessão encerrada</div>
            <div style={estilos.texto}>
              Sua conta foi acessada em outro dispositivo e sua sessão foi encerrada automaticamente.
              Se não foi você, recomendamos alterar sua senha imediatamente.
            </div>
            <button style={estilos.botao} onClick={encerrar}>
              Fazer login novamente ({contador})
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const estilos = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  caixa: {
    background: '#fff', borderRadius: 16, padding: '40px 36px',
    maxWidth: 420, width: '90%', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  icone: { marginBottom: 16 },
  titulo: {
    fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12,
  },
  texto: {
    fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 28,
  },
  botao: {
    background: '#1d4ed8', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px 24px', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', width: '100%',
  },
}
