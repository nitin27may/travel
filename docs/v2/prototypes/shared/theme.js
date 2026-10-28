/* One theme for the three prototypes: localStorage 'proto.theme' = 'light' | 'dark'. When unset it follows prefers-color-scheme.
   Load this file in <head>, before the stylesheet is painted, so data-theme is set before first paint.
   ProtoTheme.get() -> 'light'|'dark' (the applied theme), .set(t) saves and applies, .toggle() flips, .stored() -> saved value or null.
   A change in another tab or app is applied through the storage event. Node: require('./theme.js') exports the same API for tests
   (pass a fake document and storage through ProtoTheme.init). */
(function (root) {
  'use strict';
  var KEY = 'proto.theme';
  var doc = typeof document !== 'undefined' ? document : null, store = null;
  try { store = typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { store = null; }
  function stored() { try { var v = store && store.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } }
  function system() { try { return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function apply(t) { if (doc && doc.documentElement) doc.documentElement.setAttribute('data-theme', t); return t; }
  function get() { return (doc && doc.documentElement && doc.documentElement.getAttribute('data-theme')) || stored() || system(); }
  function set(t) { t = t === 'dark' ? 'dark' : 'light'; try { if (store) store.setItem(KEY, t); } catch (e) { /* private mode: apply only */ } return apply(t); }
  function toggle() { return set(get() === 'dark' ? 'light' : 'dark'); }
  function init(opts) { if (opts) { doc = opts.document || doc; store = opts.storage || store; } return apply(stored() || system()); }
  var api = { KEY: KEY, get: get, set: set, toggle: toggle, stored: stored, init: init };
  init();
  if (root.addEventListener) root.addEventListener('storage', function (e) { if (e.key === KEY) apply(stored() || system()); });
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ProtoTheme = api;
})(typeof window !== 'undefined' ? window : globalThis);
