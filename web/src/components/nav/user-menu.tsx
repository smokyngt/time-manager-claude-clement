import { LogOutIcon, UserIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getInitials } from '@/lib/utils'
import { useAuth } from '@/providers/use-auth'
import { useToastActions } from '@/providers/use-toast-actions'

export function UserMenu() {
  const { t } = useTranslation(['nav', 'common'])
  const { logout, user } = useAuth()
  const { showSuccess } = useToastActions()
  const navigate = useNavigate()

  if (!user) {
    return null
  }

  const fullName = `${user.firstName} ${user.lastName}`
  const role = t(`common:roles.${user.role}`)

  async function handleLogout() {
    await logout()
    showSuccess(t('nav:user_menu.signed_out'))
    await navigate('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav:user_menu.open')}
        className="flex items-center gap-2.5 rounded-full p-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:rounded-md sm:py-1 sm:pr-2 sm:pl-1 sm:hover:bg-accent"
      >
        <Avatar>
          <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium">{fullName}</span>
          <span className="block text-xs leading-tight text-muted-foreground">{role}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <span className="block">{fullName}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <Badge>{role}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void navigate('/me')
          }}
        >
          <UserIcon />
          {t('nav:user_menu.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void handleLogout()
          }}
        >
          <LogOutIcon />
          {t('nav:user_menu.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
