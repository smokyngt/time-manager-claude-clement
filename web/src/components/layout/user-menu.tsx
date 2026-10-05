import { LogOutIcon, UserIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

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
import { useAuth } from '@/lib/auth/use-auth'
import { getInitials } from '@/lib/utils'

export function UserMenu() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const full_name = `${user.first_name} ${user.last_name}`

  async function handleLogout() {
    await logout()
    toast.success('You have been signed out')
    await navigate('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Open user menu"
        className="flex items-center gap-2.5 rounded-full p-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:rounded-md sm:py-1 sm:pr-2 sm:pl-1 sm:hover:bg-accent"
      >
        <Avatar>
          <AvatarFallback>{getInitials(user.first_name, user.last_name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium">{full_name}</span>
          <span className="block text-xs leading-tight text-muted-foreground capitalize">
            {user.role}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <span className="block">{full_name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <Badge className="capitalize">{user.role}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void navigate('/me')
          }}
        >
          <UserIcon />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void handleLogout()
          }}
        >
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
