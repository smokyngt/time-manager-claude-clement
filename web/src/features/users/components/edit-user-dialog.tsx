import { useState } from 'react'
import { toast } from 'sonner'

import type { EditUserValues } from '@/features/users/schemas'
import type { Role, UserRecord } from '@/features/users/types'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { buildUpdate } from '@/features/users/build-update'
import { EditUserForm } from '@/features/users/components/edit-user-form'
import { useUpdateUsers } from '@/features/users/hooks/use-users'
import { editableFields } from '@/features/users/permissions'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

export function EditUserDialog({
  actor,
  onOpenChange,
  open,
  user,
}: {
  actor: { id: string; role: Role }
  onOpenChange: (open: boolean) => void
  open: boolean
  user: UserRecord
}) {
  const [form_error, setFormError] = useState<null | string>(null)
  const { isPending, mutateAsync } = useUpdateUsers()

  async function onSubmit(values: EditUserValues) {
    setFormError(null)
    const data = buildUpdate(values, user, editableFields(actor, user))
    if (Object.keys(data).length === 0) {
      onOpenChange(false)
      return
    }
    try {
      const result = await mutateAsync({ data, ids: [user.id] })
      const failure = result.failed[0]
      if (failure) {
        setFormError(`Could not update this user (${failure.code})`)
        return
      }
      toast.success(`${user.first_name} ${user.last_name} was updated`)
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 409
          ? 'This email is already in use'
          : getErrorMessage(error)
      setFormError(message)
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) setFormError(null)
        onOpenChange(next)
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            {user.first_name} {user.last_name}
          </DialogDescription>
        </DialogHeader>
        <EditUserForm
          actor={actor}
          formError={form_error}
          onCancel={() => {
            onOpenChange(false)
          }}
          onSubmit={(values) => void onSubmit(values)}
          pending={isPending}
          user={user}
        />
      </DialogContent>
    </Dialog>
  )
}
