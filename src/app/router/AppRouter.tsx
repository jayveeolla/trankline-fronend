import type { ReactNode } from 'react'
import { resolveAppRoute, type AppRoute } from './routes'

export const matchAppRoute = resolveAppRoute

type AppRouterProps = {
  pathname: string
  render: (route: AppRoute) => ReactNode
}

/** The route outlet is intentionally small; the shared shell owns navigation and this owns URL matching. */
export default function AppRouter({ pathname, render }: AppRouterProps) {
  return render(resolveAppRoute(pathname))
}
