import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import SessaoGuard from './components/SessaoGuard'

export default function App() {
  return (
    <BrowserRouter>
      <SessaoGuard>
        <AppRoutes />
      </SessaoGuard>
    </BrowserRouter>
  )
}
