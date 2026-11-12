export class ApiError extends Error {
  constructor(status, fields = {}) {
    super(status === 404 ? "Відправлення не знайдено. Можливо, його вже видалено."
      : status === 400 ? "Сервер відхилив дані. Перевірте заповнені поля."
      : `Сервер не зміг виконати операцію (HTTP ${status}). Спробуйте ще раз.`);
    this.status = status;
    this.fields = fields ?? {};
  }
}

async function request(path, method, signal, data) {
  let response;
  try {
    response = await fetch(path, {
      method,
      signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      headers: data === undefined ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data)
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(error.name === "TimeoutError"
      ? "Сервер не відповів вчасно. Спробуйте ще раз."
      : "Не вдалося з’єднатися з PostService. Перевірте, чи запущено сервер.");
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new ApiError(response.status, problem?.errors);
  }
  return response.status === 204 ? undefined : response.json();
}

export const postingsApi = {
  list: signal => request("/postings", "GET", signal),
  get: (id, signal) => request(`/postings/${id}`, "GET", signal),
  create: (data, signal) => request("/postings", "POST", signal, data),
  update: (id, data, signal) => request(`/postings/${id}`, "PUT", signal, { ...data, id }),
  remove: (id, signal) => request(`/postings/${id}`, "DELETE", signal)
};
