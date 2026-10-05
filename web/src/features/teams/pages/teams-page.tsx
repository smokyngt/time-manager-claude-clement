import { UsersRoundIcon } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'

export function TeamsPage() {
  return (
    <>
      <PageHeader description="Organize employees into teams" title="Teams" />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
            <UsersRoundIcon aria-hidden className="size-6" />
          </div>
          <h2 className="font-semibold">No teams yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Team management is coming soon. You will be able to create teams and assign employees
            here.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
