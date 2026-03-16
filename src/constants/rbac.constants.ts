export interface PermissionDefinition {
  module: string;
  atom: string;
  name: string;
  description: string;
}

export const RBAC_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { module: 'dashboard', atom: 'read', name: 'dashboard:read', description: 'View the dashboard' },
  { module: 'users', atom: 'read', name: 'users:read', description: 'View users' },
  { module: 'users', atom: 'create', name: 'users:create', description: 'Create users' },
  { module: 'users', atom: 'update', name: 'users:update', description: 'Update users' },
  { module: 'users', atom: 'delete', name: 'users:delete', description: 'Delete users' },
  { module: 'users', atom: 'suspend', name: 'users:suspend', description: 'Suspend users' },
  { module: 'users', atom: 'ban', name: 'users:ban', description: 'Ban users' },
  {
    module: 'permissions',
    atom: 'read',
    name: 'permissions:read',
    description: 'View permission assignments',
  },
  {
    module: 'permissions',
    atom: 'manage',
    name: 'permissions:manage',
    description: 'Manage permission assignments',
  },
  { module: 'leads', atom: 'read', name: 'leads:read', description: 'View leads' },
  { module: 'leads', atom: 'create', name: 'leads:create', description: 'Create leads' },
  { module: 'leads', atom: 'update', name: 'leads:update', description: 'Update leads' },
  { module: 'leads', atom: 'assign', name: 'leads:assign', description: 'Assign leads' },
  { module: 'leads', atom: 'delete', name: 'leads:delete', description: 'Delete leads' },
  { module: 'tasks', atom: 'read', name: 'tasks:read', description: 'View tasks' },
  { module: 'tasks', atom: 'create', name: 'tasks:create', description: 'Create tasks' },
  { module: 'tasks', atom: 'update', name: 'tasks:update', description: 'Update tasks' },
  { module: 'tasks', atom: 'delete', name: 'tasks:delete', description: 'Delete tasks' },
  { module: 'reports', atom: 'read', name: 'reports:read', description: 'View reports' },
  { module: 'reports', atom: 'export', name: 'reports:export', description: 'Export reports' },
  { module: 'audit', atom: 'read', name: 'audit:read', description: 'View audit logs' },
  { module: 'settings', atom: 'read', name: 'settings:read', description: 'View settings' },
  {
    module: 'customer-portal',
    atom: 'read',
    name: 'customer_portal:read',
    description: 'Access the customer portal',
  },
];

export const RBAC_PERMISSION_NAMES = RBAC_PERMISSION_DEFINITIONS.map((permission) => permission.name);
