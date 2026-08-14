import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import type { ModuleKey } from '@/lib/moduleAccess'
import { resolveHomePath } from '@/lib/homePath'
import { canAccessRoutePath } from '@/lib/roleAccessConfig'
import { RoleAccessDefaultsProvider, useRoleAccessDefaults } from '@/lib/RoleAccessDefaultsContext'
import { Login } from './Login'
import { ResetPassword } from './ResetPassword'
import { FinanceiroLayout } from './layouts/FinanceiroLayout'
import { InadimplenciaPage } from '@/features/inadimplencia/pages/InadimplenciaPage'
import { InadimplenciaDashboardPage } from '@/features/inadimplencia/pages/InadimplenciaDashboardPage'
import { InadimplenciaJudicializadaPage } from '@/features/inadimplencia-judicializada/pages/InadimplenciaJudicializadaPage'
import { EscritorioPage } from '@/features/escritorio/pages/EscritorioPage'
import { CobrancaPage } from '@/features/cobranca/pages/CobrancaPage'
import { CobrancaSeguimentoPage } from '@/features/cobranca/pages/CobrancaSeguimentoPage'
import { UsuariosPage } from '@/features/usuarios/pages/UsuariosPage'
import { ConfiguracoesPage } from '@/features/configuracoes/pages/ConfiguracoesPage'
import { ReceitaPage } from '@/features/receita/pages/ReceitaPage'
import { OpexPage } from '@/features/opex/pages/OpexPage'
import { PerfilPage } from '@/features/perfil/pages/PerfilPage'
import { EficienciaPage } from '@/features/eficiencia/pages/EficienciaPage'
import { OperacoesLegaisPage } from '@/features/operacoes-legais/pages/OperacoesLegaisPage'
import {
  useCaptureRacionalExportFromUrl,
  useRacionalExportFromUrl,
} from '@/features/eficiencia/hooks/useRacionalExportFromUrl'

function RacionalExportFromUrlEffect() {
  const { loading, user } = useAuth()
  useRacionalExportFromUrl(!loading && Boolean(user))
  return null
}

function UnauthenticatedRoutes() {
  useCaptureRacionalExportFromUrl()
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="*" element={<Login />} />
    </Routes>
  )
}

function ProtectedRoute({
  routePath,
  moduleKey,
  children,
}: {
  routePath: string
  /** Libera o acesso também para quem tem esse módulo concedido individualmente (Fase 2). */
  moduleKey?: ModuleKey
  children: React.ReactNode
}) {
  const { role, moduleAccess } = useAuth()
  const { config } = useRoleAccessDefaults()
  if (
    !canAccessRoutePath({
      role,
      moduleAccess,
      routePath,
      moduleKey,
      roleRouteAccess: config,
    })
  ) {
    return <Navigate to={resolveHomePath(role, moduleAccess)} replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  const { user, role, moduleAccess, loading } = useAuth()
  const homePath = resolveHomePath(role, moduleAccess)

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
        <UnauthenticatedRoutes />
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <RacionalExportFromUrlEffect />
      <Routes>
        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/financeiro" element={<FinanceiroLayout />}>
          <Route index element={<Navigate to={homePath} replace />} />
          <Route
            path="inadimplencia"
            element={
              <ProtectedRoute
                routePath="/financeiro/inadimplencia"
                moduleKey="inadimplencia"
              >
                <InadimplenciaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inadimplencia/dashboard"
            element={
              <ProtectedRoute
                routePath="/financeiro/inadimplencia/dashboard"
                moduleKey="inadimplencia"
              >
                <InadimplenciaDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="inadimplencia/judicializada"
            element={
              <ProtectedRoute routePath="/financeiro/inadimplencia/judicializada">
                <InadimplenciaJudicializadaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="escritorio"
            element={
              <ProtectedRoute routePath="/financeiro/escritorio" moduleKey="escritorio">
                <EscritorioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="escritorio/financeiro/:metrica"
            element={<Navigate to="/financeiro/escritorio" replace />}
          />
          <Route
            path="cobranca"
            element={
              <ProtectedRoute routePath="/financeiro/cobranca" moduleKey="cobranca">
                <CobrancaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="cobranca/seguimento"
            element={
              <ProtectedRoute routePath="/financeiro/cobranca/seguimento" moduleKey="cobranca">
                <CobrancaSeguimentoPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute routePath="/financeiro/usuarios" moduleKey="gestores">
                <UsuariosPage />
              </ProtectedRoute>
            }
          />
          <Route path="gestores" element={<Navigate to="/financeiro/usuarios" replace />} />
          <Route path="colaboradores" element={<Navigate to="/financeiro/usuarios" replace />} />
          <Route
            path="receita"
            element={
              <ProtectedRoute routePath="/financeiro/receita" moduleKey="receita">
                <ReceitaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="opex"
            element={
              <ProtectedRoute routePath="/financeiro/opex" moduleKey="opex">
                <OpexPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="eficiencia"
            element={
              <ProtectedRoute routePath="/financeiro/eficiencia" moduleKey="eficiencia">
                <EficienciaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="operacoes-legais"
            element={
              <ProtectedRoute routePath="/financeiro/operacoes-legais" moduleKey="operacoes-legais">
                <OperacoesLegaisPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="configuracoes"
            element={
              <ProtectedRoute routePath="/financeiro/configuracoes" moduleKey="configuracoes">
                <ConfiguracoesPage />
              </ProtectedRoute>
            }
          />
          <Route path="perfil" element={<PerfilPage />} />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <RoleAccessDefaultsProvider>
        <AppRoutes />
      </RoleAccessDefaultsProvider>
    </AuthProvider>
  )
}

export default App
