export type NavMatch = { end?: boolean; to: string }

export function isNavActive(item: NavMatch, pathname: string): boolean {
  if (item.end === true) {
    return pathname === item.to
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
