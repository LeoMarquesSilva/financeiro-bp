import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AppSidebar } from '../components/AppSidebar'
import { TopBar } from '../components/TopBar'
import { useAuth } from '@/lib/AuthContext'
import { PasswordChangeBanner } from '@/features/perfil/components/ForcePasswordChange'

export function FinanceiroLayout() {
  const { passwordChanged } = useAuth()
  const navigate = useNavigate()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      <AppSidebar />

      <div className="ml-14 flex min-h-screen flex-col">
        <TopBar />

        {!passwordChanged && !bannerDismissed && (
          <div className="px-6 pt-4 lg:px-8">
            <PasswordChangeBanner
              onNavigateToProfile={() => navigate('/financeiro/perfil')}
              onDismiss={() => setBannerDismissed(true)}
            />
          </div>
        )}

        <main className="flex-1 px-6 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
