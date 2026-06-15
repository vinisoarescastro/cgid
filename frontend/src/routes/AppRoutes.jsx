import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage     from '../pages/LoginPage'
import HomePage      from '../pages/HomePage'
import UsersPage     from '../pages/UsersPage'
import WorkspacePage from '../pages/WorkspacePage'
import SettingsPage  from '../pages/SettingsPage'
import AuditPage      from '../pages/AuditPage'
import FavoritosPage  from '../pages/FavoritosPage'
function PrivateRoute({ children }) {
  const user = sessionStorage.getItem('cgid_user')
  return user ? children : <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/usuarios"      element={<PrivateRoute><UsersPage /></PrivateRoute>} />
      <Route path="/workspaces"    element={<PrivateRoute><WorkspacePage /></PrivateRoute>} />
      <Route path="/configuracoes" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="/auditoria"     element={<PrivateRoute><AuditPage /></PrivateRoute>} />
      <Route path="/favoritos"     element={<PrivateRoute><FavoritosPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
