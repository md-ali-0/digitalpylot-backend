export const USER_SEARCHABLE_FIELDS = ['name', 'email', 'phone'] as const;

export const USER_ALLOWED_FILTERS = ['role', 'status', 'tenantId'] as const;

export const USER_TYPES = ['admin', 'manager', 'affiliate', 'advertiser'];
export const USER_STATUS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export const ENUM_YN = {
  YES: 'YES',
  NO: 'NO',
} as const;
