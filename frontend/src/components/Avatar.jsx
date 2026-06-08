import { useState } from 'react'

function getInitials(user) {
  const nome = user.nome || user.name
  if (nome) {
    const parts = nome.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const second = parts[1]?.[0] ?? ''
    return (first + second).toUpperCase()
  }
  if (user.email) {
    const local = user.email.split('@')[0]
    const parts = local.split('.')
    const first = parts[0]?.[0] ?? ''
    const last  = parts.length > 1 ? parts[1][0] : parts[0][1] ?? ''
    return (first + last).toUpperCase()
  }
  return 'US'
}

export default function Avatar({ user = {}, size = 34, radius = 10, className = '', style = {} }) {
  const [imgError, setImgError] = useState(false)
  const initials = getInitials(user)

  const base = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: Math.round(size * 0.38),
    fontWeight: 700,
    overflow: 'hidden',
    ...style,
  }

  if (user.photo && !imgError) {
    return (
      <img
        src={user.photo}
        alt={initials}
        className={className}
        style={{ ...base, objectFit: 'cover' }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className={className}
      style={{
        ...base,
        background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))',
        color: '#fff',
      }}
    >
      {initials}
    </div>
  )
}
