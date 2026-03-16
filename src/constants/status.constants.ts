/**
 * User Status Constants
 */
export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/**
 * User Roles Constants
 */
export const USER_ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  AFFILIATE: 'AFFILIATE',
  ADVERTISER: 'ADVERTISER',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
