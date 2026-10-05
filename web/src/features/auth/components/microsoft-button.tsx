import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { MicrosoftIcon } from '@/features/auth/components/microsoft-icon'

type MicrosoftButtonProps = {
  disabled?: boolean
  onClick: () => void
}

export function MicrosoftButton({ disabled, onClick }: MicrosoftButtonProps) {
  const { t } = useTranslation('auth')

  return (
    <Button
      className="w-full"
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      <MicrosoftIcon />
      {t('login.microsoft')}
    </Button>
  )
}
