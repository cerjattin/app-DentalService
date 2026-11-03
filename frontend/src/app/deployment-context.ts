const environments: Record<string, string> = { development: 'Development', qa: 'QA', pilot: 'Clinic pilot', production: 'Production' }

export function deploymentContext(environment: unknown, version: unknown) {
  const key = typeof environment === 'string' ? environment.trim().toLowerCase() : ''
  const label = Object.hasOwn(environments, key) ? environments[key] : 'Environment not identified'
  const release = typeof version === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(version) ? version : 'Version not identified'
  return { label, release }
}
