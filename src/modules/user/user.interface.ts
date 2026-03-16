export interface UserIdParams {
  id: string;
}

export interface CreateUserBody {
  email: string;
  password: string;
  name?: string;
  role?: 'ADMIN' | 'MANAGER' | 'AFFILIATE' | 'ADVERTISER';
}

export interface UpdateUserBody {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  role?: 'ADMIN' | 'MANAGER' | 'AFFILIATE' | 'ADVERTISER';
  deletedAt?: string | null;
}

export interface ChangePasswordBody {
  oldPassword: string;
  newPassword: string;
}

export interface VendorStatusBody {
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

// Export types inferred from validation schemas
export type UserIdInput = {
  params: UserIdParams;
};

export type CreateUserInput = {
  body: CreateUserBody;
};

export type UpdateUserInput = {
  body: UpdateUserBody;
};

export type ChangePasswordInput = {
  body: ChangePasswordBody;
};

export type VendorStatusInput = {
  body: VendorStatusBody;
};
