import { IUser, useAuth } from '@/hooks/auth';

// Matriz de capacidades por papel — fonte de verdade é a API (quem
// bloqueia de verdade, com 403), não esta tela. Mantida aqui pra não
// espalhar `role === 'ADMIN'`/`role === 'RECEPTIONIST'` pelas páginas;
// cada flag reúne as ações que, hoje, pedem exatamente o mesmo conjunto
// de papéis do lado da API (confirmado lendo api-argila-auto):
//  - canManageCustomers: POST/PUT /customers, POST/PUT /vehicles
//  - canDeleteCustomer:  DELETE /customers (mais restrito — só ADMIN)
//  - canManageCatalog:   POST/PUT /services, POST/PUT /parts,
//                        POST /parts/:id/stock-movements
//  - canViewFinancials:  GET /service-orders/summary,
//                        GET /service-order-payments/monthly-report,
//                        GET /service-order-payments/report
//  - canEditWorkshop:    PUT /workshops, upgrade-to-pro,
//                        subscribe-to-basic, cancel-subscription
export interface IPermissions {
  canManageCustomers: boolean;
  canDeleteCustomer: boolean;
  canManageCatalog: boolean;
  canViewFinancials: boolean;
  canEditWorkshop: boolean;
}

function getPermissions(role: IUser['role'] | undefined): IPermissions {
  const isAdmin = role === 'ADMIN';
  const isReceptionist = role === 'RECEPTIONIST';

  return {
    canManageCustomers: isAdmin || isReceptionist,
    canDeleteCustomer: isAdmin,
    canManageCatalog: isAdmin || isReceptionist,
    canViewFinancials: isAdmin || isReceptionist,
    canEditWorkshop: isAdmin,
  };
}

// Enquanto `user` ainda não chegou (GET /users/me em andamento, ver
// AuthContext), `role` é `undefined` e toda permissão cai pra `false` —
// evita mostrar um botão que vai desaparecer um instante depois, quando
// o papel real for conhecido.
export function usePermissions(): IPermissions {
  const { user } = useAuth();

  return getPermissions(user?.role);
}
