import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import test from 'node:test'

const source = (await readFile(new URL('../components/resigned-account-guard.js', import.meta.url), 'utf8'))
  .replace(/^import .*$/gm, '')
  .replace('export default function', 'function')

function mountGuard(response = { status: 200 }) {
  const state = { calls: 0, listeners: new Map(), redirects: [], refreshes: 0, timers: new Map(), nextId: 0 }
  state.runTimer = async () => {
    const entry = state.timers.entries().next().value
    if (!entry) return
    const [id, timer] = entry
    state.timers.delete(id)
    await timer.callback()
  }
  const document = {
    visibilityState: 'visible',
    addEventListener: (name, callback) => state.listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      assert.equal(state.listeners.get(name), callback)
      state.listeners.delete(name)
    },
  }
  const context = vm.createContext({
    document,
    window: {
      setTimeout: (callback, delay) => {
        const id = ++state.nextId
        state.timers.set(id, { callback, delay })
        return id
      },
      clearTimeout: (id) => state.timers.delete(id),
    },
    useEffect: (effect) => { state.cleanup = effect() },
    useRouter: () => ({ replace: (path) => state.redirects.push(path), refresh: () => state.refreshes++ }),
    createClient: () => ({ auth: {
      onAuthStateChange: (callback) => {
        state.authChange = callback
        return { data: { subscription: { unsubscribe: () => { state.unsubscribed = true } } } }
      },
      signOut: async () => { state.signedOut = true },
    } }),
    fetch: async () => { state.calls++; return response },
  })
  vm.runInContext(`${source}\nResignedAccountGuard()`, context)
  return { state, document }
}

test('polls every ten minutes, skips hidden tabs, checks on return, and cleans up', async () => {
  const { state, document } = mountGuard()
  await state.runTimer()
  assert.equal(state.calls, 0)
  state.authChange('SIGNED_IN', { user: { id: 'user' } })
  await state.runTimer()
  assert.equal(state.calls, 1)
  assert.equal([...state.timers.values()][0].delay, 600_000)
  document.visibilityState = 'hidden'
  await state.listeners.get('visibilitychange')()
  await state.runTimer()
  assert.equal(state.calls, 1)
  document.visibilityState = 'visible'
  await state.listeners.get('visibilitychange')()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(state.calls, 2)
  assert.equal(state.refreshes, 0)
  state.cleanup()
  assert.equal(state.listeners.size, 0)
  assert.equal(state.timers.size, 0)
  assert.equal(state.unsubscribed, true)
  await state.runTimer()
  assert.equal(state.calls, 2)
})

test('still signs out and redirects when the server reports a resigned account', async () => {
  const { state } = mountGuard({ status: 403, json: async () => ({ reason: 'resigned' }) })
  state.authChange('SIGNED_IN', { user: { id: 'user' } })
  await state.runTimer()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(state.signedOut, true)
  assert.deepEqual(state.redirects, ['/login?reason=inactive'])
  assert.equal(state.refreshes, 1)
  await state.runTimer()
  assert.equal(state.calls, 1)
  state.cleanup()
})

test('returning to a tab replaces the old timer with a full ten-minute delay', async () => {
  const { state, document } = mountGuard()
  state.authChange('INITIAL_SESSION', { user: { id: 'user' } })
  await state.runTimer()
  const oldId = [...state.timers.keys()][0]
  document.visibilityState = 'hidden'
  state.listeners.get('visibilitychange')()
  assert.equal(state.timers.size, 0)
  document.visibilityState = 'visible'
  state.listeners.get('visibilitychange')()
  state.listeners.get('visibilitychange')()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(state.calls, 2)
  assert.equal(state.timers.size, 1)
  assert.equal(state.timers.has(oldId), false)
  assert.equal([...state.timers.values()][0].delay, 600_000)
  state.cleanup()
})

test('same-user auth events do not add checks, but sign-out stops polling', async () => {
  const { state } = mountGuard()
  const session = { user: { id: 'user' } }
  state.authChange('INITIAL_SESSION', session)
  await state.runTimer()
  const timerId = [...state.timers.keys()][0]
  state.authChange('SIGNED_IN', session)
  state.authChange('TOKEN_REFRESHED', session)
  assert.equal(state.calls, 1)
  assert.deepEqual([...state.timers.keys()], [timerId])
  state.authChange('SIGNED_OUT', null)
  assert.equal(state.timers.size, 0)
  state.authChange('SIGNED_IN', { user: { id: 'other-user' } })
  assert.equal([...state.timers.values()][0].delay, 0)
  await state.runTimer()
  assert.equal(state.calls, 2)
  state.cleanup()
})

test('transient failures retry after ten minutes without logging out', async () => {
  const { state } = mountGuard({ status: 503 })
  state.authChange('SIGNED_IN', { user: { id: 'user' } })
  await state.runTimer()
  assert.equal(state.signedOut, undefined)
  assert.equal([...state.timers.values()][0].delay, 600_000)
  state.cleanup()
})
