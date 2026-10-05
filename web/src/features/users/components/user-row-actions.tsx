import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  FileBarChartIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { Role, UserRecord } from '@/features/users/types'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteUsersDialog } from '@/features/users/components/delete-users-dialog'
import { EditUserDialog } from '@/features/users/components/edit-user-dialog'
import { canArchive, canDelete, canEdit } from '@/features/users/permissions'

export function UserRowActions({
  actor,
  onArchive,
  onDelete,
  onRestore,
  user,
}: {
  actor: { id: string; role: Role }
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  user: UserRecord
}) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const archivable = canArchive(actor, user)
  const archived = user.archived_at !== null
  const name = `${user.first_name} ${user.last_name}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={`Actions for ${name}`} size="icon" variant="ghost">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={`/reports/users/${user.id}`}>
              <FileBarChartIcon />
              View report
            </Link>
          </DropdownMenuItem>
          {canEdit(actor, user) ? (
            <DropdownMenuItem
              onSelect={() => {
                setEditing(true)
              }}
            >
              <PencilIcon />
              Edit
            </DropdownMenuItem>
          ) : null}
          {archivable ? (
            <DropdownMenuItem
              onSelect={() => {
                if (archived) onRestore(user.id)
                else onArchive(user.id)
              }}
            >
              {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {archived ? 'Restore' : 'Archive'}
            </DropdownMenuItem>
          ) : null}
          {canDelete(actor, user) ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setDeleting(true)
                }}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {editing ? (
        <EditUserDialog actor={actor} onOpenChange={setEditing} open={editing} user={user} />
      ) : null}
      <DeleteUsersDialog
        count={1}
        onConfirm={() => {
          setDeleting(false)
          onDelete(user.id)
        }}
        onOpenChange={setDeleting}
        open={deleting}
      />
    </>
  )
}
