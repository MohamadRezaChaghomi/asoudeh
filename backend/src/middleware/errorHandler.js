export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.publicMessage || 'خطایی در سرور رخ داد.',
    },
  });
}
