export interface SessionUser {
  id: string;
  sessionId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  name: string;
  phone: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  storeId: string | null;
  storeName: string | null;
}
