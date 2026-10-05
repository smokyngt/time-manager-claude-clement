import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useState } from 'react'

import type { Role } from '@/features/users/types'

import { Button } from '@/components/ui/button'
import { DeleteUsersDialog } from '@/features/users/components/delete-users-dialog'

export function UsersBulkToolbar({
  actorRole,
  archived,
  count,
  onArchive,
  onClear,
  onDelete,
  onRestore,
  pending,
}: {
  actorRole: Role
  archived: boolean
  count: number
  onArchive: () => void
  onClear: () => void
  onDelete: () => void
  onRestore: () => void
  pending: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  if (count === 0) return null

  return (
    <div
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
      role="toolbar"
    >
      <p aria-live="polite" className="mr-auto text-sm font-medium">
        {count} selected
      </p>
      {archived ? (
        <Button disabled={pending} onClick={onRestore} size="sm" variant="outline">
          <ArchiveRestoreIcon />
          Restore
        </Button>
      ) : (
        <Button disabled={pending} onClick={onArchive} size="sm" variant="outline">
          <ArchiveIcon />
          Archive
        </Button>
      )}
      {actorRole === 'admin' ? (
        <Button
          disabled={pending}
          onClick={() => {
            setConfirming(true)
          }}
          size="sm"
          variant="destructive"
        >
          <Trash2Icon />
          Delete
        </Button>
      ) : null}
      <Button aria-label="Clear selection" onClick={onClear} size="icon" variant="ghost">
        <XIcon />
      </Button>
      <DeleteUsersDialog
        count={count}
        onConfirm={() => {
          setConfirming(false)
          onDelete()
        }}
        onOpenChange={setConfirming}
        open={confirming}
      />
    </div>
  )
}
