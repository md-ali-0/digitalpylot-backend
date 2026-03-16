import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const tenantId = 'default';

const permissionDefinitions = [
  { name: 'dashboard:read', description: 'View the dashboard' },
  { name: 'users:read', description: 'View users' },
  { name: 'users:create', description: 'Create users' },
  { name: 'users:update', description: 'Update users' },
  { name: 'users:delete', description: 'Delete users' },
  { name: 'users:suspend', description: 'Suspend users' },
  { name: 'users:ban', description: 'Ban users' },
  { name: 'permissions:read', description: 'View permission assignments' },
  { name: 'permissions:manage', description: 'Manage permission assignments' },
  { name: 'leads:read', description: 'View leads' },
  { name: 'leads:create', description: 'Create leads' },
  { name: 'leads:update', description: 'Update leads' },
  { name: 'leads:assign', description: 'Assign leads' },
  { name: 'leads:delete', description: 'Delete leads' },
  { name: 'tasks:read', description: 'View tasks' },
  { name: 'tasks:create', description: 'Create tasks' },
  { name: 'tasks:update', description: 'Update tasks' },
  { name: 'tasks:delete', description: 'Delete tasks' },
  { name: 'reports:read', description: 'View reports' },
  { name: 'reports:export', description: 'Export reports' },
  { name: 'audit:read', description: 'View audit logs' },
  { name: 'settings:read', description: 'View settings' },
  { name: 'customer_portal:read', description: 'Access the customer portal' },
];

const roleDefinitions = [
  {
    name: 'Admin',
    permissions: permissionDefinitions.map((permission) => permission.name),
  },
  {
    name: 'Manager',
    permissions: [
      'dashboard:read',
      'users:read',
      'users:create',
      'users:update',
      'users:suspend',
      'permissions:read',
      'permissions:manage',
      'leads:read',
      'leads:create',
      'leads:update',
      'leads:assign',
      'tasks:read',
      'tasks:create',
      'tasks:update',
      'reports:read',
      'audit:read',
      'settings:read',
    ],
  },
  {
    name: 'Agent',
    permissions: [
      'dashboard:read',
      'leads:read',
      'leads:update',
      'tasks:read',
      'tasks:create',
      'tasks:update',
      'reports:read',
    ],
  },
  {
    name: 'Customer',
    permissions: ['dashboard:read', 'customer_portal:read'],
  },
];

const demoUsers = [
  {
    email: 'admin@digitalpylot.com',
    password: 'Admin@12345',
    name: 'Platform Admin',
    roleName: 'Admin',
    userType: UserRole.ADMIN,
    status: 'ACTIVE',
    directPermissions: [],
  },
  {
    email: 'manager@digitalpylot.com',
    password: 'Manager@12345',
    name: 'Team Manager',
    roleName: 'Manager',
    userType: UserRole.USER,
    status: 'ACTIVE',
    directPermissions: ['reports:export'],
  },
  {
    email: 'agent@digitalpylot.com',
    password: 'Agent@12345',
    name: 'Support Agent',
    roleName: 'Agent',
    userType: UserRole.USER,
    status: 'ACTIVE',
    directPermissions: ['users:read'],
  },
  {
    email: 'customer@digitalpylot.com',
    password: 'Customer@12345',
    name: 'Customer Portal User',
    roleName: 'Customer',
    userType: UserRole.USER,
    status: 'ACTIVE',
    directPermissions: [],
  },
];

async function ensureInfrastructure() {
  // Tables are now handled by Prisma migrations
  /*
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_permission_grants (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_name TEXT NOT NULL,
      granted_by TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, permission_name)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT NOT NULL PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      changes JSONB,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  */
}

async function syncPermissions() {
  const permissionIdsByName = new Map<string, string>();

  for (const definition of permissionDefinitions) {
    const existing = await prisma.permission.findFirst({
      where: { name: definition.name },
    });

    const permission = existing
      ? await prisma.permission.update({
          where: { id: existing.id },
          data: { description: definition.description },
        })
      : await prisma.permission.create({
          data: {
            name: definition.name,
            description: definition.description,
          },
        });

    permissionIdsByName.set(definition.name, permission.id);
  }

  return permissionIdsByName;
}

async function syncRoles(permissionIdsByName: Map<string, string>) {
  const roleIdsByName = new Map<string, string>();

  for (const definition of roleDefinitions) {
    const existing = await prisma.role.findFirst({
      where: { name: { equals: definition.name, mode: 'insensitive' } },
    });

    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { name: definition.name },
        })
      : await prisma.role.create({
          data: { name: definition.name },
        });

    roleIdsByName.set(definition.name, role.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    for (const permissionName of definition.permissions) {
      const permissionId = permissionIdsByName.get(permissionName);
      if (!permissionId) {
        throw new Error(`Permission not found while assigning role: ${permissionName}`);
      }

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId,
        },
      });
    }
  }

  return roleIdsByName;
}

async function syncUsers(roleIdsByName: Map<string, string>) {
  const adminUser = demoUsers[0];
  let adminUserId = '';

  for (const definition of demoUsers) {
    const passwordHash = await bcrypt.hash(definition.password, 10);
    const roleId = roleIdsByName.get(definition.roleName);

    if (!roleId) {
      throw new Error(`Role not found while creating user: ${definition.roleName}`);
    }

    const existing = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email: definition.email,
        },
      },
      include: {
        userRoles: true,
      },
    });

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            name: definition.name,
            passwordHash,
            userType: definition.userType,
            status: definition.status,
            emailVerified: true,
            deletedAt: null,
          },
        })
      : await prisma.user.create({
          data: {
            tenantId,
            email: definition.email,
            name: definition.name,
            passwordHash,
            userType: definition.userType,
            status: definition.status,
            emailVerified: true,
          },
        });

    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId,
      },
    });

    await prisma.$executeRaw`
      DELETE FROM user_permission_grants
      WHERE user_id = ${user.id}
    `;

    for (const permissionName of definition.directPermissions) {
      await prisma.$executeRaw`
        INSERT INTO user_permission_grants (user_id, permission_name, granted_by)
        VALUES (${user.id}, ${permissionName}, ${adminUserId || user.id})
      `;
    }

    if (definition.email === adminUser.email) {
      adminUserId = user.id;
    }
  }

  if (!adminUserId) {
    throw new Error('Admin seed user was not created correctly');
  }

  await prisma.$executeRaw`
    DELETE FROM user_permission_grants
    WHERE granted_by = ''
  `;

  await prisma.$executeRaw`
    UPDATE user_permission_grants
    SET granted_by = ${adminUserId}
    WHERE granted_by IS NULL
  `;

  await prisma.$executeRaw`
    DELETE FROM audit_logs
    WHERE tenant_id = ${tenantId}
      AND action = 'SEED_BOOTSTRAP'
  `;

  await prisma.$executeRaw`
    INSERT INTO audit_logs (
      id,
      tenant_id,
      user_id,
      action,
      resource_type,
      resource_id,
      changes
    ) VALUES (
      ${randomUUID()},
      ${tenantId},
      ${adminUserId},
      ${'SEED_BOOTSTRAP'},
      ${'System'},
      ${'rbac-demo-seed'},
      CAST(${JSON.stringify({
        users: demoUsers.map((user) => ({
          email: user.email,
          role: user.roleName,
          directPermissions: user.directPermissions,
        })),
      })} AS jsonb)
    )
  `;
}

async function main() {
  console.log('Seeding current RBAC dataset...\n');

  await ensureInfrastructure();
  const permissionIdsByName = await syncPermissions();
  const roleIdsByName = await syncRoles(permissionIdsByName);
  await syncUsers(roleIdsByName);

  console.log('Seed completed successfully.\n');
  console.log('Demo login credentials:');
  console.log('Admin    -> admin@digitalpylot.com / Admin@12345');
  console.log('Manager  -> manager@digitalpylot.com / Manager@12345');
  console.log('Agent    -> agent@digitalpylot.com / Agent@12345');
  console.log('Customer -> customer@digitalpylot.com / Customer@12345');
  console.log(`Tenant header/value: ${tenantId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
