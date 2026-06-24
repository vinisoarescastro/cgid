import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoSidebarFull from '../assets/logo-sidebar-full.png'
import logoSidebarIcon from '../assets/logo-sidebar-icon.png'
import Avatar from './Avatar'
import { temPermissao } from '../utils/api'

const PERFIL_LABEL = {
  master:        'Master',
  administrador: 'Administrador',
  coordenador:   'Coordenador',
  colaborador:   'Colaborador',
  convidado:     'Convidado',
}

export default function Sidebar({ user, active }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(() => sessionStorage.getItem('sidebar_expanded') === '1')

  const isAdmin = ['master', 'administrador'].includes(user?.perfil)
  const isSuperAdmin = user?.perfil === 'master'

  const toggle = () => setExpanded(v => {
    sessionStorage.setItem('sidebar_expanded', v ? '' : '1')
    return !v
  })

  const link = (key, path, icon, label) => {
    const isActive = active === key
    return (
      <div
        key={key}
        className={`sb-link${isActive ? ' active' : ''}`}
        onClick={isActive ? undefined : () => navigate(path)}
      >
        <div className="sb-icon"><i className={`fa-solid ${icon}`} /></div>
        <span className="sb-label">{label}</span>
      </div>
    )
  }

  return (
    <aside className={`sidebar${expanded ? ' expanded' : ''}`}>
      <div className="sb-header">
        {expanded
          ? <img src={logoSidebarFull} alt="Brasil Terrenos" className="sb-logo-full" />
          : <img src={logoSidebarIcon} alt="Brasil Terrenos" className="sb-logo-icon-img" />
        }
        <button
          className="sb-toggle"
          onClick={toggle}
          title={expanded ? 'Retrair menu' : 'Expandir menu'}
        >
          <i className={`fa-solid ${expanded ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
        </button>
      </div>

      <nav className="sb-nav">
        {link('home', '/', 'fa-house', 'Home')}
        {temPermissao('usuarios') && link('usuarios', '/usuarios', 'fa-users', 'Usuários')}
        {link('workspaces', '/workspaces', 'fa-building-columns', 'Workspace')}
        {link('favoritos', '/favoritos', 'fa-star', 'Favoritos')}
        {temPermissao('landbank') && link('landbank', '/landbank', 'fa-map-location-dot', 'Land Bank')}
        {temPermissao('auditoria') && link('auditoria', '/auditoria', 'fa-file-lines', 'Auditoria')}
        {temPermissao('configuracoes') && link('configuracoes', '/configuracoes', 'fa-gear', 'Configurações')}
      </nav>

      <div className="sb-footer">
        <div className="sb-user">
          <Avatar user={user} size={36} radius={10} />
          <div className="sb-user-info">
            <div className="sb-user-name">{user?.nome || user?.email}</div>
            <div className="sb-user-email">{user?.email}</div>
            <div className="sb-user-role">{PERFIL_LABEL[user?.perfil] ?? user?.perfil}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
