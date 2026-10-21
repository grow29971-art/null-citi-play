/* One-use PKCE transport and same-origin refresh-session storage. Access tokens stay in memory. */
(function (root) {
  'use strict';
  const key = 'null-citi-account-pkce-v1';
  const sessionKey = 'null-citi-refresh-session-v1';
  const url = new URL(root.location.href);
  let returned = null;
  const hash = new URLSearchParams(url.hash.slice(1));
  const implicit = hash.has('access_token') || hash.has('refresh_token');
  if (url.searchParams.has('nc_state') &&
      (url.searchParams.has('code') || url.searchParams.has('error') || hash.has('error') || implicit)) {
    returned = {
      query: url.search.slice(1),
      error: hash.get('error_code') || hash.get('error') || (implicit ? 'unexpected_implicit_response' : ''),
      redirect: url.origin + url.pathname
    };
    for (const name of ['nc_state', 'code', 'error', 'error_code', 'error_description']) {
      url.searchParams.delete(name);
    }
    if (hash.has('error') || implicit) url.hash = '';
    root.history.replaceState(root.history.state, '', url.pathname + url.search + url.hash);
  } else if (implicit) {
    root.history.replaceState(root.history.state, '', url.pathname + url.search);
  }
  root.NullCitiAccount = Object.freeze({
    baseUrl: () => root.location.origin + root.location.pathname,
    consumeReturn: () => {
      const value = JSON.stringify(returned || {});
      returned = null;
      return value;
    },
    readPending: () => {
      try { return root.sessionStorage.getItem(key) || '{}'; }
      catch (_) { return '{}'; }
    },
    clearPending: () => {
      try { root.sessionStorage.removeItem(key); } catch (_) { /* storage may be disabled */ }
    },
    readSession: () => {
      try { return root.localStorage.getItem(sessionKey) || ''; } catch (_) { return ''; }
    },
    writeSession: (value) => {
      try {
        if (typeof value !== 'string' || value.length > 32768) return false;
        root.localStorage.setItem(sessionKey, value);
        return true;
      } catch (_) { return false; }
    },
    clearSession: () => {
      try { root.localStorage.removeItem(sessionKey); } catch (_) { /* storage may be disabled */ }
    },
    begin: (pending, destination) => {
      try {
        if (pending.length > 4096 || new URL(destination).protocol !== 'https:') return false;
        root.sessionStorage.setItem(key, pending);
        root.location.assign(destination);
        return true;
      } catch (_) { return false; }
    }
  });
})(globalThis);
