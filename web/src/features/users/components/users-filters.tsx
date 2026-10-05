import type { Role, UserFilters } from '@/features/users/types'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

export function UsersFilters({
  filters,
  onChange,
}: {
  filters: UserFilters
  onChange: (filters: UserFilters) => void
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <Label htmlFor="users-filter-role">Role</Label>
        <Select
          onValueChange={(role) => {
            onChange({ ...filters, role: role as 'all' | Role })
          }}
          value={filters.role}
        >
          <SelectTrigger className="w-40" id="users-filter-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={filters.archived}
          id="users-filter-archived"
          onCheckedChange={(archived) => {
            onChange({ ...filters, archived })
          }}
        />
        <Label htmlFor="users-filter-archived">Show archived</Label>
      </div>
    </div>
  )
}
