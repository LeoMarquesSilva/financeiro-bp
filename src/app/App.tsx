import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from '@/lib/auth'
import { Login } from './Login'
import { FinanceiroLayout } from './layouts/FinanceiroLayout'
import { InadimplenciaPage } from '@/features/inadimplencia/pages/InadimplenciaPage'
import { InadimplenciaDashboardPage } from '@/features/inadimplencia/pages/InadimplenciaDashboardPage'

function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    setLoggedIn(isAuthenticated())
    setAuthChecked(true)
  }, [])

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">Carregando...</p>
      </div>
    )
  }

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/financeiro/inadimplencia" replace />} />
        <Route path="/financeiro" element={<FinanceiroLayout />}>
          <Route path="inadimplencia" element={<InadimplenciaPage />} />
          <Route path="inadimplencia/dashboard" element={<InadimplenciaDashboardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/financeiro/inadimplencia" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
