import type { Team } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import type { TeamFormProps } from '@/features/teams/components/team-form'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TeamForm } from '@/features/teams/components/team-form'

export type TeamFormDialogProps = Omit<TeamFormProps, 'onCancel' | 'team'> & {
  onOpenChange: (open: boolean) => void
  open: boolean
  team?: Team
}

export function TeamFormDialog({ onOpenChange, open, team, ...formProps }: TeamFormDialogProps) {
  const { t } = useTranslation('teams')
  const mode = team ? 'edit' : 'create'

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>
        <TeamForm
          {...formProps}
          idPrefix={mode}
          onCancel={() => {
            onOpenChange(false)
          }}
          team={team}
        />
      </DialogContent>
    </Dialog>
  )
}
