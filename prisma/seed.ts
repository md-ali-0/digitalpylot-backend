import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
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

async function main() {
  console.log('🌱 Seeding database...\n');

  // ================================
  // 1. CREATE PLATFORM TENANT (for Super Admins only)
  // ================================
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      name: 'Platform',
      slug: 'platform',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Platform Tenant (Super Admin):', platformTenant.id);

  // ================================
  // 2. CREATE DEFAULT TENANT (for regular network operations)
  // ================================
  const defaultTenant = await prisma.tenant.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Network',
      slug: 'default',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Default Tenant (Network):', defaultTenant.id);

  // ================================
  // 2. CREATE PERMISSIONS
  // ================================
  const permissions = [
    'offer.read',
    'offer.create',
    'offer.update',
    'offer.delete',
    'report.read',
    'affiliate.read',
    'affiliate.approve',
    'advertiser.read',
    'advertiser.approve',
    'billing.read',
    'billing.manage',
    'tenant.manage', // Platform-level permission
    'platform.settings', // Platform-level permission
  ];

  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { id: p },
      update: {},
      create: { id: p, description: `Permission for ${p}` },
    });
  }

  console.log('✅ Created Permissions\n');

  // ================================
  // 3. CREATE SUPER ADMIN ROLE (Platform Owner)
  // ================================
  let superAdminRole = await prisma.role.findFirst({
    where: {
      name: 'Super Admin',
      tenantId: platformTenant.id, // Platform tenant for Super Admins
    },
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        name: 'Super Admin',
        tenantId: platformTenant.id, // Platform tenant
        permissions: {
          create: permissions.map((p) => ({ permissionId: p })),
        },
      },
    });
    console.log('✅ Created Super Admin Role (Platform):', superAdminRole.id);
  } else {
    console.log('ℹ️  Super Admin Role already exists:', superAdminRole.id);
  }

  // ================================
  // 4. CREATE ADMIN ROLE (Tenant Manager)
  // ================================
  const adminPermissions = permissions.filter(
    (p) => !p.startsWith('tenant.') && !p.startsWith('platform.'),
  );

  let adminRole = await prisma.role.findFirst({
    where: {
      name: 'Admin',
      tenantId: defaultTenant.id, // Default tenant for Admins
    },
  });

  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: 'Admin',
        tenantId: defaultTenant.id, // Default tenant
        permissions: {
          create: adminPermissions.map((p) => ({ permissionId: p })),
        },
      },
    });
    console.log('✅ Created Admin Role (Network):', adminRole.id);
  } else {
    console.log('ℹ️  Admin Role already exists:', adminRole.id);
  }

  console.log('');

  // ================================
  // 5. CREATE SUPER ADMIN USER (Platform Level)
  // ================================
  const existingSuperAdmin = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id, // Platform tenant
        email: 'superadmin@platform.com',
      },
    },
  });

  if (!existingSuperAdmin) {
    const superAdminPassword = 'superadmin@123';
    const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

    await prisma.user.create({
      data: {
        email: 'superadmin@platform.com',
        name: 'Super Administrator',
        tenantId: platformTenant.id, // Platform tenant
        passwordHash: superAdminHash,
        status: 'ACTIVE',
        emailVerified: true,
        userType: 'SUPER_ADMIN',
        userRoles: {
          create: { roleId: superAdminRole.id },
        },
      },
    });
    console.log('✅ Created Super Admin User (Platform Level)');
    console.log('   📧 Email: superadmin@platform.com');
    console.log('   🔑 Password: superadmin@123');
  } else {
    console.log('ℹ️  Super Admin user already exists');
  }

  // ================================
  // 6. CREATE ADMIN USER (Network Level)
  // ================================
  const existingAdmin = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: defaultTenant.id, // Default tenant
        email: 'admin@default.com',
      },
    },
  });

  if (!existingAdmin) {
    const adminPassword = 'admin@123';
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await prisma.user.create({
      data: {
        email: 'admin@default.com',
        name: 'Network Administrator',
        tenantId: defaultTenant.id, // Default tenant
        passwordHash: adminHash,
        status: 'ACTIVE',
        emailVerified: true,
        userType: 'ADMIN',
        userRoles: {
          create: { roleId: adminRole.id },
        },
      },
    });
    console.log('✅ Created Admin User (Network Level)');
    console.log('   📧 Email: admin@default.com');
    console.log('   🔑 Password: admin@123');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // ================================
  // 7. CREATE SUBSCRIPTION PLANS
  // ================================
  const subscriptionPlans = [
    {
      name: 'Free',
      slug: 'free',
      description: 'Basic plan for getting started. Limited features.',
      price: 0,
      billingCycle: 'MONTHLY' as const,
      maxAffiliates: 10,
      maxOffers: 5,
      maxClicks: 1000,
      features: { analytics: false, customDomain: false, apiAccess: false, prioritySupport: false },
    },
    {
      name: 'Starter',
      slug: 'starter',
      description: 'For small teams getting started with affiliate marketing.',
      price: 29,
      billingCycle: 'MONTHLY' as const,
      maxAffiliates: 50,
      maxOffers: 25,
      maxClicks: 10000,
      features: { analytics: true, customDomain: false, apiAccess: false, prioritySupport: false },
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'For growing businesses with advanced needs.',
      price: 79,
      billingCycle: 'MONTHLY' as const,
      maxAffiliates: 500,
      maxOffers: 100,
      maxClicks: 100000,
      features: { analytics: true, customDomain: true, apiAccess: true, prioritySupport: false },
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large-scale operations with unlimited capacity.',
      price: 199,
      billingCycle: 'MONTHLY' as const,
      maxAffiliates: null,
      maxOffers: null,
      maxClicks: null,
      features: { analytics: true, customDomain: true, apiAccess: true, prioritySupport: true },
    },
  ];

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        price: plan.price,
        billingCycle: plan.billingCycle,
        maxAffiliates: plan.maxAffiliates,
        maxOffers: plan.maxOffers,
        maxClicks: plan.maxClicks,
        features: plan.features,
        isActive: true,
      },
    });
  }

  console.log('✅ Created Subscription Plans (Free, Starter, Pro, Enterprise)\n');

  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 LOGIN CREDENTIALS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🔐 SUPER ADMIN (Platform Owner - "platform" tenant):');
  console.log('   Email: superadmin@platform.com');
  console.log('   Password: superadmin@123');
  console.log('   Tenant: platform');
  console.log('   Access: Manages ALL tenants + platform settings');
  console.log('');
  console.log('👤 ADMIN (Network Manager - "default" tenant):');
  console.log('   Email: admin@default.com');
  console.log('   Password: admin@123');
  console.log('   Tenant: default');
  console.log('   Access: Manages "default" network only');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚠️  Please change these passwords after first login!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
