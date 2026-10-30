/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { DirectionProvider } from '@/context/direction-provider'
import { FontProvider } from '@/context/font-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { AuthenticatedLayout } from '../authenticated-layout'

function ProtectedPage() {
  useQuery({
    queryKey: ['protected-probe'],
    queryFn: () => api.get('/protected-probe'),
  })
  return <p>Private page content</p>
}

afterEach(() => useAuthStore.getState().auth.reset())

it('unmounts private content on sign-out and does not refetch its queries', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ data: { success: true, data: [] } })
  useAuthStore
    .getState()
    .auth.setUser({ id: 1, username: 'test-user', role: 1 })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(['status'], {
    system_name: 'New API',
    SidebarModulesAdmin: '',
  })
  const route = createRootRoute({
    component: () => (
      <AuthenticatedLayout>
        <ProtectedPage />
      </AuthenticatedLayout>
    ),
  })
  const router = createRouter({
    routeTree: route,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <FontProvider>
          <DirectionProvider>
            <RouterProvider router={router} />
          </DirectionProvider>
        </FontProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
  expect(await screen.findByText('Private page content')).toBeVisible()
  expect(
    get.mock.calls.filter(([url]) => url === '/protected-probe')
  ).toHaveLength(1)

  act(() => useAuthStore.getState().auth.reset())
  expect(screen.queryByText('Private page content')).not.toBeInTheDocument()
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['protected-probe'] })
  })
  expect(
    get.mock.calls.filter(([url]) => url === '/protected-probe')
  ).toHaveLength(1)
  client.clear()
})
