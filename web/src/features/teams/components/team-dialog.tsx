import type { ReactNode } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { TeamValues } from '@/features/teams/team-schema'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TeamFormFields } from '@/features/teams/components/team-form-fields'
import { teamSchema } from '@/features/teams/team-schema'
import { getErrorMessage } from '@/lib/api/errors'

export function TeamDialog({
  defaults,
  description,
  id_prefix,
  on_submit,
  show_manager,
  submit_label,
  title,
  trigger,
}: {
  defaults: TeamValues
  description: string
  id_prefix: string
  on_submit: (values: TeamValues) => Promise<void>
  show_manager: boolean
  submit_label: string
  title: string
  trigger: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [form_error, setFormError] = useState<null | string>(null)
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<TeamValues>({ defaultValues: defaults, resolver: zodResolver(teamSchema) })

  async function submit(values: TeamValues) {
    setFormError(null)
    try {
      await on_submit(values)
      setOpen(false)
    } catch (error) {
      const message = getErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          reset(defaults)
          setFormError(null)
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => void handleSubmit(submit)(event)}
        >
          {form_error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {form_error}
            </p>
          ) : null}
          <TeamFormFields
            control={control}
            errors={errors}
            id_prefix={id_prefix}
            register={register}
            show_manager={show_manager}
          />
          <DialogFooter>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
              {submit_label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
