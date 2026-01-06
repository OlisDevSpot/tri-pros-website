export function checkUserRole(email: string) {
  if (email.endsWith('@triprosremodeling.com')) {
    return 'agent'
  }
  return 'homeowner'
}
