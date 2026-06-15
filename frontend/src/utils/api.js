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

export default API
