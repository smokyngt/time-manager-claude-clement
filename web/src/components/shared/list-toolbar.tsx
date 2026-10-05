import type { ReactNode } from 'react'

import { LayoutGridIcon, ListIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ViewMode } from '@/stores/preferences'

import { Button } from '@/components/ui/button'

export type ListToolbarProps = {
  actions?: ReactNode
  filters?: ReactNode
  onViewModeChange?: (mode: ViewMode) => void
  search?: ReactNode
  viewMode?: ViewMode
}

export function ListToolbar({
  actions,
  filters,
  onViewModeChange,
  search,
  viewMode,
}: ListToolbarProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center" role="toolbar">
      {search}
      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      <div className="flex items-center gap-2 sm:ml-auto">
        {actions}
        {viewMode && onViewModeChange ? (
          <div aria-label={t('view_mode.label')} className="flex" role="group">
            <Button
              aria-label={t('view_mode.grid')}
              aria-pressed={viewMode === 'grid'}
              onClick={() => {
                onViewModeChange('grid')
              }}
              size="icon"
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            >
              <LayoutGridIcon />
            </Button>
            <Button
              aria-label={t('view_mode.list')}
              aria-pressed={viewMode === 'list'}
              onClick={() => {
                onViewModeChange('list')
              }}
              size="icon"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            >
              <ListIcon />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
