/* Froam — loads the editor; see dist/standalone/modules */
(function () {
  var script = document.currentScript;
  if (!script || window.__FROAM_BOOT__) return;
  var src = new URL(script.src, location.href);
  window.__FROAM_BOOT__ = {
    origin: src.origin,
    open: script.dataset.open === 'true',
    routes: script.dataset.routes || '*',
    projectKey: script.dataset.froamProject || null,
  };
  import(new URL('froam-modules/froam-editor.mjs', src.origin + '/').href).catch(function (error) {
    console.error('[froam] could not load the editor', error);
  });
})();
