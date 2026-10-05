import type { ReactNode } from 'react'

import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type ChartCardProps = {
  children: ReactNode
  description: string
  empty: boolean
  summary: string
  table: { headers: string[]; rows: string[][] }
  title: string
}

export function ChartCard({ children, description, empty, summary, table, title }: ChartCardProps) {
  const { t } = useTranslation('reports')
  const [asTable, setAsTable] = useState(false)
  const titleId = useId()

  return (
    <Card aria-labelledby={titleId} role="region">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <h2 className="leading-none font-semibold" id={titleId}>
            {title}
          </h2>
          {empty ? null : (
            <Button
              aria-pressed={asTable}
              onClick={() => {
                setAsTable((current) => !current)
              }}
              size="sm"
              variant="ghost"
            >
              {asTable ? t('chart.view_chart') : t('chart.view_table')}
            </Button>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="grid h-64 place-items-center text-sm text-muted-foreground">
            {t('chart.empty')}
          </p>
        ) : asTable ? (
          <div className="max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.headers.map((header) => (
                    <TableHead key={header}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row) => (
                  <TableRow key={row[0]}>
                    {row.map((cell, index) => (
                      <TableCell className="tabular-nums" key={index}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <>
            <div aria-label={summary} className="h-64 w-full" role="img">
              {children}
            </div>
            <table className="sr-only">
              <caption>{title}</caption>
              <thead>
                <tr>
                  {table.headers.map((header) => (
                    <th key={header} scope="col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td key={index}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
