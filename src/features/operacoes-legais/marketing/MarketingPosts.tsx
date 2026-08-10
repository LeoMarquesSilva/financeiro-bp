import { useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Eye,
  Filter,
  Heart,
  MessageCircle,
  Search,
  Send,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { computePostEngagementRate } from './instagramAnalytics'
import { useUpdateInstagramPostLinks } from './useInstagramMarketing'
import type { MarketingPerson } from './instagramService'
import type { InstagramPost, InstagramSolicitante } from './types'

type LinkFilter = 'all' | 'linked' | 'pending'
type Sort = 'date' | 'engagement' | 'reach' | 'views'

const number = (value: number) => new Intl.NumberFormat('pt-BR').format(value)
const linked = (post: InstagramPost) =>
  (post.areas?.length ?? 0) > 0 && (post.skip_participants || (post.solicitantes?.length ?? 0) > 0)

function PostLinksDialog({
  post,
  open,
  onOpenChange,
  areas,
  people,
}: {
  post: InstagramPost | null
  open: boolean
  onOpenChange: (value: boolean) => void
  areas: string[]
  people: MarketingPerson[]
}) {
  const mutation = useUpdateInstagramPostLinks()
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedPeople, setSelectedPeople] = useState<InstagramSolicitante[]>([])
  const [skipParticipants, setSkipParticipants] = useState(false)

  useEffect(() => {
    if (!post) return
    setSelectedAreas(post.areas?.length ? post.areas : post.area ? [post.area] : [])
    setSelectedPeople(post.solicitantes ?? [])
    setSkipParticipants(post.skip_participants)
  }, [post])

  const toggleArea = (area: string) => setSelectedAreas((current) =>
    current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
  )
  const togglePerson = (person: MarketingPerson) => setSelectedPeople((current) =>
    current.some((item) => item.id === person.id)
      ? current.filter((item) => item.id !== person.id)
      : [...current, { id: person.id, name: person.name }],
  )

  const save = async () => {
    if (!post) return
    try {
      await mutation.mutateAsync({
        postId: post.id,
        areas: selectedAreas,
        solicitantes: skipParticipants ? [] : selectedPeople,
        skipParticipants,
      })
      toast.success('Vínculos da publicação atualizados.')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar os vínculos.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-hidden">
        <DialogHeader><DialogTitle>Vincular publicação</DialogTitle><DialogDescription>Associe áreas e participantes para alimentar os dashboards por área.</DialogDescription></DialogHeader>
        <div className="grid min-h-0 gap-5 overflow-y-auto px-6 py-4 md:grid-cols-2">
          <section>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Áreas</p>
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {areas.map((area) => (
                <label key={area} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><Checkbox checked={selectedAreas.includes(area)} onCheckedChange={() => toggleArea(area)} /><span>{area}</span></label>
              ))}
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Participantes</p><label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600"><Checkbox checked={skipParticipants} onCheckedChange={setSkipParticipants} />Institucional</label></div>
            <div className={`max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 ${skipParticipants ? 'pointer-events-none opacity-40' : ''}`}>
              {people.map((person) => (
                <label key={person.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><Checkbox checked={selectedPeople.some((item) => item.id === person.id)} onCheckedChange={() => togglePerson(person)} /><span className="min-w-0 flex-1 truncate">{person.name}</span><span className="max-w-28 truncate text-[10px] text-slate-400">{person.area}</span></label>
              ))}
            </div>
          </section>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save} disabled={mutation.isPending || selectedAreas.length === 0}>{mutation.isPending ? 'Salvando...' : 'Salvar vínculos'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function Metric({ icon: Icon, value, title }: { icon: typeof Eye; value: number; title: string }) {
  return <span title={title} className="inline-flex items-center gap-1 text-[11px] tabular-nums text-slate-500"><Icon className="h-3 w-3" />{number(value)}</span>
}

export function MarketingPosts({ posts, people, canManage }: { posts: InstagramPost[]; people: MarketingPerson[]; canManage: boolean }) {
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('all')
  const [format, setFormat] = useState('all')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all')
  const [sort, setSort] = useState<Sort>('date')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<InstagramPost | null>(null)
  const pageSize = 12

  const areas = useMemo(() => [...new Set([
    ...posts.flatMap((post) => post.areas?.length ? post.areas : post.area ? [post.area] : []),
    ...people.map((person) => person.area),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [people, posts])
  const formats = useMemo(() => [...new Set(posts.map((post) => post.media_product_type || post.media_type || 'OUTRO'))].sort(), [posts])

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pt-BR')
    const rows = posts.filter((post) => {
      if (needle && !`${post.caption ?? ''} ${post.solicitante ?? ''}`.toLocaleLowerCase('pt-BR').includes(needle)) return false
      if (area !== 'all' && !(post.areas?.length ? post.areas : post.area ? [post.area] : []).includes(area)) return false
      if (format !== 'all' && (post.media_product_type || post.media_type || 'OUTRO') !== format) return false
      if (linkFilter === 'linked' && !linked(post)) return false
      if (linkFilter === 'pending' && linked(post)) return false
      return true
    })
    return rows.sort((a, b) => {
      if (sort === 'engagement') return computePostEngagementRate(b) - computePostEngagementRate(a)
      if (sort === 'reach') return b.reach - a.reach
      if (sort === 'views') return b.views - a.views
      return String(b.published_at ?? '').localeCompare(String(a.published_at ?? ''))
    })
  }, [area, format, linkFilter, posts, search, sort])

  useEffect(() => setPage(1), [area, format, linkFilter, search, sort])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Filter className="h-4 w-4 text-teal-700" /> Filtros das publicações <Badge variant="outline">{filtered.length} de {posts.length}</Badge></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="relative sm:col-span-2 xl:col-span-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na legenda" className="pl-9" /></div>
          <select value={linkFilter} onChange={(event) => setLinkFilter(event.target.value as LinkFilter)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Todos os vínculos</option><option value="pending">Pendentes</option><option value="linked">Vinculados</option></select>
          <select value={area} onChange={(event) => setArea(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Todas as áreas</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={format} onChange={(event) => setFormat(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Todos os formatos</option>{formats.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="date">Mais recentes</option><option value="engagement">Maior engajamento</option><option value="reach">Maior alcance</option><option value="views">Mais visualizações</option></select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {visible.map((post) => (
          <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-teal-200 hover:shadow-md">
            <div className="grid grid-cols-[132px_1fr]">
              <div className="relative min-h-48 bg-slate-100">{post.thumbnail_url || post.media_url ? <img src={post.thumbnail_url ?? post.media_url ?? ''} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-slate-300"><Eye className="h-8 w-8" /></div>}<Badge className="absolute left-2 top-2 bg-black/65 text-[9px] hover:bg-black/65">{post.media_product_type || post.media_type || 'POST'}</Badge></div>
              <div className="flex min-w-0 flex-col p-3.5">
                <div className="flex flex-wrap gap-1">{linked(post) ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Vinculado</Badge> : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>}{(post.areas ?? []).slice(0, 2).map((item) => <Badge key={item} variant="outline" className="max-w-28 truncate text-[9px]">{item}</Badge>)}</div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-700">{post.caption || 'Sem legenda'}</p>
                <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-1.5"><Metric icon={Eye} value={post.reach} title="Alcance" /><Metric icon={Heart} value={post.likes} title="Curtidas" /><Metric icon={MessageCircle} value={post.comments} title="Comentários" /><Metric icon={Bookmark} value={post.saves} title="Salvamentos" /><Metric icon={Send} value={post.shares} title="Compartilhamentos" /><Metric icon={Users} value={post.follows} title="Seguidores ganhos" /></div>
                <div className="mt-auto flex items-end justify-between gap-2 border-t border-slate-100 pt-3"><div><p className="text-lg font-bold tabular-nums text-teal-700">{computePostEngagementRate(post).toFixed(2)}%</p><p className="text-[9px] uppercase tracking-wide text-slate-400">engajamento</p></div><div className="flex gap-1">{post.permalink && <Button asChild variant="ghost" size="icon" title="Abrir no Instagram"><a href={post.permalink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}{canManage && <Button variant="outline" size="icon" title="Editar vínculos" onClick={() => setEditing(post)}><Edit3 className="h-4 w-4" /></Button>}</div></div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {visible.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center"><p className="text-sm font-medium text-slate-700">Nenhuma publicação encontrada.</p><p className="mt-1 text-xs text-slate-500">Ajuste os filtros ou sincronize novamente.</p></div>}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><span className="text-xs text-slate-500">Página {page} de {totalPages}</span><div className="flex gap-1"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft />Anterior</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Próxima<ChevronRight /></Button></div></div>

      <PostLinksDialog post={editing} open={Boolean(editing)} onOpenChange={(value) => !value && setEditing(null)} areas={areas} people={people} />
    </div>
  )
}
