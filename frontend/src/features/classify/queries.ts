import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useModelInfo() {
  return useQuery({ queryKey: ['model'], queryFn: api.model })
}

export function useSamples() {
  return useQuery({ queryKey: ['samples'], queryFn: api.samples })
}
