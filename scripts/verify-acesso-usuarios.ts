/**
 * Verifica home, menu e dashboard Eficiência por tipo de usuário.
 * Uso: npx tsx --tsconfig tsconfig.json scripts/verify-acesso-usuarios.ts
 */
import { resolveHomePath } from '../src/lib/homePath'
import {
  NAV_ACCESS_ITEMS,
  canAccessRoute,
  filterNavItemsForAccess,
} from '../src/lib/navAccess'
import {
  resolveEficienciaAccess,
  isCoordenadorUsuario,
} from '../src/features/eficiencia/utils/eficienciaAccess'
import type { AppRole } from '../src/lib/database.types'
import type { ModuleKey } from '../src/lib/moduleAccess'

type Case = {
  name: string
  role: AppRole | null
  modules: ModuleKey[]
  email?: string
  nivel?: 'socio' | 'gerente' | 'coordenador' | 'colaborador' | null
  colaboradorArea?: string
  expectHome: string
  expectNavLabels: string[]
  expectNotNavLabels?: string[]
  expectEficiencia?: {
    profile: 'admin' | 'socio_area' | 'coordenador'
    canUseIndicadoresAdmin: boolean
    canSeeAllTabs: boolean
    canFilterAreas: boolean
    lockedArea: string | null
  }
  expectRoutes?: Array<{
    label: string
    allowedRoles: AppRole[]
    moduleKey?: ModuleKey
    allowed: boolean
  }>
}

let failed = 0
let passed = 0

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}`)
  }
}

function sameLabels(got: string[], expected: string[]) {
  const a = [...got].sort()
  const b = [...expected].sort()
  return a.length === b.length && a.every((v, i) => v === b[i])
}

const cases: Case[] = [
  {
    name: 'Admin',
    role: 'admin',
    modules: [],
    expectHome: '/financeiro/inadimplencia',
    expectNavLabels: [
      'Dashboard',
      'Inadimplência',
      'Inadimplência Pontual',
      'Inad. Judicializada',
      'Escritório',
      'Cobrança',
      'Receita',
      'OPEX',
      'Eficiência Operacional',
      'Usuários',
      'Configurações',
    ],
    expectEficiencia: {
      profile: 'admin',
      canUseIndicadoresAdmin: true,
      canSeeAllTabs: true,
      canFilterAreas: true,
      lockedArea: null,
    },
  },
  {
    name: 'Financeiro',
    role: 'financeiro',
    modules: [],
    expectHome: '/financeiro/inadimplencia',
    expectNavLabels: [
      'Dashboard',
      'Inadimplência',
      'Inadimplência Pontual',
      'Inad. Judicializada',
      'Escritório',
      'Cobrança',
      'Receita',
      'OPEX',
    ],
    expectNotNavLabels: ['Eficiência Operacional', 'Usuários', 'Configurações'],
    expectRoutes: [
      {
        label: 'eficiencia',
        allowedRoles: ['admin', 'coordenador'],
        moduleKey: 'eficiencia',
        allowed: false,
      },
      {
        label: 'inadimplencia',
        allowedRoles: ['admin', 'financeiro', 'comite'],
        moduleKey: 'inadimplencia',
        allowed: true,
      },
    ],
  },
  {
    name: 'Comitê',
    role: 'comite',
    modules: [],
    expectHome: '/financeiro/inadimplencia',
    expectNavLabels: [
      'Dashboard',
      'Inadimplência',
      'Inadimplência Pontual',
      'Inad. Judicializada',
      'Receita',
    ],
    expectNotNavLabels: ['Escritório', 'Cobrança', 'OPEX', 'Eficiência Operacional', 'Usuários'],
  },
  {
    name: 'Coordenador (role) — Carol Thomé',
    role: 'coordenador',
    modules: ['eficiencia'],
    email: 'caroline.thome@bpplaw.com.br',
    colaboradorArea: 'Cível',
    expectHome: '/financeiro/eficiencia',
    expectNavLabels: ['Eficiência Operacional'],
    expectNotNavLabels: [
      'Dashboard',
      'Inadimplência',
      'Receita',
      'Usuários',
      'Escritório',
      'Cobrança',
    ],
    expectEficiencia: {
      profile: 'coordenador',
      canUseIndicadoresAdmin: false,
      canSeeAllTabs: true,
      canFilterAreas: false,
      lockedArea: 'Cível',
    },
    expectRoutes: [
      {
        label: 'inadimplencia',
        allowedRoles: ['admin', 'financeiro', 'comite'],
        moduleKey: 'inadimplencia',
        allowed: false,
      },
      {
        label: 'eficiencia',
        allowedRoles: ['admin', 'coordenador'],
        moduleKey: 'eficiencia',
        allowed: true,
      },
    ],
  },
  {
    name: 'Coordenador lista — Ligia (só módulo, sem role)',
    role: null,
    modules: ['eficiencia'],
    email: 'ligia@bismarchipires.com.br',
    colaboradorArea: 'Reestruturação',
    nivel: 'colaborador',
    expectHome: '/financeiro/eficiencia',
    expectNavLabels: ['Eficiência Operacional'],
    expectNotNavLabels: ['Inadimplência', 'Dashboard', 'Usuários'],
    expectEficiencia: {
      profile: 'coordenador',
      canUseIndicadoresAdmin: false,
      canSeeAllTabs: true,
      canFilterAreas: false,
      lockedArea: 'Reestruturação',
    },
  },
  {
    name: 'Coordenador lista — Henrique Contratos',
    role: null,
    modules: ['eficiencia'],
    email: 'henrique.nascimento@bismarchipires.com.br',
    colaboradorArea: 'Contratos',
    expectHome: '/financeiro/eficiencia',
    expectNavLabels: ['Eficiência Operacional'],
    expectEficiencia: {
      profile: 'coordenador',
      canUseIndicadoresAdmin: false,
      canSeeAllTabs: true,
      canFilterAreas: false,
      lockedArea: 'Contratos',
    },
  },
  {
    name: 'Sócio de área (gerente RH + módulo eficiência)',
    role: null,
    modules: ['eficiencia'],
    email: 'giancarlo@bpplaw.com.br',
    nivel: 'gerente',
    colaboradorArea: 'Cível',
    expectHome: '/financeiro/eficiencia',
    expectNavLabels: ['Eficiência Operacional'],
    expectEficiencia: {
      profile: 'socio_area',
      canUseIndicadoresAdmin: false,
      canSeeAllTabs: true,
      canFilterAreas: true,
      lockedArea: null,
    },
  },
  {
    name: 'Só módulo Receita (sem role)',
    role: null,
    modules: ['receita'],
    expectHome: '/financeiro/receita',
    expectNavLabels: ['Receita'],
    expectNotNavLabels: ['Inadimplência', 'Eficiência Operacional'],
  },
]

console.log('=== Verificação de acesso por tipo de usuário ===\n')

for (const c of cases) {
  console.log(`\n▶ ${c.name}`)

  const home = resolveHomePath(c.role, c.modules)
  assert(home === c.expectHome, `home = ${home} (esperado ${c.expectHome})`)

  const nav = filterNavItemsForAccess(NAV_ACCESS_ITEMS, c.role, c.modules)
  const labels = nav.map((i) => i.label)
  assert(
    sameLabels(labels, c.expectNavLabels),
    `menu = [${labels.join(', ')}]`,
  )
  if (!sameLabels(labels, c.expectNavLabels)) {
    console.error(`    esperado: [${c.expectNavLabels.join(', ')}]`)
  }

  for (const forbidden of c.expectNotNavLabels ?? []) {
    assert(!labels.includes(forbidden), `menu NÃO tem "${forbidden}"`)
  }

  if (c.expectEficiencia) {
    const access = resolveEficienciaAccess({
      role: c.role,
      email: c.email,
      teamMemberArea: c.colaboradorArea,
      nivelHierarquico: c.nivel ?? null,
      colaboradorArea: c.colaboradorArea,
    })
    assert(access.profile === c.expectEficiencia.profile, `eficiência.profile = ${access.profile}`)
    assert(
      access.canUseIndicadoresAdmin === c.expectEficiencia.canUseIndicadoresAdmin,
      `indicadores admin = ${access.canUseIndicadoresAdmin}`,
    )
    assert(
      access.canSeeAllTabs === c.expectEficiencia.canSeeAllTabs,
      `todas abas = ${access.canSeeAllTabs}`,
    )
    assert(
      access.canFilterAreas === c.expectEficiencia.canFilterAreas,
      `filtro áreas = ${access.canFilterAreas}`,
    )
    assert(
      access.lockedArea === c.expectEficiencia.lockedArea,
      `área travada = ${access.lockedArea}`,
    )
  }

  for (const r of c.expectRoutes ?? []) {
    const ok = canAccessRoute({
      role: c.role,
      moduleAccess: c.modules,
      allowedRoles: r.allowedRoles,
      moduleKey: r.moduleKey,
    })
    assert(ok === r.allowed, `rota ${r.label} allowed=${ok} (esperado ${r.allowed})`)
  }
}

// Badge / lista de coordenadores
console.log('\n▶ Badge coordenadores (lista explícita)')
const coords = [
  ['ana.tavares@bpplaw.com.br', 'Reestruturação'],
  ['ligia@bpplaw.com.br', 'Reestruturação'],
  ['lavinia.ferraz@bpplaw.com.br', 'Reestruturação'],
  ['caroline.thome@bpplaw.com.br', 'Cível'],
  ['carolineabdalla@bpplaw.com.br', 'Trabalhista'],
  ['henrique.nascimento@bismarchipires.com.br', 'Contratos'],
  ['mariaponce@bismarchipires.com.br', 'Operações Legais'],
] as const

for (const [email, area] of coords) {
  assert(
    isCoordenadorUsuario({ email, role: null, nivelHierarquico: 'colaborador' }),
    `badge/lista: ${email}`,
  )
  const access = resolveEficienciaAccess({
    role: null,
    email,
    teamMemberArea: null,
    nivelHierarquico: 'colaborador',
    colaboradorArea: area,
  })
  assert(access.lockedArea === area, `${email} lockedArea=${access.lockedArea}`)
}

console.log(`\n=== Resultado: ${passed} ok, ${failed} falha(s) ===`)
if (failed > 0) process.exit(1)
