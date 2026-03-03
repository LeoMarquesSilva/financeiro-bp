import { Outlet } from 'react-router-dom'
import { AppSidebar } from '../components/AppSidebar'
import { TopBar } from '../components/TopBar'

export function FinanceiroLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppSidebar />

      <div className="ml-14 flex min-h-screen flex-col">
        <TopBar />

        <main className="flex-1 px-6 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
