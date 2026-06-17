// Bind a request's user identity to the verified session token. The acting
// account is ALWAYS the phone in req.auth (set by requireAuth) — never a phone
// or birth detail the client placed in the body/query. Without this, any authed
// caller could read or charge another account by submitting that person's phone
// + birth details (IDOR). Mirrors the override in userController.saveProfile.
export function withAuthPhone(req, src) {
  return { ...(src || {}), phone: req.auth?.phone };
}
