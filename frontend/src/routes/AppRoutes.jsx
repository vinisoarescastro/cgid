import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage     from '../pages/LoginPage'
import HomePage      from '../pages/HomePage'
import UsersPage     from '../pages/UsersPage'
import WorkspacePage from '../pages/WorkspacePage'

function PrivateRoute({ children }) {
  const user = sessionStorage.getItem('cgid_user')
  return user ? children : <Navigate to="/login" replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/usuarios"   element={<PrivateRoute><UsersPage /></PrivateRoute>} />
      <Route path="/workspaces" element={<PrivateRoute><WorkspacePage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
