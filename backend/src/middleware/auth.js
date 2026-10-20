// TODO: Replace this placeholder with the real JWT authentication middleware.
export function requireAuth(req, res, next) {
  req.user = null;
  next();
}
