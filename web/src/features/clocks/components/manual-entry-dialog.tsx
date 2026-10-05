import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { Clock } from '@/features/clocks/api/types'
import type { ManualEntryValues } from '@/features/clocks/manual-entry-schema'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/features/clocks/components/ui/textarea'
import { useCreateClock, useUpdateClock } from '@/features/clocks/hooks/use-clock-mutations'
import { fromInputValue, toInputValue } from '@/features/clocks/lib/format'
import { manualEntrySchema } from '@/features/clocks/manual-entry-schema'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

export interface UserOption {
  id: string
  label: string
}

function defaultValues(user_id: string, clock?: Clock): ManualEntryValues {
  if (!clock) return { clocked_in_at: '', clocked_out_at: '', note: '', user_id }
  return {
    clocked_in_at: toInputValue(clock.clocked_in_at),
    clocked_out_at: clock.clocked_out_at === null ? '' : toInputValue(clock.clocked_out_at),
    note: clock.note ?? '',
    user_id: clock.user_id,
  }
}

export function ManualEntryDialog({
  clock,
  default_user_id,
  onOpenChange,
  open,
  users,
}: {
  clock?: Clock
  default_user_id: string
  onOpenChange: (open: boolean) => void
  open: boolean
  users: UserOption[]
}) {
  const [form_error, setFormError] = useState<null | string>(null)
  const create = useCreateClock()
  const update = useUpdateClock()
  const editing = Boolean(clock)
  const pending = create.isPending || update.isPending
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<ManualEntryValues>({
    defaultValues: defaultValues(default_user_id, clock),
    resolver: zodResolver(manualEntrySchema),
  })

  async function onSubmit(values: ManualEntryValues) {
    setFormError(null)
    const clocked_in_at = fromInputValue(values.clocked_in_at)
    const clocked_out_at = fromInputValue(values.clocked_out_at)
    const note = values.note.trim()
    try {
      if (clock) {
        const result = await update.mutateAsync({
          data: { clocked_in_at, clocked_out_at, note: note || null },
          id: clock.id,
        })
        if (result.failed.length > 0) throw new Error('This entry could not be updated')
      } else {
        await create.mutateAsync({
          clocked_in_at,
          clocked_out_at,
          note: note || undefined,
          user_id: values.user_id,
        })
      }
      toast.success(editing ? 'Entry updated' : 'Entry added')
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 409
          ? 'This entry overlaps another clock of the same user'
          : getErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          reset(defaultValues(default_user_id, clock))
          setFormError(null)
        }
        onOpenChange(next)
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit entry' : 'Add manual entry'}</DialogTitle>
          <DialogDescription>
            Entries must end after they start, cannot be in the future and last at most 24 hours.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          {form_error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {form_error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="entry-user">User</Label>
            <Controller
              control={control}
              name="user_id"
              render={({ field }) => (
                <Select disabled={editing} onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger aria-invalid={Boolean(errors.user_id)} id="entry-user">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.user_id ? (
              <p className="text-sm text-destructive">{errors.user_id.message}</p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry-in">Clock in</Label>
              <Input
                aria-invalid={Boolean(errors.clocked_in_at)}
                id="entry-in"
                type="datetime-local"
                {...register('clocked_in_at')}
              />
              {errors.clocked_in_at ? (
                <p className="text-sm text-destructive">{errors.clocked_in_at.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-out">Clock out</Label>
              <Input
                aria-invalid={Boolean(errors.clocked_out_at)}
                id="entry-out"
                type="datetime-local"
                {...register('clocked_out_at')}
              />
              {errors.clocked_out_at ? (
                <p className="text-sm text-destructive">{errors.clocked_out_at.message}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-note">Note (optional)</Label>
            <Textarea
              aria-invalid={Boolean(errors.note)}
              id="entry-note"
              maxLength={500}
              {...register('note')}
            />
            {errors.note ? <p className="text-sm text-destructive">{errors.note.message}</p> : null}
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Add entry'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AddEntryButton({
  default_user_id,
  users,
}: {
  default_user_id: string
  users: UserOption[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true)
        }}
      >
        <PlusIcon />
        Add manual entry
      </Button>
      {open ? (
        <ManualEntryDialog
          default_user_id={default_user_id}
          onOpenChange={setOpen}
          open={open}
          users={users}
        />
      ) : null}
    </>
  )
}

