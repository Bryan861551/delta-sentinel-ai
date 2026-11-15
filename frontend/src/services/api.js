// All calls go through the Vite proxy (dev) or the same host (production).
async function request(url, options = {}) {
  // Short requests give up after 20 s so the page never stays on "Loading…" forever.
  let timer;
  if (!options.signal) {
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), 20000);
    options = { ...options, signal: ctrl.signal };
  }
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    if (e.name === "AbortError") {
      throw e;
    }
    throw new Error("Cannot reach the backend. Is start_backend.bat running?");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  return res;
}

export async function getRegion() {
  return (await (await request("/api/regions")).json())[0];
}

export async function getDatasets() {
  return (await request("/api/datasets")).json();
}

export async function getGeoJSON(file) {
  return (await request(`/data/${file}`)).json();
}

export async function compare(source, dateA, dateB) {
  // Never wait forever: stop after 3 minutes and tell the user.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  try {
    const res = await request("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, date_a: dateA, date_b: dateB }),
      signal: ctrl.signal,
    });
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("The comparison took more than 3 minutes. Check the backend window for messages starting with [compare].");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const geojsonUrl = (id) => `/api/results/${id}/geojson`;
export const reportUrl = (id) => `/api/report/${id}`;
