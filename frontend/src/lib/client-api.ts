export async function api<T = any>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.details;
    const messages = [
      ...(detail?.formErrors ?? []),
      ...Object.entries(detail?.fieldErrors ?? {}).flatMap(([field, errors]) =>
        Array.isArray(errors)
          ? errors.map((message) => `${field}: ${message}`)
          : [],
      ),
    ];
    throw new Error(
      body?.error && body.error !== "Validation failed"
        ? body.error
        : messages.length
          ? messages.join("; ")
          : `Request failed (${response.status})`,
    );
  }
  return body as T;
}

export const saveEntity = (entity: string, value: Record<string, any>) => {
  const { id, sn, code, ...payload } = value;
  return api(`${entity}${id ? `/${encodeURIComponent(String(id))}` : ""}`, {
    method: id ? "PATCH" : "POST",
    body: JSON.stringify(payload),
  });
};

export const deleteEntity = (entity: string, id: string) =>
  api(`${entity}/${encodeURIComponent(id)}`, { method: "DELETE" });
