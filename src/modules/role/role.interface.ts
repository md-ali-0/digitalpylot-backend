export interface CreateRoleBody {
  name: string;
  permissionIds: string[];
}

export interface UpdateRoleBody {
  name?: string;
  permissionIds?: string[];
}
