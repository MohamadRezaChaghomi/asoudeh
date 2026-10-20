export function healthCheck(req, res) {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'asoudeh-backend',
      timestamp: new Date().toISOString(),
    },
  });
}
