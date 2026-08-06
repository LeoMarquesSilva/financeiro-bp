import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import type { AppRole } from '@/lib/database.types'
import type { ModuleKey } from '@/lib/moduleAccess'
import { Login } from './Login'
import { ResetPassword } from './ResetPassword'
import { FinanceiroLayout } from './layouts/FinanceiroLayout'
import { InadimplenciaPage } from '@/features/inadimplencia/pages/InadimplenciaPage'
import { InadimplenciaDashboardPage } from '@/features/inadimplencia/pages/InadimplenciaDashboardPage'
import { InadimplenciaJudicializadaPage } from '@/features/inadimplencia-judicializada/pages/InadimplenciaJudicializadaPage'
import { EscritorioPage } from '@/features/escritorio/pages/EscritorioPage'
import { EscritorioFinanceiroDetalhePage } from '@/features/escritorio/pages/EscritorioFinanceiroDetalhePage'
import { CobrancaPage } from '@/features/cobranca/pages/CobrancaPage'
import { CobrancaSeguimentoPage } from '@/features/cobranca/pages/CobrancaSeguimentoPage'
import { TeamMembersPage } from '@/features/gestores/pages/TeamMembersPage'
import { ColaboradoresPage } from '@/features/colaboradores/pages/ColaboradoresPage'
import { ConfiguracoesPage } from '@/features/configuracoes/pages/ConfiguracoesPage'
import { ReceitaPage } from '@/features/receita/pages/ReceitaPage'
import { OpexPage } from '@/features/opex/pages/OpexPage'
import { PerfilPage } from '@/features/perfil/pages/PerfilPage'
import { EficienciaPage } from '@/features/eficiencia/pages/EficienciaPage'

function ProtectedRoute({
  allowedRoles,
  moduleKey,
  children,
}: {
  allowedRoles: AppRole[]
  /** Libera o acesso também para quem tem esse módulo concedido individualmente (Fase 2). */
  moduleKey?: ModuleKey
  children: React.ReactNode
}) {
  const { role, moduleAccess } = useAuth()
  const hasRoleAccess = !!role && allowedRoles.includes(role)
  const hasModuleAccess = !!moduleKey && moduleAccess.includes(moduleKey)
  if (!hasRoleAccess && !hasModuleAccess) {
    return <Navigate to="/financeiro/inadimplencia" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { user, role, moduleAccess, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Carregando...</p>
      </div>
    )
  }

  if (!user || (!role && moduleAccess.length === 0)) {
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
            path="inadimplencia/judicializada"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro', 'comite']}>
                <InadimplenciaJudicializadaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="escritorio"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro']} moduleKey="escritorio">
                <EscritorioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="escritorio/financeiro/:metrica"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro']} moduleKey="escritorio">
                <EscritorioFinanceiroDetalhePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="cobranca"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro']} moduleKey="cobranca">
                <CobrancaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="cobranca/seguimento"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro', 'comite']} moduleKey="cobranca">
                <CobrancaSeguimentoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="gestores"
            element={
              <ProtectedRoute allowedRoles={['admin']} moduleKey="gestores">
                <TeamMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="colaboradores"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ColaboradoresPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="receita"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro', 'comite']} moduleKey="receita">
                <ReceitaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="opex"
            element={
              <ProtectedRoute allowedRoles={['admin', 'financeiro']} moduleKey="opex">
                <OpexPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="eficiencia"
            element={
              <ProtectedRoute allowedRoles={['admin']} moduleKey="eficiencia">
                <EficienciaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="configuracoes"
            element={
              <ProtectedRoute allowedRoles={['admin']} moduleKey="configuracoes">
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
