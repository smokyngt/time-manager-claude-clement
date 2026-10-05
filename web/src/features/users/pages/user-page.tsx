import type { User } from '@time-manager/sdk'

import { ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon, ChartColumnIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { ConfirmDialog, ErrorState, PageHeader, ResponsiveDetail } from '@/components/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { UserDetails, UserForm } from '@/features/users/components'
import {
  useArchiveUser,
  useDeleteUsers,
  useRestoreUser,
  useUpdateUsers,
  useUser,
  useUserClocks,
  useUserTeams,
} from '@/features/users/hooks'
import { UserPayload, UserPermissions, UserSearch } from '@/features/users/lib'
import { useDocumentTitle } from '@/hooks'
import { Dates } from '@/lib/dates'
import { Duration } from '@/lib/duration'
import { Permission } from '@/lib/permission'
import { RESOURCE_SCOPES } from '@/lib/scopes'
import { useAuth } from '@/providers/use-auth'
import { useToastActions } from '@/providers/use-toast-actions'

import type { UserFormValues } from '@/features/users/lib'

export function UserPage() {
  const { user: me } = useAuth()
  const { userId } = useParams()

  if (me === null) {
    return null
  }

  return <UserContent actor={{ id: me.id, role: me.role }} userId={userId} />
}

function UserContent({ actor, userId }: { actor: Pick<User, 'id' | 'role'>; userId?: string }) {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()
  const { scopes } = useAuth()
  const { showSuccess } = useToastActions()
  const { error, isError, loading, notFound, refetch, user } = useUser(userId)
  useDocumentTitle(user ? UserSearch.name(user) : t('title'))
  const canReadClocks = Permission.scope.any(scopes, [RESOURCE_SCOPES.clocks.read])
  const canReport = Permission.scope.any(scopes, [RESOURCE_SCOPES.reports.read])
  const teams = useUserTeams(userId)
  const clocks = useUserClocks(userId, { enabled: canReadClocks })
  const update = useUpdateUsers()
  const archive = useArchiveUser()
  const restore = useRestoreUser()
  const remove = useDeleteUsers({
    onDeleted: () => {
      showSuccess(t('toast.deleted', { count: 1 }))
      void navigate('/users', { replace: true })
    },
  })
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)

  const submitEdit = useCallback(
    (values: UserFormValues) => {
      if (!user) {
        return
      }
      const data = UserPayload.update(values, user, UserPermissions.fields(actor, user))
      if (Object.keys(data).length === 0) {
        setEditing(false)
        return
      }
      update.mutate(
        { data, ids: [user.id], revert: UserPayload.revert(user, data) },
        {
          onSuccess: (result) => {
            if (result.failed.length === 0) {
              setEditing(false)
            }
          },
        },
      )
    },
    [actor, update, user],
  )

  const handleConfirm = useCallback(() => {
    if (!user) {
      return
    }
    const kind = confirm
    setConfirm(null)
    if (kind === 'delete') {
      remove.mutate([user.id])
    } else if (kind === 'archive') {
      archive.mutate([user.id])
    }
  }, [archive, confirm, remove, user])

  if (loading) {
    return (
      <div aria-busy className="space-y-6" role="status">
        <span className="sr-only">{t('loading')}</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState
          description={notFound ? t('page.not_found') : undefined}
          error={error}
          onRetry={notFound ? undefined : () => void refetch()}
          title={notFound ? t('page.not_found_title') : undefined}
        />
      </div>
    )
  }

  const archived = user.archivedAt !== null
  const canEdit = !archived && UserPermissions.canEdit(actor, user)
  const canArchive = !archived && UserPermissions.canArchive(actor, user)
  const canRestore = archived && UserPermissions.canRestore(actor, user)
  const canDelete = UserPermissions.canDelete(actor, user)
  const emailTaken = update.data?.failed.some((item) => item.code === 'user.conflict') ?? false

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        actions={
          <>
            {canReport && UserPermissions.canReport(actor, user) ? (
              <Button asChild variant="outline">
                <Link to={`/reports/users/${user.id}`}>
                  <ChartColumnIcon aria-hidden />
                  {t('actions.open_report')}
                </Link>
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                onClick={() => {
                  update.reset()
                  setEditing(true)
                }}
                variant="outline"
              >
                <PencilIcon aria-hidden />
                {tc('actions.edit')}
              </Button>
            ) : null}
            {canArchive ? (
              <Button
                onClick={() => {
                  setConfirm('archive')
                }}
                variant="outline"
              >
                <ArchiveIcon aria-hidden />
                {tc('actions.archive')}
              </Button>
            ) : null}
            {canRestore ? (
              <Button
                disabled={restore.isPending}
                onClick={() => {
                  restore.mutate([user.id])
                }}
                variant="outline"
              >
                <ArchiveRestoreIcon aria-hidden />
                {tc('actions.restore')}
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                onClick={() => {
                  setConfirm('delete')
                }}
                variant="destructive"
              >
                <Trash2Icon aria-hidden />
                {tc('actions.delete')}
              </Button>
            ) : null}
          </>
        }
        description={user.email}
        title={UserSearch.name(user)}
      />
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold tracking-tight">{t('detail.profile')}</h2>
        </CardHeader>
        <CardContent>
          <UserDetails user={user} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold tracking-tight">{t('detail.teams')}</h2>
        </CardHeader>
        <CardContent>
          {teams.loading ? <Skeleton className="h-8 w-full" /> : null}
          {teams.isError ? (
            <ErrorState onRetry={() => void teams.refetch()} />
          ) : null}
          {!teams.loading && !teams.isError && teams.teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('detail.teams_empty')}</p>
          ) : null}
          <ul className="flex flex-wrap gap-2">
            {teams.teams.map((team) => (
              <li key={team.id}>
                <Badge variant="outline">
                  {team.name}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {canReadClocks ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{t('detail.clocks')}</h2>
            {canReport ? (
              <Button asChild size="sm" variant="outline">
                <Link to={`/reports/users/${user.id}`}>{t('detail.clocks_report')}</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {clocks.loading ? <Skeleton className="h-8 w-full" /> : null}
            {clocks.isError ? <ErrorState onRetry={() => void clocks.refetch()} /> : null}
            {!clocks.loading && !clocks.isError && clocks.clocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('detail.clocks_empty')}</p>
            ) : null}
            <ul className="divide-y">
              {clocks.clocks.map((clock) => (
                <li className="flex items-center justify-between gap-3 py-2 text-sm" key={clock.id}>
                  <span>{Dates.dateTime(clock.clockedInAt)}</span>
                  <span className="text-muted-foreground">
                    {clock.durationMs === null
                      ? t('detail.clock_open')
                      : Duration.format(clock.durationMs)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <ResponsiveDetail
        onOpenChange={setEditing}
        open={editing}
        title={t('edit.title')}
      >
        <UserForm
          actor={actor}
          emailTaken={emailTaken}
          idPrefix="user-page"
          onCancel={() => {
            setEditing(false)
          }}
          onSubmit={submitEdit}
          pending={update.isPending}
          user={user}
        />
      </ResponsiveDetail>
      <ConfirmDialog
        confirmLabel={confirm === 'delete' ? tc('actions.delete') : tc('actions.archive')}
        description={t(confirm === 'delete' ? 'delete.description' : 'archive.description', {
          count: 1,
        })}
        loading={archive.isPending || remove.isPending}
        onConfirm={handleConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null)
          }
        }}
        open={confirm !== null}
        title={t(confirm === 'delete' ? 'delete.title' : 'archive.title', { count: 1 })}
        variant={confirm === 'delete' ? 'destructive' : 'default'}
      />
    </div>
  )
}

function BackLink() {
  const { t } = useTranslation('users')

  return (
    <Button asChild size="sm" variant="ghost">
      <Link to="/users">
        <ArrowLeftIcon aria-hidden />
        {t('page.back')}
      </Link>
    </Button>
  )
}
