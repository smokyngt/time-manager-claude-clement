import { Loader2Icon, UserPlusIcon } from 'lucide-react'
import { useState } from 'react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { userName } from '@/features/teams/api/users'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useAddTeamMembers,
  useTeamMembers,
  useUserOptions,
} from '@/features/teams/hooks/use-team-members'
import { memberCandidateRoles } from '@/features/teams/permissions'
import { getErrorMessage } from '@/lib/api/errors'
import { useAuth } from '@/lib/auth/use-auth'

export function AddMembersDialog({ team_id }: { team_id: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const { data: members = [] } = useTeamMembers(team_id)
  const candidates = useUserOptions(memberCandidateRoles(user), open)
  const add = useAddTeamMembers(team_id)

  const member_ids = new Set(members.map((member) => member.id))
  const query = search.trim().toLowerCase()
  const options = (candidates.data ?? []).filter(
    (candidate) =>
      !member_ids.has(candidate.id) &&
      `${userName(candidate)} ${candidate.email}`.toLowerCase().includes(query),
  )

  function toggle(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((item) => item !== id)))
  }

  function reset() {
    setSearch('')
    setSelected([])
  }

  async function submit() {
    await add.mutateAsync(selected).then(
      () => {
        reset()
        setOpen(false)
      },
      () => undefined,
    )
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon />
          Add members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>Select the people to add to this team.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="add-members-search">Search</Label>
          <Input
            autoComplete="off"
            id="add-members-search"
            onChange={(event) => {
              setSearch(event.target.value)
            }}
            placeholder="Name or email"
            type="search"
            value={search}
          />
        </div>
        {candidates.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2Icon aria-hidden className="size-4 animate-spin" />
            Loading users
          </p>
        ) : null}
        {candidates.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {getErrorMessage(candidates.error)}
          </p>
        ) : null}
        {candidates.isSuccess && options.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users available to add.</p>
        ) : null}
        {options.length > 0 ? (
          <ul
            aria-label="Available users"
            className="max-h-64 divide-y overflow-y-auto rounded-md border"
          >
            {options.map((option) => (
              <li className="flex items-center gap-3 px-3 py-2" key={option.id}>
                <Checkbox
                  checked={selected.includes(option.id)}
                  id={`add-member-${option.id}`}
                  onCheckedChange={(checked) => {
                    toggle(option.id, checked === true)
                  }}
                />
                <Label
                  className="flex-1 flex-col items-start gap-0"
                  htmlFor={`add-member-${option.id}`}
                >
                  <span className="font-medium">{userName(option)}</span>
                  <span className="text-xs font-normal text-muted-foreground">{option.email}</span>
                </Label>
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button
            disabled={selected.length === 0 || add.isPending}
            onClick={() => void submit()}
            type="button"
          >
            {add.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {selected.length > 0 ? `Add ${selected.length} selected` : 'Add selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
