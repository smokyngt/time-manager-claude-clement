import type { User } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TeamFormat } from '@/features/teams/lib/team-format'

export type ManagerSelectProps = {
  id: string
  invalid?: boolean
  loading: boolean
  managers: readonly User[]
  onChange: (managerId: string) => void
  value: string
}

export function ManagerSelect({
  id,
  invalid = false,
  loading,
  managers,
  onChange,
  value,
}: ManagerSelectProps) {
  const { t } = useTranslation('teams')

  return (
    <Select disabled={loading} onValueChange={onChange} value={value}>
      <SelectTrigger aria-invalid={invalid} id={id}>
        <SelectValue
          placeholder={loading ? t('form.manager_loading') : t('form.manager_placeholder')}
        />
      </SelectTrigger>
      <SelectContent>
        {managers.map((manager) => (
          <SelectItem key={manager.id} value={manager.id}>
            {TeamFormat.userName(manager)} ({t(`common:roles.${manager.role}`)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
