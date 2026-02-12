import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FinanceiroLayout } from './layouts/FinanceiroLayout'
import { InadimplenciaPage } from '@/features/inadimplencia/pages/InadimplenciaPage'
import { InadimplenciaDashboardPage } from '@/features/inadimplencia/pages/InadimplenciaDashboardPage'

function App() {
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
