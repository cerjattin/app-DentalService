import type { AuthenticatedUser } from '../types/auth'

let accessToken: string | null = null
let authenticatedUser: AuthenticatedUser | null = null

export const authStore = {
  getAccessToken() {
    return accessToken
  },
  setAccessToken(token: string) {
    accessToken = token
  },
  getUser() {
    return authenticatedUser
  },
  setUser(user: AuthenticatedUser) {
    authenticatedUser = user
  },
  setSession(token: string, user: AuthenticatedUser) {
    accessToken = token
    authenticatedUser = user
  },
  clearSession() {
    accessToken = null
    authenticatedUser = null
  },
}
