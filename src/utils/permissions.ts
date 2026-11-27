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
//  - canCreateServiceOrder: POST /service-orders
//  - canCancelServiceOrder: PATCH /service-orders/:id/status com
//                        status=CANCELED (única transição vetada pra
//                        MECHANIC — o resto da máquina de estados,
//                        incluindo REJECTED, é ADMIN/RECEPTIONIST/
//                        MECHANIC igual)
//  - canSubmitUrgencyFeedback: PATCH /service-orders/:id/urgency-feedback
//                        (inverso dos outros — só MECHANIC, ADMIN/
//                        RECEPTIONIST bloqueados)
//  - canManageTeam:      POST/PUT /users, DELETE /users/:id — só ADMIN
//                        (mais restrito que tudo acima, dá acesso ao
//                        sistema inteiro; controla também se o item
//                        "Equipe" aparece no Menubar)
//  - canManagePayments:  POST /service-orders/:id/payments + .../confirm
//                        + .../cancel — mesmo papel de
//                        canCreateServiceOrder (ADMIN/RECEPTIONIST), mas
//                        separado dele por ser uma ação de verdade
//                        diferente (dinheiro, não dados da OS). Listar
//                        pagamentos (GET) não tem restrição nenhuma — os
//                        3 papéis veem o histórico, só a ação de
//                        registrar/confirmar/cancelar é que soma.
//  - canManageChecklistPhotos: POST/DELETE
//                        /service-orders/:id/checklist-photos(/:photoId)
//                        — mesmo papel de canManagePayments
//                        (ADMIN/RECEPTIONIST), separado por ser outra
//                        ação de verdade diferente (upload/exclusão de
//                        arquivo). Listar fotos (GET) não tem restrição
//                        nenhuma — os 3 papéis veem as fotos, só
//                        registrar/apagar é que soma.
export interface IPermissions {
  canManageCustomers: boolean;
  canDeleteCustomer: boolean;
  canManageCatalog: boolean;
  canViewFinancials: boolean;
  canEditWorkshop: boolean;
  canCreateServiceOrder: boolean;
  canCancelServiceOrder: boolean;
  canSubmitUrgencyFeedback: boolean;
  canManageTeam: boolean;
  canManagePayments: boolean;
  canManageChecklistPhotos: boolean;
}

function getPermissions(role: IUser['role'] | undefined): IPermissions {
  const isAdmin = role === 'ADMIN';
  const isReceptionist = role === 'RECEPTIONIST';
  const isMechanic = role === 'MECHANIC';

  return {
    canManageCustomers: isAdmin || isReceptionist,
    canDeleteCustomer: isAdmin,
    canManageCatalog: isAdmin || isReceptionist,
    canViewFinancials: isAdmin || isReceptionist,
    canEditWorkshop: isAdmin,
    canCreateServiceOrder: isAdmin || isReceptionist,
    canCancelServiceOrder: isAdmin || isReceptionist,
    canSubmitUrgencyFeedback: isMechanic,
    canManageTeam: isAdmin,
    canManagePayments: isAdmin || isReceptionist,
    canManageChecklistPhotos: isAdmin || isReceptionist,
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
