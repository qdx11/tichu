import { signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { auth } from './config'
import type { User } from 'firebase/auth'

// Firebase Auth가 localStorage에서 세션을 복원할 때까지 대기
let authReadyPromise: Promise<void> | null = null
function waitForAuthReady(): Promise<void> {
  if (authReadyPromise) return authReadyPromise
  authReadyPromise = new Promise<void>(resolve => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub()
      resolve()
    })
  })
  return authReadyPromise
}

let signingIn: Promise<User> | null = null

export async function ensureAnonymousAuth(): Promise<User> {
  // 페이지 새로고침 후 Firebase가 이전 세션 복원할 때까지 대기
  await waitForAuthReady()

  const current = auth.currentUser
  if (current) return current

  // 동시 호출 방지
  if (signingIn) return signingIn

  signingIn = signInAnonymously(auth).then(({ user }) => {
    signingIn = null
    return user
  })
  return signingIn
}

export function onAuthReady(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser() {
  return auth.currentUser
}
