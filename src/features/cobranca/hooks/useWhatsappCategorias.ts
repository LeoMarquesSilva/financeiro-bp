import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  buildCategoriaDef,
  DEFAULT_WHATSAPP_CATEGORIAS,
  type WhatsappCategoriaDef,
} from '../constants/whatsappCategorias'
import {
  whatsappCategoriasService,
  type CreateWhatsappCategoriaInput,
} from '../services/whatsappCategoriasService'

const QUERY_KEY = ['cobranca', 'whatsapp-categorias']

export function useWhatsappCategorias() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => whatsappCategoriasService.list(),
    staleTime: 60_000,
  })

  const categoriasDef = useMemo<WhatsappCategoriaDef[]>(() => {
    if (!data?.length) return DEFAULT_WHATSAPP_CATEGORIAS
    return data.map(buildCategoriaDef)
  }, [data])

  const createMutation = useMutation({
    mutationFn: (input: CreateWhatsappCategoriaInput) => whatsappCategoriasService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  return {
    categoriasDef,
    isLoading,
    loadError: error,
    createCategoria: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  }
}
