import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/apiClient';
import {
  IChecklistPhase,
  IChecklistPhotoCategory,
} from '@/utils/checklistPhoto';

// Espelha o schema ServiceOrderChecklistPhoto do openapi.yaml —
// snake_case, sem conversão. `photo_url` é um caminho relativo já pronto
// pra usar (ex.: "/service_order_checklist_photos/<hash>_foto.jpg",
// servido via express.static) — precisa ser prefixado com
// NEXT_PUBLIC_API_URL pra virar uma URL completa (ver <img> no
// ServiceOrderDetailsModal).
export interface IServiceOrderChecklistPhoto {
  id: string;
  service_order_id: string;
  phase: IChecklistPhase;
  category: IChecklistPhotoCategory;
  photo_url: string;
  caption: string | null;
  created_at: string;
}

// Sub-lista de UMA OS, filtrada por fase — mesmo racional de
// useServiceOrderPayments (sem paginação, poucas fotos na prática).
// `?phase=` é o próprio filtro do GET (ver openapi.yaml), decisão
// confirmada com o usuário de separar Entrada/Saída em abas em vez de
// misturar as duas fases numa lista só. `enabled: !!orderId` evita a
// chamada antes do ServiceOrderDetailsModal ter uma OS aberta.
export function useServiceOrderChecklistPhotos(
  orderId: string | undefined,
  phase: IChecklistPhase
) {
  return useQuery({
    queryKey: ['service-order-checklist-photos', orderId, phase],
    queryFn: async (): Promise<IServiceOrderChecklistPhoto[]> => {
      const response = await api.get(
        `/service-orders/${orderId}/checklist-photos`,
        { params: { phase } }
      );

      return response.data.photos;
    },
    enabled: !!orderId,
  });
}
