import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import type { AppRole } from '@/lib/database.types'
import { Login } from './Login'
import { ResetPassword } from './ResetPassword'
import { FinanceiroLayout } from './layouts/FinanceiroLayout'
import { InadimplenciaPage } from '@/features/inadimplencia/pages/InadimplenciaPage'
import { InadimplenciaDashboardPage } from '@/features/inadimplencia/pages/InadimplenciaDashboardPage'
import { EscritorioPage } from '@/features/escritorio/pages/EscritorioPage'
import { TeamMembersPage } from '@/features/gestores/pages/TeamMembersPage'
import { ConfiguracoesPage } from '@/features/configuracoes/pages/ConfiguracoesPage'
import { PerfilPage } from '@/features/perfil/pages/PerfilPage'

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: AppRole[]
  children: React.ReactNode
}) {
  const { role } = useAuth()
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/financeiro/inadimplencia" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Carregando...</p>
      </div>
    )
  }

  if (!user || !role) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/financeiro/inadimplencia" replace />} />
        <Route path="/financeiro" element={<FinanceiroLayout />}>
          <Route path="inadimplencia" element={<InadimplenciaPage />} />
          <Route path="inadimplencia/dashboard" element={<InadimplenciaDashboardPage />} />
          <Route
            path="escritorio"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro']}>
                <EscritorioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="gestores"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <TeamMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="configuracoes"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ConfiguracoesPage />
              </ProtectedRoute>
            }
          />
          <Route path="perfil" element={<PerfilPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/financeiro/inadimplencia" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
