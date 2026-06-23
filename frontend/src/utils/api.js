const API = 'http://localhost:8000'

function getHeaders(extra = {}) {
  const user  = JSON.parse(sessionStorage.getItem('cgid_user') || '{}')
  const token = sessionStorage.getItem('cgid_session_token')
  const headers = { 'Content-Type': 'application/json', ...extra }
  if (user.id) headers['X-Usuario-Id'] = user.id
  if (token)   headers['X-Session-Token'] = token
  return headers
}

export function apiFetch(path, options = {}) {
  const { body, ...rest } = options
  return fetch(`${API}${path}`, {
    ...rest,
    headers: getHeaders(rest.headers),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(async res => {
    if (res.status === 401) {
      const data = await res.json().catch(err => {
        console.warn('[apiFetch] falha ao ler body do 401:', err)
        return {}
      })
      console.log('[apiFetch] 401 recebido, code:', data.code)
      if (data.code === 'SESSAO_REVOGADA') {
        console.log('[apiFetch] disparando evento cgid:sessao_revogada')
        window.dispatchEvent(new CustomEvent('cgid:sessao_revogada'))
      }
    }
    return res
  })
}

export async function carregarPermissoes() {
  try {
    const res = await apiFetch('/api/me/permissoes')
    if (res.ok) {
      const perms = await res.json()
      sessionStorage.setItem('cgid_permissoes', JSON.stringify(perms))
    }
  } catch (_) {}
}

export function temPermissao(modulo, acao = 'visualizar') {
  const perms = JSON.parse(sessionStorage.getItem('cgid_permissoes') || '{}')
  return perms[modulo]?.[acao] ?? false
}

export async function logout(navigate) {
  try {
    await apiFetch('/api/logout', { method: 'POST' })
  } catch (_) {}
  sessionStorage.removeItem('cgid_user')
  sessionStorage.removeItem('cgid_session_token')
  sessionStorage.removeItem('cgid_permissoes')
  if (navigate) navigate('/login')
}

export default API
