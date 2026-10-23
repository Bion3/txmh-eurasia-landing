// Bound the whole operation, including waits before the HTTP request starts.
export async function withRequestDeadline(operation, milliseconds = 15000) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Request timed out. Submission status is unconfirmed; your details are preserved.');
      error.name = 'TimeoutError';
      controller.abort(error);
      reject(error);
    }, milliseconds);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
