"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/publish-store.mjs
var publish_store_exports = {};
__export(publish_store_exports, {
  FroamStaleRevisionError: () => FroamStaleRevisionError,
  PRESENCE_TTL_MS: () => PRESENCE_TTL_MS,
  createFileProjectDocumentStore: () => createFileProjectDocumentStore,
  createFroamIntelligenceApi: () => createFroamIntelligenceApi,
  createFroamProjectSyncApi: () => createFroamProjectSyncApi,
  createFroamPublishApi: () => createFroamPublishApi,
  createFroamRoomApi: () => createFroamRoomApi,
  createGitHubCommitter: () => createGitHubCommitter,
  createMemoryProjectDocumentStore: () => createMemoryProjectDocumentStore,
  createOpenAICompatibleProvider: () => createOpenAICompatibleProvider,
  loadPublished: () => loadPublished
});
module.exports = __toCommonJS(publish_store_exports);
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);

// lib/codegen.mjs
var DESIGN_VERSION = 3;
var CANVAS_KEY = "__froam_canvas__";
var INJECTION_KEY = "__froam_injection__";
var VIEWPORTS = ["desktop", "tablet", "mobile"];
var MEDIA = {
  desktop: "@media (min-width: 1025px)",
  tablet: "@media (min-width: 641px) and (max-width: 1024px)",
  mobile: "@media (max-width: 640px)"
};
function normalizeRouteKey(value) {
  let p = String(value || "/").split("?")[0].split("#")[0];
  p = p.replace(/\/index\.html?$/i, "/");
  p = p.replace(/\/+$/, "");
  return p || "/";
}
function camelToKebab(value) {
  return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
var GOOGLE_FONTS = {
  Inter: "400;500;600;700;800;900",
  Manrope: "400;500;600;700;800",
  "DM Sans": "400;500;700",
  "Plus Jakarta Sans": "400;500;600;700;800",
  "Space Grotesk": "400;500;600;700",
  Urbanist: "400;500;600;700;800;900",
  Outfit: "400;500;600;700;800;900",
  Poppins: "400;500;600;700;800;900",
  Montserrat: "400;500;600;700;800;900",
  "Playfair Display": "400;500;600;700;800;900",
  "Cormorant Garamond": "400;500;600;700",
  Lora: "400;500;600;700",
  Merriweather: "400;700;900",
  Fraunces: "400;500;600;700;800;900",
  "JetBrains Mono": "400;500;600;700;800",
  "IBM Plex Mono": "400;500;600;700",
  "Space Mono": "400;700"
};
var FONTSHARE_FONTS = {
  Satoshi: "satoshi@400,500,700,900",
  "Cabinet Grotesk": "cabinet-grotesk@400,500,700,800"
};
function primaryFamily(fontFamilyValue) {
  if (!fontFamilyValue) return null;
  const first = String(fontFamilyValue).split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first || null;
}
function collectDesignFontFamilies(design) {
  const families = /* @__PURE__ */ new Set();
  for (const viewports of Object.values(design.routes ?? {})) {
    for (const viewport of VIEWPORTS) {
      const store = viewports?.[viewport];
      if (!store) continue;
      for (const [draftPath, draft] of Object.entries(store)) {
        if (!draft) continue;
        const fromStyle = primaryFamily(draft.styles?.fontFamily);
        if (fromStyle) families.add(fromStyle);
        if (draftPath.startsWith(`${INJECTION_KEY}:`) && typeof draft.text === "string") {
          const text = draft.text.replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&apos;/g, "'");
          for (const match of text.matchAll(/font-family:\s*([^;}<]+)/gi)) {
            const family = primaryFamily(match[1]);
            if (family) families.add(family);
          }
        }
      }
    }
  }
  return [...families];
}
function fontStylesheetUrls(families) {
  const google = [];
  const fontshare = [];
  const seen = /* @__PURE__ */ new Set();
  for (const family of families) {
    if (!family || seen.has(family)) continue;
    seen.add(family);
    if (GOOGLE_FONTS[family]) {
      google.push(`family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${GOOGLE_FONTS[family]}`);
    } else if (FONTSHARE_FONTS[family]) {
      fontshare.push(`f[]=${FONTSHARE_FONTS[family]}`);
    }
  }
  const urls = [];
  if (google.length) urls.push(`https://fonts.googleapis.com/css2?${google.sort().join("&")}&display=swap`);
  if (fontshare.length) urls.push(`https://api.fontshare.com/v2/css?${fontshare.sort().join("&")}&display=swap`);
  return urls;
}
function cssEscapeAttr(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function isSpecialPath(draftPath) {
  return draftPath === CANVAS_KEY || draftPath.startsWith(`${INJECTION_KEY}:`) || draftPath.startsWith("__froam");
}
function pathToSelector(draftPath) {
  const segments = draftPath.split("/").filter(Boolean);
  const parts = [];
  for (const segment of segments) {
    const [tag, indexRaw] = segment.split(":");
    const index = Number(indexRaw);
    if (!tag || !/^[a-z][a-z0-9-]*$/i.test(tag) || !Number.isInteger(index) || index < 1) return null;
    parts.push(`${tag.toLowerCase()}:nth-of-type(${index})`);
  }
  if (!parts.length) return null;
  return `:where([data-froam-root], #root, #__next) > ${parts.join(" > ")}`;
}
function declarations(styles, indent) {
  const lines = [];
  for (const [key, value] of Object.entries(styles ?? {})) {
    if (key === "customCSS" || value === "" || value == null) continue;
    lines.push(`${indent}${camelToKebab(key)}: ${value} !important;`);
  }
  return lines;
}
function generateCss(design) {
  const out = [
    "/* Generated by froam-studio (Repo Mode) \u2014 do not edit by hand.",
    '   Edit visually in the Froam editor, then "Save to Repo". */',
    ""
  ];
  const fontUrls = fontStylesheetUrls(collectDesignFontFamilies(design));
  if (fontUrls.length) {
    out.push("/* \u2500\u2500 fonts used by this design \u2500\u2500 */");
    for (const url of fontUrls) out.push(`@import url("${url}");`);
    out.push("");
  }
  const customCssBlocks = [];
  for (const [routeKey, viewports] of Object.entries(design.routes ?? {})) {
    for (const viewport of VIEWPORTS) {
      const store = viewports?.[viewport];
      if (!store || !Object.keys(store).length) continue;
      const scope = `html[data-froam-route="${cssEscapeAttr(normalizeRouteKey(routeKey))}"]:not([data-chef-editing])`;
      const rules = [];
      for (const [draftPath, draft] of Object.entries(store)) {
        if (draftPath === CANVAS_KEY) {
          const decls2 = declarations(draft?.styles, "    ");
          if (decls2.length) rules.push(`  ${scope} [data-froam-canvas] {
${decls2.join("\n")}
  }`);
          if (draft?.styles?.customCSS) customCssBlocks.push(draft.styles.customCSS);
          continue;
        }
        if (isSpecialPath(draftPath) || !draft?.styles) continue;
        const selector = pathToSelector(draftPath);
        if (!selector) continue;
        const decls = declarations(draft.styles, "    ");
        if (!decls.length) continue;
        rules.push(`  ${scope} ${selector} {
${decls.join("\n")}
  }`);
      }
      if (!rules.length) continue;
      out.push(`/* \u2500\u2500 ${routeKey} \xB7 ${viewport} \u2500\u2500 */`);
      out.push(`${MEDIA[viewport]} {`);
      out.push(rules.join("\n\n"));
      out.push("}");
      out.push("");
    }
  }
  if (customCssBlocks.length) {
    out.push("/* \u2500\u2500 Custom CSS (canvas) \u2500\u2500 */");
    out.push(customCssBlocks.join("\n\n"));
    out.push("");
  }
  return out.join("\n");
}
function generateRuntimeJs(design) {
  const routes = {};
  for (const [routeKey, viewports] of Object.entries(design.routes ?? {})) {
    const slim = {};
    for (const viewport of VIEWPORTS) {
      const store = viewports?.[viewport];
      if (!store) continue;
      const kept = {};
      for (const [draftPath, draft] of Object.entries(store)) {
        if (!draft) continue;
        const entry = {};
        if (draftPath === CANVAS_KEY) {
          if (draft.styles?.customCSS) entry.customCSS = draft.styles.customCSS;
        } else if (draftPath.startsWith(`${INJECTION_KEY}:`)) {
          if (draft.text !== void 0) entry.text = draft.text;
        } else {
          if (draft.text !== void 0) entry.text = draft.text;
          if (draft.imageUrl !== void 0) entry.imageUrl = draft.imageUrl;
        }
        if (Object.keys(entry).length) kept[draftPath] = entry;
      }
      if (Object.keys(kept).length) slim[viewport] = kept;
    }
    if (Object.keys(slim).length) routes[routeKey] = slim;
  }
  const designJson = JSON.stringify({ version: design.version ?? DESIGN_VERSION, routes });
  return `/* Generated by froam-studio (Repo Mode) \u2014 do not edit by hand.
   Zero-dependency Froam runtime: route attribute + text/image/injected
   drafts for sites that don't mount the React <FroamRuntime/>. */
;(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.__FROAM_VANILLA_RUNTIME__) return
  window.__FROAM_VANILLA_RUNTIME__ = true

  var DESIGN = ${designJson}
  var CANVAS_KEY = '${CANVAS_KEY}'
  var INJECTION_PREFIX = '${INJECTION_KEY}:'
  var ROOT_PARENT_KEY = '__froam_root__'
  var TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'label', 'button', 'a', 'li']

  function getRoot() {
    return (
      document.querySelector('[data-froam-root]') ||
      document.getElementById('root') ||
      document.getElementById('__next') ||
      document.querySelector('main') ||
      document.body
    )
  }

  function viewportMode() {
    if (window.matchMedia('(max-width: 640px)').matches) return 'mobile'
    if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet'
    return 'desktop'
  }

  function findByPath(root, pathValue) {
    var segments = pathValue.split('/').filter(Boolean)
    var current = root
    for (var i = 0; i < segments.length; i += 1) {
      var pieces = segments[i].split(':')
      var tag = pieces[0]
      var index = Number(pieces[1]) - 1
      if (!tag || isNaN(index) || index < 0 || !current) return null
      var matches = []
      for (var c = 0; c < current.children.length; c += 1) {
        var child = current.children[c]
        if (child.tagName && child.tagName.toLowerCase() === tag) matches.push(child)
      }
      current = matches[index] || null
    }
    return current
  }

  function canApplyText(element) {
    var tag = element.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea') return false
    if (element.children.length === 0) return true
    return TEXT_TAGS.indexOf(tag) !== -1
  }

  function clearInjected(root) {
    var injected = root.querySelectorAll('[data-froam-runtime-injected="true"]')
    for (var i = 0; i < injected.length; i += 1) injected[i].parentNode.removeChild(injected[i])
  }

  function applyInjections(root, store) {
    var blocks = []
    for (var key in store) {
      if (key.indexOf(INJECTION_PREFIX) !== 0 || !store[key].text) continue
      try {
        var parsed = JSON.parse(store[key].text)
        if (typeof parsed.html === 'string' && typeof parsed.parentPath === 'string') {
          blocks.push({ html: parsed.html, parentPath: parsed.parentPath, order: typeof parsed.order === 'number' ? parsed.order : 0 })
        }
      } catch (e) { /* skip malformed */ }
    }
    blocks.sort(function (a, b) { return a.order - b.order })
    for (var i = 0; i < blocks.length; i += 1) {
      var parent = blocks[i].parentPath === ROOT_PARENT_KEY ? root : findByPath(root, blocks[i].parentPath)
      if (!parent) continue
      var template = document.createElement('template')
      template.innerHTML = blocks[i].html.trim()
      var node = template.content.firstElementChild
      if (!node) continue
      node.setAttribute('data-froam-runtime-injected', 'true')
      node.removeAttribute('data-chef-selected')
      node.removeAttribute('data-chef-hovered')
      parent.appendChild(node)
    }
  }

  function applyCustomCss(css) {
    var styleEl = document.getElementById('froam-global-styles')
    if (css) {
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'froam-global-styles'
        document.head.appendChild(styleEl)
      }
      if (styleEl.textContent !== css) styleEl.textContent = css
    } else if (styleEl) {
      styleEl.textContent = ''
    }
  }

  function normRoute(value) {
    var p = String(value || '/').split('?')[0].split('#')[0]
    p = p.replace(/\\/index\\.html?$/i, '/')
    p = p.replace(/\\/+$/, '')
    return p || '/'
  }

  function apply() {
    if (document.documentElement.hasAttribute('data-chef-editing')) return
    var routeKey = normRoute(window.location.pathname)
    document.documentElement.setAttribute('data-froam-route', routeKey)

    var root = getRoot()
    if (!root) return
    if (!root.hasAttribute('data-froam-root')) root.setAttribute('data-froam-root', '')

    clearInjected(root)
    var route = DESIGN.routes[routeKey]
    var store = route && route[viewportMode()]
    if (!store) { applyCustomCss(''); return }

    applyInjections(root, store)

    for (var key in store) {
      if (key === CANVAS_KEY) { applyCustomCss(store[key].customCSS || ''); continue }
      if (key.indexOf('__froam') === 0) continue
      var target = findByPath(root, key)
      if (!target) continue
      var draft = store[key]
      if (draft.text !== undefined && canApplyText(target) && target.innerText !== draft.text) {
        target.innerText = draft.text
      }
      if (draft.imageUrl !== undefined && target.tagName.toLowerCase() === 'img') {
        if (draft.imageUrl && target.getAttribute('src') !== draft.imageUrl) target.src = draft.imageUrl
        if (!draft.imageUrl && target.hasAttribute('src')) target.removeAttribute('src')
      }
    }
  }

  var frame = 0
  function scheduleApply() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(apply)
  }

  function patchHistory(method) {
    var original = window.history[method]
    window.history[method] = function () {
      var result = original.apply(this, arguments)
      scheduleApply()
      return result
    }
  }

  function start() {
    apply()
    patchHistory('pushState')
    patchHistory('replaceState')
    window.addEventListener('popstate', scheduleApply)
    window.addEventListener('resize', scheduleApply)
    var root = getRoot()
    if (root && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i += 1) {
          var node = mutations[i].target
          if (node && node.closest && node.closest('[data-froam-runtime-injected="true"], [data-chef-editor-root]')) continue
          scheduleApply()
          return
        }
      })
      observer.observe(root, { childList: true, subtree: true })
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
`;
}
function buildDesignArtifacts(design) {
  return {
    design: JSON.stringify(design, null, 2) + "\n",
    css: generateCss(design),
    runtime: generateRuntimeJs(design)
  };
}

// lib/github-committer.mjs
var API = "https://api.github.com";
function assert(value, message) {
  if (!value) throw new Error(`[froam] ${message}`);
}
function toBase64(text) {
  return Buffer.from(text, "utf8").toString("base64");
}
function createGitHubCommitter(options = {}) {
  const {
    token,
    repo,
    branch = "main",
    dir = "froam",
    committer,
    fetchImpl = globalThis.fetch
  } = options;
  assert(token, "createGitHubCommitter needs a token with contents:write");
  assert(repo && repo.includes("/"), 'createGitHubCommitter needs repo as "owner/name"');
  assert(fetchImpl, "createGitHubCommitter needs a fetch implementation (Node 18+)");
  async function gh(path4, init = {}) {
    const response = await fetchImpl(`${API}${path4}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "froam-studio",
        ...init.body ? { "Content-Type": "application/json" } : {},
        ...init.headers
      }
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const detail = body?.message ? `: ${body.message}` : "";
      throw new Error(`[froam] GitHub ${init.method ?? "GET"} ${path4} failed (${response.status})${detail}`);
    }
    return body;
  }
  async function currentSha(path4) {
    try {
      const existing = await gh(`/repos/${repo}/contents/${encodeURI(path4)}?ref=${encodeURIComponent(branch)}`);
      return Array.isArray(existing) ? null : existing?.sha ?? null;
    } catch (error) {
      if (String(error.message).includes("(404)")) return null;
      throw error;
    }
  }
  async function putFile(path4, content, message) {
    const sha = await currentSha(path4);
    return gh(`/repos/${repo}/contents/${encodeURI(path4)}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: toBase64(content),
        branch,
        ...sha ? { sha } : {},
        ...committer ? { committer } : {}
      })
    });
  }
  return async function commitDesign({ design, message, paths } = {}) {
    assert(design && typeof design === "object", "commitDesign needs a design");
    const artifacts = buildDesignArtifacts(design);
    const base = dir.replace(/\/+$/, "");
    const targets = paths ?? {
      design: `${base}/froam.design.json`,
      css: `${base}/froam.generated.css`,
      runtime: `${base}/froam.runtime.js`
    };
    const subject = message || "Design update from Froam";
    const written = [];
    for (const [key, path4] of Object.entries(targets)) {
      const content = artifacts[key];
      if (typeof content !== "string") continue;
      const result = await putFile(path4, content, subject);
      written.push({ path: path4, commit: result?.commit?.sha ?? null });
    }
    assert(written.length, "commitDesign wrote nothing \u2014 check `paths`");
    return { repo, branch, written };
  };
}

// lib/room-store.mjs
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_crypto = require("node:crypto");
var ROLES = /* @__PURE__ */ new Set(["owner", "editor", "commenter", "viewer"]);
var ROLE_RANK = { owner: 60, editor: 40, commenter: 10, viewer: 0 };
var MAX_COMMENT_LENGTH = 4e3;
var MAX_COMMENTS = 500;
var MAX_BODY_BYTES = 2e5;
var MAX_NAME_LENGTH = 60;
var MAX_PRESENCE_LABEL_LENGTH = 80;
var MAX_AVATAR_LENGTH = 12e4;
var MAX_MEMBERS = 50;
var MAX_CHAT_MESSAGES = 500;
var MAX_CHAT_LENGTH = 2e3;
var MAX_OPS_PER_PUSH = 500;
var MAX_ROOM_EVENTS = 2e4;
var MAX_EVENT_PAGE = 500;
var MEMBER_COLORS = ["#5eead4", "#ff8a65", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fde047", "#86efac", "#67e8f9"];
var PRESENCE_TTL_MS = 9e4;
function emptyRooms() {
  return { version: 1, rooms: {} };
}
function loadRooms(file) {
  try {
    const parsed = JSON.parse(import_node_fs.default.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && parsed.rooms && typeof parsed.rooms === "object") {
      return parsed;
    }
  } catch {
  }
  return emptyRooms();
}
function saveRooms(file, rooms) {
  import_node_fs.default.mkdirSync(import_node_path.default.dirname(file), { recursive: true });
  import_node_fs.default.writeFileSync(file, JSON.stringify(rooms, null, 2) + "\n");
}
function fileStorage(file) {
  return {
    get(roomId) {
      return loadRooms(file).rooms[roomId] ?? null;
    },
    put(room) {
      const all = loadRooms(file);
      all.rooms[room.id] = room;
      saveRooms(file, all);
    }
  };
}
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
function mintToken() {
  return (0, import_node_crypto.randomBytes)(18).toString("base64url");
}
function cleanName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  return trimmed || null;
}
function cleanCursor(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.max(-1e4, Math.min(1e5, x)), y: Math.max(-1e4, Math.min(1e5, y)) };
}
function cleanNodeId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(trimmed) ? trimmed : null;
}
function cleanPresenceLabel(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, MAX_PRESENCE_LABEL_LENGTH);
  return trimmed || null;
}
function cleanAvatarUrl(value) {
  if (typeof value !== "string" || value.length > MAX_AVATAR_LENGTH) return null;
  const trimmed = value.trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed.slice(0, 2e3);
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) return trimmed;
  return null;
}
function colorForActor(actor) {
  let hash = 0;
  for (let i = 0; i < actor.length; i += 1) hash = (hash << 5) - hash + actor.charCodeAt(i) | 0;
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}
function nextSequence(room) {
  room.sequence = Math.max(Number(room.sequence) || 0, ...(room.events ?? []).map((event) => Number(event.seq) || 0)) + 1;
  return room.sequence;
}
function appendEvent(room, event) {
  room.events = Array.isArray(room.events) ? room.events : [];
  const complete = { seq: nextSequence(room), createdAt: Date.now(), ...event };
  room.events.push(complete);
  trimEvents(room);
  return complete;
}
function trimEvents(room) {
  while (room.events.length > MAX_ROOM_EVENTS) {
    const transient = room.events.findIndex((event) => event.type !== "op");
    if (transient < 0) break;
    room.events.splice(transient, 1);
  }
}
function appendOpEvent(room, raw, actor, stamp) {
  room.events = Array.isArray(room.events) ? room.events : [];
  const seq = nextSequence(room);
  const op = canonicalOp(raw, actor, seq, stamp);
  const event = { seq, type: "op", createdAt: stamp, actor, op };
  room.events.push(event);
  trimEvents(room);
  return event;
}
function isSafeOp(value, actor) {
  if (!value || typeof value !== "object") return false;
  if (value.actor !== actor || typeof value.id !== "string" || !value.id || value.id.length > 160) return false;
  if (!["edit", "undo", "redo"].includes(value.kind)) return false;
  if (typeof value.routeKey !== "string" || typeof value.path !== "string" || !value.path || value.path.length > 2e3) return false;
  if (!VIEWPORTS.includes(value.viewport)) return false;
  if (typeof value.field !== "string" || !/^(text|imageUrl|style:[A-Za-z0-9_-]{1,100})$/.test(value.field)) return false;
  if (value.before !== void 0 && typeof value.before !== "string") return false;
  if (value.after !== void 0 && typeof value.after !== "string") return false;
  if ((value.before?.length ?? 0) > 2e6 || (value.after?.length ?? 0) > 2e6) return false;
  return true;
}
function canonicalOp(value, actor, clock, stamp) {
  return {
    id: value.id,
    kind: value.kind,
    actor,
    clock,
    ts: Number.isFinite(value.ts) ? value.ts : stamp,
    routeKey: normalizeRouteKey(value.routeKey),
    viewport: value.viewport,
    path: value.path,
    nodeId: cleanNodeId(value.nodeId) ?? void 0,
    field: value.field,
    before: value.before,
    after: value.after,
    label: typeof value.label === "string" ? value.label.slice(0, 120) : void 0,
    batch: typeof value.batch === "string" ? value.batch.slice(0, 160) : void 0,
    targets: typeof value.targets === "string" ? value.targets.slice(0, 160) : void 0,
    structure: value.structure && typeof value.structure === "object" ? value.structure : void 0
  };
}
function sameField(a, b) {
  return a.routeKey === b.routeKey && a.viewport === b.viewport && a.path === b.path && a.field === b.field;
}
function memberFor(room, actor, session) {
  if (typeof actor !== "string" || typeof session !== "string") return null;
  const member = room.members[actor];
  return member?.session === session ? member : null;
}
function routeAllowed(room, routeKey) {
  const normalized = normalizeRouteKey(routeKey ?? "/");
  return room.routes === "*" || room.routes.includes(normalized);
}
function isHere(member, now) {
  return typeof member.seenAt === "number" && now - member.seenAt < PRESENCE_TTL_MS;
}
function publicMember(member, now) {
  return {
    actor: member.actor,
    name: member.name,
    role: member.role,
    color: member.color ?? colorForActor(member.actor),
    avatarUrl: member.avatarUrl ?? null,
    here: isHere(member, now),
    routeKey: member.routeKey ?? null,
    viewport: member.viewport ?? null,
    selectedPath: member.selectedPath ?? null,
    selectedNodeId: member.selectedNodeId ?? null,
    lockedPath: member.lockedPath ?? null,
    lockedNodeId: member.lockedNodeId ?? null,
    cursor: member.cursor ?? null,
    tool: member.tool ?? null,
    action: member.action ?? null,
    seenAt: member.seenAt ?? null
  };
}
function publicRoom(room, now, you) {
  const members = Object.values(room.members).map((m) => publicMember(m, now));
  return {
    id: room.id,
    routes: room.routes,
    createdAt: room.createdAt,
    members,
    /** Who is driving: the highest-ranked editor currently present. */
    presenter: members.find((m) => m.here && (m.role === "owner" || m.role === "editor"))?.actor ?? null,
    sequence: Number(room.sequence) || 0,
    you: you ?? null
  };
}
function createFroamRoomApi({ file, storage, authorize = null, log = () => {
}, now = () => Date.now() }) {
  if (!storage && !file) throw new Error("[froam] createFroamRoomApi needs a file or a storage");
  const store = storage ?? fileStorage(file);
  const writeRoom = store.put.bind(store);
  const subscribers = /* @__PURE__ */ new Map();
  function signal(roomId, sequence) {
    const listeners = subscribers.get(roomId);
    if (!listeners) return;
    const frame = `event: room
data: ${JSON.stringify({ sequence })}

`;
    for (const response of [...listeners]) {
      try {
        response.write(frame);
      } catch {
        listeners.delete(response);
      }
    }
    if (!listeners.size) subscribers.delete(roomId);
  }
  async function persist(room) {
    await writeRoom(room);
    signal(room.id, Number(room.sequence) || 0);
  }
  return async function handleRoomRequest(req, res) {
    const url = new URL(req.url ?? "/", "http://froam.local");
    const at = url.pathname.indexOf("/rooms");
    if (at < 0) return false;
    const parts = url.pathname.slice(at + "/rooms".length).replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) return false;
    const [roomId, action, commentId, commentAction] = parts;
    const method = (req.method ?? "GET").toUpperCase();
    if (!roomId && method === "POST") {
      if (authorize && !await authorize(req)) {
        sendJson(res, 403, { success: false, error: "Not authorized to open a room" });
        return true;
      }
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { success: false, error: "Invalid JSON body" });
        return true;
      }
      const ownerName = cleanName(body?.name) ?? "Owner";
      const routes = Array.isArray(body?.routes) && body.routes.length ? body.routes.map((r) => normalizeRouteKey(r)).filter(Boolean) : "*";
      const id = (0, import_node_crypto.randomUUID)();
      const ownerActor = `a_${(0, import_node_crypto.randomBytes)(9).toString("base64url")}`;
      const stamp = now();
      const tokens = {};
      const invites = {};
      for (const role2 of ["owner", "editor", "commenter", "viewer"]) {
        const token2 = mintToken();
        tokens[token2] = role2;
        invites[role2] = token2;
      }
      const room2 = {
        id,
        createdAt: stamp,
        routes,
        ownerActor,
        sequence: 0,
        events: [],
        chat: [],
        proposals: {},
        tokens,
        members: {
          [ownerActor]: { actor: ownerActor, session: mintToken(), name: ownerName, role: "owner", color: colorForActor(ownerActor), joinedAt: stamp, seenAt: stamp }
        }
      };
      await persist(room2);
      log(`room ${id} opened`);
      sendJson(res, 200, {
        success: true,
        room: publicRoom(room2, stamp, { actor: ownerActor, role: "owner", name: ownerName }),
        // Returned once, to whoever opened the room. Never in a GET.
        invites,
        you: { actor: ownerActor, role: "owner", name: ownerName, session: room2.members[ownerActor].session }
      });
      return true;
    }
    if (!roomId) {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return true;
    }
    const room = await store.get(roomId);
    if (!room) {
      sendJson(res, 404, { success: false, error: "No such room" });
      return true;
    }
    const tokenFrom = async () => {
      if (method === "GET") return url.searchParams.get("token");
      try {
        const body = await readJsonBody(req);
        req.body = body;
        return body?.token ?? null;
      } catch {
        return null;
      }
    };
    const token = await tokenFrom();
    const role = token ? room.tokens[token] : null;
    if (!role || !ROLES.has(role)) {
      sendJson(res, 403, { success: false, error: "This link is not valid for that room" });
      return true;
    }
    if (action === "stream" && method === "GET") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      res.write?.(`event: ready
data: ${JSON.stringify({ sequence: Number(room.sequence) || 0 })}

`);
      const listeners = subscribers.get(roomId) ?? /* @__PURE__ */ new Set();
      listeners.add(res);
      subscribers.set(roomId, listeners);
      const keepAlive = setInterval(() => {
        try {
          res.write?.(": keepalive\n\n");
        } catch {
        }
      }, 25e3);
      const close = () => {
        clearInterval(keepAlive);
        listeners.delete(res);
        if (!listeners.size) subscribers.delete(roomId);
      };
      req.on?.("close", close);
      res.on?.("close", close);
      return true;
    }
    if (!action && method === "GET") {
      const actor = url.searchParams.get("actor");
      const member = memberFor(room, actor, url.searchParams.get("session"));
      const you = member ? { actor: member.actor, role: member.role, name: member.name } : null;
      sendJson(res, 200, { success: true, room: publicRoom(room, now(), you) });
      return true;
    }
    if (action === "join" && method === "POST") {
      const body = req.body ?? {};
      const name = cleanName(body.name);
      if (!name) {
        sendJson(res, 400, { success: false, error: "Tell us your name so people know who commented" });
        return true;
      }
      if (Object.keys(room.members).length >= MAX_MEMBERS) {
        sendJson(res, 409, { success: false, error: "This room is full" });
        return true;
      }
      const returning = typeof body.actor === "string" && typeof body.session === "string" && room.members[body.actor] && room.members[body.actor].session === body.session;
      const actor = returning ? body.actor : `a_${(0, import_node_crypto.randomBytes)(9).toString("base64url")}`;
      const stamp = now();
      room.members[actor] = {
        ...room.members[actor] ?? {},
        actor,
        session: returning ? room.members[actor].session : mintToken(),
        name,
        // A token cannot promote you past what it grants, and rejoining on a
        // guest link must never quietly demote the owner.
        role: returning ? room.members[actor].role : role,
        color: room.members[actor]?.color ?? colorForActor(actor),
        avatarUrl: cleanAvatarUrl(body.avatarUrl) ?? room.members[actor]?.avatarUrl ?? null,
        joinedAt: room.members[actor]?.joinedAt ?? stamp,
        seenAt: stamp
      };
      await persist(room);
      log(`${name} joined room ${roomId} as ${room.members[actor].role}`);
      sendJson(res, 200, {
        success: true,
        you: { actor, role: room.members[actor].role, name, session: room.members[actor].session },
        room: publicRoom(room, stamp, { actor, role: room.members[actor].role, name })
      });
      return true;
    }
    if (action === "presence" && method === "POST") {
      const body = req.body ?? {};
      const member = memberFor(room, body.actor, body.session);
      if (!member) {
        sendJson(res, 404, { success: false, error: "Join the room first" });
        return true;
      }
      if (typeof body.routeKey === "string" && !routeAllowed(room, body.routeKey)) {
        sendJson(res, 403, { success: false, error: "That route is outside this room" });
        return true;
      }
      const stamp = now();
      member.seenAt = stamp;
      if (typeof body.routeKey === "string") member.routeKey = normalizeRouteKey(body.routeKey);
      if (VIEWPORTS.includes(body.viewport)) member.viewport = body.viewport;
      member.selectedPath = typeof body.selectedPath === "string" ? body.selectedPath : null;
      member.selectedNodeId = cleanNodeId(body.selectedNodeId);
      member.lockedPath = typeof body.lockedPath === "string" ? body.lockedPath : null;
      member.lockedNodeId = cleanNodeId(body.lockedNodeId);
      member.cursor = cleanCursor(body.cursor);
      member.tool = cleanPresenceLabel(body.tool);
      member.action = cleanPresenceLabel(body.action);
      await persist(room);
      sendJson(res, 200, {
        success: true,
        room: publicRoom(room, stamp, { actor: member.actor, role: member.role, name: member.name })
      });
      return true;
    }
    if (action === "events" && method === "GET") {
      const after = Math.max(0, Number.parseInt(url.searchParams.get("after") ?? "0", 10) || 0);
      const limit = Math.max(1, Math.min(MAX_EVENT_PAGE, Number.parseInt(url.searchParams.get("limit") ?? String(MAX_EVENT_PAGE), 10) || MAX_EVENT_PAGE));
      const all = Array.isArray(room.events) ? room.events : [];
      const available = all.filter((event) => event.seq > after);
      const events = available.slice(0, limit);
      const cursor = events.length ? events[events.length - 1].seq : after;
      const actor = url.searchParams.get("actor");
      const member = memberFor(room, actor, url.searchParams.get("session"));
      const you = member ? { actor: member.actor, role: member.role, name: member.name } : null;
      sendJson(res, 200, {
        success: true,
        events,
        cursor,
        hasMore: available.length > events.length,
        room: publicRoom(room, now(), you)
      });
      return true;
    }
    if (action === "ops" && method === "POST") {
      const body = req.body ?? {};
      const member = memberFor(room, body.actor, body.session);
      if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
        sendJson(res, 403, { success: false, error: "Only an editor can change this room" });
        return true;
      }
      if (!Array.isArray(body.ops) || body.ops.length === 0 || body.ops.length > MAX_OPS_PER_PUSH) {
        sendJson(res, 400, { success: false, error: `Send between 1 and ${MAX_OPS_PER_PUSH} operations` });
        return true;
      }
      room.events = Array.isArray(room.events) ? room.events : [];
      room.proposals = room.proposals && typeof room.proposals === "object" ? room.proposals : {};
      const baseSeq = Math.max(0, Number(body.baseSeq) || 0);
      const existing = new Map(room.events.filter((event) => event.type === "op").map((event) => [event.op.id, event]));
      const accepted = [];
      const rejected = [];
      const proposed = [];
      const stamp = now();
      for (const raw of body.ops) {
        if (!isSafeOp(raw, member.actor)) {
          rejected.push({ id: typeof raw?.id === "string" ? raw.id : null, reason: "invalid-op" });
          continue;
        }
        if (!routeAllowed(room, raw.routeKey)) {
          rejected.push({ id: raw.id, reason: "route-outside-room" });
          continue;
        }
        const duplicate = existing.get(raw.id);
        if (duplicate) {
          accepted.push(duplicate.op);
          continue;
        }
        const target = raw.targets ? room.events.find((event2) => event2.type === "op" && event2.op.id === raw.targets)?.op : null;
        if (target && target.actor !== member.actor && member.role !== "owner") {
          proposed.push(raw);
          rejected.push({ id: raw.id, reason: "owner-approval-required" });
          continue;
        }
        const blocked = room.events.some((event2) => event2.type === "op" && event2.seq > baseSeq && event2.actor !== member.actor && ROLE_RANK[room.members[event2.actor]?.role ?? "viewer"] > ROLE_RANK[member.role] && sameField(event2.op, raw));
        if (blocked) {
          rejected.push({ id: raw.id, reason: "higher-authority-concurrent-write" });
          continue;
        }
        const event = appendOpEvent(room, raw, member.actor, stamp);
        existing.set(event.op.id, event);
        accepted.push(event.op);
      }
      if (proposed.length) {
        const proposal = {
          id: (0, import_node_crypto.randomUUID)(),
          actor: member.actor,
          name: member.name,
          ops: proposed,
          createdAt: stamp,
          status: "pending",
          decidedBy: null,
          decidedAt: null
        };
        room.proposals[proposal.id] = proposal;
        appendEvent(room, { type: "proposal", createdAt: stamp, actor: member.actor, proposal });
      }
      await persist(room);
      sendJson(res, 200, {
        success: true,
        accepted,
        rejected,
        cursor: Number(room.sequence) || 0,
        room: publicRoom(room, stamp, { actor: member.actor, role: member.role, name: member.name })
      });
      return true;
    }
    if (action === "signal" && method === "POST") {
      const body = req.body ?? {};
      const member = memberFor(room, body.actor, body.session);
      if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
        sendJson(res, 403, { success: false, error: "Only an editor can publish to this room" });
        return true;
      }
      if (!routeAllowed(room, body.routeKey) || !VIEWPORTS.includes(body.viewport)) {
        sendJson(res, 400, { success: false, error: "Invalid room design scope" });
        return true;
      }
      const stamp = now();
      appendEvent(room, {
        type: "design",
        createdAt: stamp,
        actor: member.actor,
        routeKey: normalizeRouteKey(body.routeKey),
        viewport: body.viewport
      });
      await persist(room);
      sendJson(res, 200, { success: true, cursor: Number(room.sequence) || 0 });
      return true;
    }
    if (action === "chat") {
      room.chat = Array.isArray(room.chat) ? room.chat : [];
      const member = method === "GET" ? memberFor(room, url.searchParams.get("actor"), url.searchParams.get("session")) : memberFor(room, req.body?.actor, req.body?.session);
      if (method === "GET") {
        if (!member) {
          sendJson(res, 404, { success: false, error: "Join the room first" });
          return true;
        }
        sendJson(res, 200, { success: true, messages: room.chat.slice(-MAX_CHAT_MESSAGES) });
        return true;
      }
      if (method === "POST") {
        if (!member) {
          sendJson(res, 404, { success: false, error: "Join the room first" });
          return true;
        }
        const body = typeof req.body.body === "string" ? req.body.body.trim().slice(0, MAX_CHAT_LENGTH) : "";
        if (!body) {
          sendJson(res, 400, { success: false, error: "Say something" });
          return true;
        }
        const message = { id: (0, import_node_crypto.randomUUID)(), actor: member.actor, name: member.name, body, createdAt: now() };
        room.chat.push(message);
        if (room.chat.length > MAX_CHAT_MESSAGES) room.chat.splice(0, room.chat.length - MAX_CHAT_MESSAGES);
        appendEvent(room, { type: "chat", createdAt: message.createdAt, actor: member.actor, message });
        await persist(room);
        sendJson(res, 200, { success: true, message });
        return true;
      }
    }
    if (action === "proposals") {
      room.proposals = room.proposals && typeof room.proposals === "object" ? room.proposals : {};
      const member = method === "GET" ? memberFor(room, url.searchParams.get("actor"), url.searchParams.get("session")) : memberFor(room, req.body?.actor, req.body?.session);
      if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
        sendJson(res, 403, { success: false, error: "Only editors can see revert proposals" });
        return true;
      }
      if (!commentId && method === "GET") {
        sendJson(res, 200, { success: true, proposals: Object.values(room.proposals).sort((a, b) => b.createdAt - a.createdAt) });
        return true;
      }
      const proposal = commentId ? room.proposals[commentId] : null;
      if (!proposal) {
        sendJson(res, 404, { success: false, error: "No such proposal" });
        return true;
      }
      if (commentAction === "decision" && method === "POST") {
        if (member.role !== "owner") {
          sendJson(res, 403, { success: false, error: "Only the owner can decide that" });
          return true;
        }
        const decision = req.body.decision;
        if (decision !== "approved" && decision !== "declined") {
          sendJson(res, 400, { success: false, error: "Say approved or declined" });
          return true;
        }
        proposal.status = decision;
        proposal.decidedBy = member.name;
        proposal.decidedAt = now();
        const accepted = [];
        if (decision === "approved") {
          for (const requested of proposal.ops) {
            if (!isSafeOp({ ...requested, actor: member.actor }, member.actor)) continue;
            accepted.push(appendOpEvent(room, { ...requested, id: (0, import_node_crypto.randomUUID)(), actor: member.actor }, member.actor, proposal.decidedAt).op);
          }
        }
        appendEvent(room, { type: "proposal", createdAt: proposal.decidedAt, actor: member.actor, proposal });
        await persist(room);
        sendJson(res, 200, { success: true, proposal, accepted, cursor: Number(room.sequence) || 0 });
        return true;
      }
    }
    if (action === "comments") {
      room.comments = room.comments ?? {};
      const member = method === "GET" ? memberFor(room, url.searchParams.get("actor"), url.searchParams.get("session")) : memberFor(room, req.body?.actor, req.body?.session);
      if (!commentId && method === "GET") {
        const routeKey = normalizeRouteKey(url.searchParams.get("routeKey") ?? "/");
        const list = Object.values(room.comments).filter((c) => c.routeKey === routeKey).sort((a, b) => a.createdAt - b.createdAt);
        sendJson(res, 200, { success: true, comments: list });
        return true;
      }
      if (!commentId && method === "POST") {
        if (!member) {
          sendJson(res, 404, { success: false, error: "Join the room first" });
          return true;
        }
        if (ROLE_RANK[member.role] < ROLE_RANK.commenter) {
          sendJson(res, 403, { success: false, error: "This link is read-only" });
          return true;
        }
        const body = req.body ?? {};
        const text = typeof body.body === "string" ? body.body.trim().slice(0, MAX_COMMENT_LENGTH) : "";
        const anchor = body.anchor;
        if (!text) {
          sendJson(res, 400, { success: false, error: "Say what you would like changed" });
          return true;
        }
        if (!anchor || typeof anchor.path !== "string" || !anchor.path) {
          sendJson(res, 400, { success: false, error: "A note has to be attached to something" });
          return true;
        }
        if (!routeAllowed(room, body.routeKey)) {
          sendJson(res, 403, { success: false, error: "That route is outside this room" });
          return true;
        }
        if (Object.keys(room.comments).length >= MAX_COMMENTS) {
          sendJson(res, 409, { success: false, error: "That is a lot of notes \u2014 resolve some first" });
          return true;
        }
        const comment2 = {
          id: (0, import_node_crypto.randomUUID)(),
          actor: member.actor,
          name: member.name,
          routeKey: normalizeRouteKey(body.routeKey ?? "/"),
          viewport: VIEWPORTS.includes(body.viewport) ? body.viewport : "desktop",
          // The fingerprint travels with the note so it can still be found
          // after the page it points at has been rebuilt around it.
          anchor: { nodeId: cleanNodeId(anchor.nodeId) ?? void 0, path: anchor.path, fingerprint: anchor.fingerprint ?? { tag: "" } },
          quoted: typeof body.quoted === "string" ? body.quoted.slice(0, 200) : null,
          body: text,
          createdAt: now(),
          resolved: false,
          replies: []
        };
        room.comments[comment2.id] = comment2;
        appendEvent(room, { type: "comment", createdAt: comment2.createdAt, actor: member.actor, commentId: comment2.id });
        await persist(room);
        log(`${member.name} left a note on ${comment2.routeKey}`);
        sendJson(res, 200, { success: true, comment: comment2 });
        return true;
      }
      const comment = commentId ? room.comments[commentId] : null;
      if (!comment) {
        sendJson(res, 404, { success: false, error: "No such note" });
        return true;
      }
      if (!member) {
        sendJson(res, 404, { success: false, error: "Join the room first" });
        return true;
      }
      if (commentAction === "resolve" && method === "POST") {
        const mayResolve = ROLE_RANK[member.role] >= ROLE_RANK.editor || comment.actor === member.actor;
        if (!mayResolve) {
          sendJson(res, 403, { success: false, error: "Only the designer can resolve that" });
          return true;
        }
        comment.resolved = (req.body ?? {}).resolved !== false;
        comment.resolvedBy = comment.resolved ? member.name : null;
        appendEvent(room, { type: "comment", createdAt: now(), actor: member.actor, commentId: comment.id });
        await persist(room);
        sendJson(res, 200, { success: true, comment });
        return true;
      }
      if (commentAction === "reply" && method === "POST") {
        const text = typeof (req.body ?? {}).body === "string" ? req.body.body.trim().slice(0, MAX_COMMENT_LENGTH) : "";
        if (!text) {
          sendJson(res, 400, { success: false, error: "Say something" });
          return true;
        }
        comment.replies.push({
          id: (0, import_node_crypto.randomUUID)(),
          actor: member.actor,
          name: member.name,
          body: text,
          createdAt: now()
        });
        appendEvent(room, { type: "comment", createdAt: now(), actor: member.actor, commentId: comment.id });
        await persist(room);
        sendJson(res, 200, { success: true, comment });
        return true;
      }
    }
    if (action === "revisions") {
      room.revisions = room.revisions ?? {};
      const member = method === "GET" ? memberFor(room, url.searchParams.get("actor"), url.searchParams.get("session")) : memberFor(room, req.body?.actor, req.body?.session);
      if (!commentId && method === "GET") {
        const routeKey = url.searchParams.get("routeKey");
        const list = Object.values(room.revisions).filter((r) => !routeKey || r.routeKey === normalizeRouteKey(routeKey)).sort((a, b) => b.createdAt - a.createdAt);
        sendJson(res, 200, { success: true, revisions: list });
        return true;
      }
      if (!commentId && method === "POST") {
        if (!member || ROLE_RANK[member.role] < ROLE_RANK.editor) {
          sendJson(res, 403, { success: false, error: "Only the designer can send a revision" });
          return true;
        }
        const body = req.body ?? {};
        if (!routeAllowed(room, body.routeKey)) {
          sendJson(res, 403, { success: false, error: "That route is outside this room" });
          return true;
        }
        const revision2 = {
          id: (0, import_node_crypto.randomUUID)(),
          routeKey: normalizeRouteKey(body.routeKey ?? "/"),
          viewport: VIEWPORTS.includes(body.viewport) ? body.viewport : "desktop",
          // The design as it stood when it was sent, so "approved" means
          // something specific rather than "approved whatever it is now".
          store: body.store && typeof body.store === "object" ? body.store : {},
          note: typeof body.note === "string" ? body.note.trim().slice(0, MAX_COMMENT_LENGTH) : null,
          createdAt: now(),
          createdBy: member.name,
          status: "sent",
          decidedBy: null,
          decidedAt: null,
          decisionNote: null
        };
        room.revisions[revision2.id] = revision2;
        appendEvent(room, { type: "revision", createdAt: revision2.createdAt, actor: member.actor, revisionId: revision2.id });
        await persist(room);
        log(`${member.name} sent ${revision2.routeKey} for review`);
        sendJson(res, 200, { success: true, revision: revision2 });
        return true;
      }
      const revision = commentId ? room.revisions[commentId] : null;
      if (!revision) {
        sendJson(res, 404, { success: false, error: "No such revision" });
        return true;
      }
      if (commentAction === "decision" && method === "POST") {
        if (!member || ROLE_RANK[member.role] < ROLE_RANK.commenter) {
          sendJson(res, 403, { success: false, error: "This link is read-only" });
          return true;
        }
        const decision = (req.body ?? {}).decision;
        if (decision !== "approved" && decision !== "changes-requested") {
          sendJson(res, 400, { success: false, error: "Say approved or changes-requested" });
          return true;
        }
        revision.status = decision;
        revision.decidedBy = member.name;
        revision.decidedAt = now();
        revision.decisionNote = typeof req.body.note === "string" ? req.body.note.trim().slice(0, MAX_COMMENT_LENGTH) : null;
        appendEvent(room, { type: "revision", createdAt: revision.decidedAt, actor: member.actor, revisionId: revision.id });
        await persist(room);
        log(`${member.name} marked ${revision.routeKey} ${decision}`);
        sendJson(res, 200, { success: true, revision });
        return true;
      }
    }
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return true;
  };
}

// lib/project-document-store.mjs
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
var FroamStaleRevisionError = class extends Error {
  constructor(expected, actual) {
    super(`Stale project revision: expected ${expected}, current ${actual}`);
    this.name = "FroamStaleRevisionError";
    this.expected = expected;
    this.actual = actual;
  }
};
var emptyRecord = (id) => ({ version: 2, id, revision: 0, sequence: 0, events: [], checkpoints: {}, branches: {} });
var normalizeRecord = (value, id) => ({ ...emptyRecord(id), ...value ?? {}, version: 2, id, revision: Number.isSafeInteger(value?.revision) ? value.revision : 0 });
function createMemoryProjectDocumentStore() {
  const projects = /* @__PURE__ */ new Map();
  const blobs = /* @__PURE__ */ new Map();
  const queues = /* @__PURE__ */ new Map();
  const serialized = (id, work) => {
    const prior = queues.get(id) ?? Promise.resolve();
    const next = prior.catch(() => void 0).then(work);
    queues.set(id, next);
    const cleanup = () => {
      if (queues.get(id) === next) queues.delete(id);
    };
    void next.then(cleanup, cleanup);
    return next;
  };
  return { kind: "memory", atomic: true, async read(id) {
    return projects.has(id) ? structuredClone(normalizeRecord(projects.get(id), id)) : null;
  }, async compareAndSwap(id, expectedRevision, next) {
    return this.transaction(id, expectedRevision, () => next);
  }, async transaction(id, expectedRevision, update) {
    return serialized(id, async () => {
      const current = structuredClone(normalizeRecord(projects.get(id), id));
      if (expectedRevision !== void 0 && expectedRevision !== current.revision) throw new FroamStaleRevisionError(expectedRevision, current.revision);
      const stored = { ...structuredClone(await update(current)), version: 2, id, revision: current.revision + 1 };
      projects.set(id, stored);
      return structuredClone(stored);
    });
  }, async getBlob(id) {
    return blobs.get(id) ?? null;
  }, async putBlob(id, value) {
    if (!blobs.has(id)) blobs.set(id, structuredClone(value));
    return id;
  } };
}
function createFileProjectDocumentStore(file) {
  const queues = /* @__PURE__ */ new Map();
  const readAll = () => {
    try {
      const parsed = JSON.parse(import_node_fs2.default.readFileSync(file, "utf8"));
      return { version: 2, projects: parsed.projects ?? {}, blobs: parsed.blobs ?? {} };
    } catch {
      return { version: 2, projects: {}, blobs: {} };
    }
  };
  const writeAll = (all) => {
    import_node_fs2.default.mkdirSync(import_node_path2.default.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    import_node_fs2.default.writeFileSync(temporary, JSON.stringify(all) + "\n");
    import_node_fs2.default.renameSync(temporary, file);
  };
  const serialized = (id, work) => {
    const prior = queues.get(id) ?? Promise.resolve();
    const next = prior.catch(() => void 0).then(work);
    queues.set(id, next);
    const cleanup = () => {
      if (queues.get(id) === next) queues.delete(id);
    };
    void next.then(cleanup, cleanup);
    return next;
  };
  return { kind: "file", atomic: true, async read(id) {
    const value = readAll().projects[id];
    return value ? structuredClone(normalizeRecord(value, id)) : null;
  }, async compareAndSwap(id, expectedRevision, next) {
    return this.transaction(id, expectedRevision, () => next);
  }, async transaction(id, expectedRevision, update) {
    return serialized(id, async () => {
      const all = readAll();
      const current = structuredClone(normalizeRecord(all.projects[id], id));
      if (expectedRevision !== void 0 && expectedRevision !== current.revision) throw new FroamStaleRevisionError(expectedRevision, current.revision);
      const stored = { ...structuredClone(await update(current)), version: 2, id, revision: current.revision + 1 };
      all.projects[id] = stored;
      writeAll(all);
      return structuredClone(stored);
    });
  }, async getBlob(id) {
    return readAll().blobs[id] ?? null;
  }, async putBlob(id, value) {
    return serialized(`blob:${id}`, () => {
      const all = readAll();
      all.blobs[id] ??= value;
      writeAll(all);
      return id;
    });
  } };
}
function adaptLegacyProjectStorage(storage) {
  if (storage?.transaction && storage?.read) return storage;
  if (!storage?.get || !storage?.put) throw new Error("[froam] invalid project document store");
  return { kind: "legacy", atomic: false, async read(id) {
    const value = await storage.get(id);
    return value ? normalizeRecord(value, id) : null;
  }, async transaction(id, expectedRevision, update) {
    const current = normalizeRecord(await storage.get(id), id);
    if (expectedRevision !== void 0 && expectedRevision !== current.revision) throw new FroamStaleRevisionError(expectedRevision, current.revision);
    const next = { ...await update(current), version: 2, id, revision: current.revision + 1 };
    await storage.put(next);
    return next;
  }, async getBlob(id) {
    return storage.getBlob ? storage.getBlob(id) : null;
  }, async putBlob(id, value) {
    if (!storage.putBlob) throw new Error("Blob storage unsupported");
    return storage.putBlob(id, value);
  } };
}

// lib/project-sync-store.mjs
var MAX_BODY_BYTES2 = 2e6;
var MAX_EVENTS_PER_PUSH = 1e3;
function sendJson2(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES2) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
function empty(id) {
  return { version: 2, id, revision: 0, sequence: 0, events: [], checkpoints: {}, branches: {} };
}
function safeId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9._:-]+$/.test(value);
}
function validEvent(event, projectId, branchId) {
  return event && event.schemaVersion === 2 && event.projectId === projectId && event.branchId === branchId && safeId(event.id) && Number.isSafeInteger(event.clock) && event.clock >= 0 && Array.isArray(event.targetIds) && event.targetIds.length <= 500;
}
function mergeHostedProjectState(current, push) {
  const project = current ? structuredClone(current) : empty(push.projectId);
  if (project.id !== push.projectId) throw new Error("Project mismatch");
  if (typeof push.branchId !== "string" || !push.branchId) throw new Error("A branch is required");
  const incoming = Array.isArray(push.events) ? push.events : [];
  if (incoming.length > MAX_EVENTS_PER_PUSH) throw new Error("Too many project events");
  const known = new Set(project.events.map((item) => item.event.id));
  for (const item of incoming) {
    if (!validEvent(item.event, push.projectId, push.branchId)) throw new Error("Invalid or cross-branch project event");
    if (item.event.type === "design.op.appended" && !Number.isFinite(item.roomSequence)) throw new Error("Design operations require their canonical room sequence");
    if (known.has(item.event.id)) continue;
    project.sequence += 1;
    project.events.push({ seq: project.sequence, roomSequence: Number.isFinite(item.roomSequence) ? item.roomSequence : void 0, event: item.event });
    known.add(item.event.id);
  }
  const incomingIds = new Set(incoming.map((item) => item?.event?.id).filter(Boolean));
  const knownIds = /* @__PURE__ */ new Set([...known, ...incomingIds]);
  for (const checkpoint of Array.isArray(push.checkpoints) ? push.checkpoints : []) {
    if (!safeId(checkpoint.id) || checkpoint.branchId !== push.branchId || checkpoint.projectId !== push.projectId || project.checkpoints[checkpoint.id] && project.checkpoints[checkpoint.id].branchId !== push.branchId) throw new Error("Cross-branch or invalid checkpoint refused");
    if (!Array.isArray(checkpoint.eventIds) || checkpoint.eventIds.some((id) => !knownIds.has(id))) throw new Error("Checkpoint references unknown events");
    if (checkpoint.parentCheckpointId && !project.checkpoints[checkpoint.parentCheckpointId] && !(push.checkpoints ?? []).some((item) => item.id === checkpoint.parentCheckpointId)) throw new Error("Checkpoint parent is missing");
    project.checkpoints[checkpoint.id] = checkpoint;
  }
  const branches = Array.isArray(push.branches) ? push.branches : [];
  const active = branches.find((branch) => branch.id === push.branchId);
  const allowedBranches = new Set([push.branchId, active?.parentBranchId].filter(Boolean));
  for (const branch of branches) {
    if (!safeId(branch.id) || !allowedBranches.has(branch.id)) throw new Error("Unrelated branch metadata refused");
    const previous = project.branches[branch.id];
    if (branch.id === push.branchId && push.expectedBranchHeadId !== void 0 && (previous?.headEventId ?? null) !== push.expectedBranchHeadId) throw new FroamStaleRevisionError(push.expectedBranchHeadId, previous?.headEventId ?? null);
    if (!project.checkpoints[branch.baseCheckpointId]) throw new Error("Branch base checkpoint is missing");
    project.branches[branch.id] = branch;
  }
  project.events.sort((a, b) => {
    if (Number.isFinite(a.roomSequence) && Number.isFinite(b.roomSequence) && a.roomSequence !== b.roomSequence) return a.roomSequence - b.roomSequence;
    return a.seq - b.seq;
  });
  return project;
}
function createFroamProjectSyncApi({ file, storage, authorize = null } = {}) {
  const persistence = storage ? adaptLegacyProjectStorage(storage) : file ? createFileProjectDocumentStore(file) : null;
  if (!persistence) throw new Error("[froam] project sync needs a file or storage");
  return async function projectSyncApi(req, res) {
    const url = new URL(req.url ?? "/", "http://froam.local");
    const match = url.pathname.match(/^\/api\/froam\/projects\/([^/]+)\/sync$/);
    if (!match) return false;
    const projectId = decodeURIComponent(match[1]);
    const body = req.method === "POST" ? await readBody(req) : {};
    const actor = body.actor ?? url.searchParams.get("actor");
    if (authorize && !await authorize(req, { projectId, actor })) {
      sendJson2(res, 403, { success: false, error: "Not authorized to synchronize this project" });
      return true;
    }
    const current = await persistence.read(projectId) ?? empty(projectId);
    if (req.method === "GET") {
      const requestedCursor = Math.max(0, Number(url.searchParams.get("cursor")) || 0);
      const cursorReset = requestedCursor > current.sequence;
      const cursor = cursorReset ? 0 : requestedCursor;
      const branchId = url.searchParams.get("branchId") || "main";
      sendJson2(res, 200, { success: true, projectId, branchId, revision: current.revision, cursor: current.sequence, cursorReset, events: current.events.filter((item) => item.seq > cursor && item.event.branchId === branchId), checkpoints: Object.values(current.checkpoints).filter((item) => item.branchId === branchId), branches: Object.values(current.branches).filter((item) => item.id === branchId || item.parentBranchId === branchId || item.id === current.branches[branchId]?.parentBranchId) });
      return true;
    }
    if (req.method === "POST") {
      try {
        const next = await persistence.transaction(projectId, Number.isSafeInteger(body.expectedRevision) ? body.expectedRevision : void 0, (latest) => mergeHostedProjectState(latest, { ...body, projectId }));
        const cursor = Math.max(0, Number(body.cursor) || 0);
        sendJson2(res, 200, { success: true, projectId, branchId: body.branchId, revision: next.revision, cursor: next.sequence, events: next.events.filter((item) => item.seq > cursor && item.event.branchId === body.branchId), checkpoints: Object.values(next.checkpoints).filter((item) => item.branchId === body.branchId), branches: Object.values(next.branches).filter((item) => item.id === body.branchId || item.id === next.branches[body.branchId]?.parentBranchId) });
      } catch (error) {
        sendJson2(res, error instanceof FroamStaleRevisionError ? 409 : 400, { success: false, stale: error instanceof FroamStaleRevisionError, error: error instanceof Error ? error.message : "Invalid sync payload" });
      }
      return true;
    }
    sendJson2(res, 405, { success: false, error: "Method not allowed" });
    return true;
  };
}

// dist/project/intelligence-transport.js
var FROAM_INTELLIGENCE_SCHEMA_VERSION = 1;
var FROAM_INTELLIGENCE_MAX_REQUEST_BYTES = 512e3;
var FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES = 256e3;
var FROAM_INTELLIGENCE_MAX_PROPOSALS = 20;
var PURPOSES = /* @__PURE__ */ new Set(["mutate", "understand", "reference", "responsive", "evaluate"]);
var MAX_DEPTH = 12;
var MAX_ITEMS = 2e3;
var MAX_INTENT_CHARS = 4e3;
var MAX_RATIONALE_CHARS = 1e3;
var MAX_FINDINGS = 50;
var MAX_SCOPE_NODES = 100;
var MAX_STRING_CHARS = 2e4;
var PROTO_POISON = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var CREDENTIAL_KEYS = /* @__PURE__ */ new Set(["apikey", "api_key", "authorization", "password", "secret", "token"]);
var ALLOWED_DOMAINS = /* @__PURE__ */ new Set([
  "visual",
  "typography",
  "spacing",
  "layout",
  "navigation",
  "interactions",
  "motion",
  "responsive",
  "composition"
]);
var ALLOWED_EVENT_TYPES = /* @__PURE__ */ new Set([
  "node.upserted",
  "relation.upserted",
  "interaction.upserted",
  "dna.captured",
  "responsive.upserted"
]);
var NODE_KINDS = /* @__PURE__ */ new Set(["project", "page", "screen", "frame", "element", "component-definition", "component-instance", "asset", "state"]);
var NODE_SOURCES = /* @__PURE__ */ new Set(["host-dom", "froam", "imported"]);
var RELATION_KINDS = /* @__PURE__ */ new Set(["contains", "instance-of", "navigates-to", "transitions-to", "uses-asset", "derived-from", "variant-of", "belongs-to", "connected-to", "mutated-from", "uses-interaction", "sampled-from", "governed-by", "tested-by", "performed-by", "uses-sound", "custom"]);
var INTERACTION_TRIGGERS = /* @__PURE__ */ new Set(["load", "hover", "press", "click", "focus", "scroll", "drag", "custom"]);
var REQUEST_KEYS = /* @__PURE__ */ new Set(["schemaVersion", "purpose", "intent", "context", "scopeNodeIds", "constraints", "protectedNodeIds", "previousAttemptFeedback", "priorAttemptFeedback", "requestId", "consent"]);
var CONTEXT_KEYS = /* @__PURE__ */ new Set(["projectId", "activeBranchId", "routeKey", "viewport", "selectedNodeId", "selectedPath", "selectedDomPath", "scanRecords", "dna", "relationships", "responsivePolicies", "responsiveObservations", "references", "referenceEvidence", "memory"]);
var REFERENCE_KEYS = /* @__PURE__ */ new Set(["id", "mediaReferenceId", "viewportWidth", "viewportHeight", "route", "state", "label", "reconstructedRegions", "ocrText", "observedHierarchy", "dna", "knownLimitations"]);
function utf8Bytes(value) {
  return typeof TextEncoder === "function" ? new TextEncoder().encode(value).byteLength : value.length;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function boundedString(value, max = 256) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}
function boundedJson(value, options = {}) {
  let items = 0;
  const visit = (current, depth) => {
    if (depth > MAX_DEPTH || ++items > MAX_ITEMS)
      return false;
    if (current === null || typeof current === "boolean")
      return true;
    if (typeof current === "string")
      return current.length <= MAX_STRING_CHARS;
    if (typeof current === "number")
      return Number.isFinite(current);
    if (typeof current !== "object")
      return false;
    if (ArrayBuffer.isView(current) || current instanceof ArrayBuffer)
      return false;
    if (Array.isArray(current))
      return current.length <= MAX_ITEMS && current.every((item) => visit(item, depth + 1));
    for (const [key, child] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase().replace(/[-\s]/g, "");
      if (PROTO_POISON.has(key))
        return false;
      if (options.rejectCredentials && CREDENTIAL_KEYS.has(normalizedKey))
        return false;
      if (!visit(child, depth + 1))
        return false;
    }
    return true;
  };
  return visit(value, 0);
}
function validIds(value, maximum = MAX_SCOPE_NODES) {
  return Array.isArray(value) && value.length <= maximum && value.every((id) => boundedString(id)) && new Set(value).size === value.length;
}
function validContext(value) {
  if (!isRecord(value) || !boundedJson(value, { rejectCredentials: true }))
    return false;
  if (Object.keys(value).some((key) => !CONTEXT_KEYS.has(key)))
    return false;
  if (!boundedString(value.projectId) || !boundedString(value.activeBranchId))
    return false;
  if (typeof value.routeKey !== "string" || value.routeKey.length > 2e3)
    return false;
  if (!["desktop", "tablet", "mobile"].includes(String(value.viewport)))
    return false;
  if (value.selectedNodeId != null && !boundedString(value.selectedNodeId))
    return false;
  if (value.selectedPath != null && (typeof value.selectedPath !== "string" || value.selectedPath.length > 4e3))
    return false;
  if (value.selectedDomPath != null && (typeof value.selectedDomPath !== "string" || value.selectedDomPath.length > 4e3))
    return false;
  if (value.scanRecords != null && (!Array.isArray(value.scanRecords) || value.scanRecords.length > 100))
    return false;
  if (value.relationships != null && (!Array.isArray(value.relationships) || value.relationships.length > 200))
    return false;
  if (value.responsivePolicies != null && (!Array.isArray(value.responsivePolicies) || value.responsivePolicies.length > 100))
    return false;
  if (value.responsiveObservations != null && (!Array.isArray(value.responsiveObservations) || value.responsiveObservations.length > 200))
    return false;
  if (value.references != null) {
    if (!Array.isArray(value.references) || value.references.length > 20)
      return false;
    for (const reference of value.references) {
      if (!isRecord(reference) || Object.keys(reference).some((key) => !REFERENCE_KEYS.has(key)) || !boundedString(reference.id))
        return false;
      if (reference.mediaReferenceId != null && !boundedString(reference.mediaReferenceId, 1e3))
        return false;
      for (const dimension of ["viewportWidth", "viewportHeight"])
        if (reference[dimension] != null && (typeof reference[dimension] !== "number" || !Number.isFinite(reference[dimension]) || reference[dimension] <= 0 || reference[dimension] > 1e5))
          return false;
      if (reference.reconstructedRegions != null && (!Array.isArray(reference.reconstructedRegions) || reference.reconstructedRegions.length > 500))
        return false;
      if (reference.ocrText != null && (!Array.isArray(reference.ocrText) || reference.ocrText.length > 500))
        return false;
      if (reference.observedHierarchy != null && (!Array.isArray(reference.observedHierarchy) || reference.observedHierarchy.length > 500))
        return false;
    }
  }
  return true;
}
function validateIntelligenceRequest(value) {
  if (!isRecord(value) || !boundedJson(value, { rejectCredentials: true })) {
    return { valid: false, code: "invalid_request", reason: "Request must be bounded credential-free JSON" };
  }
  if (Object.keys(value).some((key) => !REQUEST_KEYS.has(key)))
    return { valid: false, code: "invalid_request", reason: "Request contains unsupported fields" };
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { valid: false, code: "invalid_request", reason: "Request must be serializable JSON" };
  }
  if (utf8Bytes(serialized) > FROAM_INTELLIGENCE_MAX_REQUEST_BYTES) {
    return { valid: false, code: "invalid_request", reason: "Request exceeds the size limit" };
  }
  if (value.schemaVersion !== FROAM_INTELLIGENCE_SCHEMA_VERSION)
    return { valid: false, code: "invalid_request", reason: "Unsupported schema version" };
  if (typeof value.purpose !== "string" || !PURPOSES.has(value.purpose))
    return { valid: false, code: "unsupported_purpose", reason: "Unsupported intelligence purpose" };
  if (typeof value.intent !== "string" || !value.intent.trim() || value.intent.length > MAX_INTENT_CHARS)
    return { valid: false, code: "invalid_request", reason: "Intent is required and must be bounded" };
  if (!validContext(value.context))
    return { valid: false, code: "invalid_request", reason: "Invalid intelligence context" };
  if (value.requestId != null && !boundedString(value.requestId))
    return { valid: false, code: "invalid_request", reason: "Invalid request id" };
  if (value.scopeNodeIds != null && !validIds(value.scopeNodeIds))
    return { valid: false, code: "invalid_request", reason: "Invalid node scope" };
  if (value.purpose === "mutate") {
    if (!validIds(value.scopeNodeIds) || value.scopeNodeIds.length === 0)
      return { valid: false, code: "invalid_request", reason: "Mutation requires a non-empty node scope" };
    if (!isRecord(value.constraints))
      return { valid: false, code: "invalid_request", reason: "Mutation constraints are required" };
    if (!Array.isArray(value.constraints.allow) || value.constraints.allow.some((domain) => typeof domain !== "string" || !ALLOWED_DOMAINS.has(domain)))
      return { valid: false, code: "invalid_request", reason: "Invalid allowed mutation domains" };
    if (!Array.isArray(value.constraints.protect) || value.constraints.protect.some((item) => typeof item !== "string" || item.length > 100))
      return { valid: false, code: "invalid_request", reason: "Invalid mutation protections" };
    if (value.protectedNodeIds != null && !validIds(value.protectedNodeIds))
      return { valid: false, code: "invalid_request", reason: "Invalid protected node ids" };
    if (value.constraints.protectedNodeIds != null && !validIds(value.constraints.protectedNodeIds))
      return { valid: false, code: "invalid_request", reason: "Invalid constrained node ids" };
  } else if ("constraints" in value || "protectedNodeIds" in value) {
    return { valid: false, code: "invalid_request", reason: "Analysis requests cannot carry mutation constraints" };
  }
  return { valid: true, request: value };
}
function payloadReferences(type, payload) {
  if (type === "node.upserted")
    return isRecord(payload.node) && boundedString(payload.node.id) ? [payload.node.id] : null;
  if (type === "relation.upserted") {
    if (!isRecord(payload.relation) || !boundedString(payload.relation.id) || !boundedString(payload.relation.from) || !boundedString(payload.relation.to) || typeof payload.relation.kind !== "string" || !RELATION_KINDS.has(payload.relation.kind))
      return null;
    return [payload.relation.from, payload.relation.to];
  }
  if (type === "interaction.upserted") {
    const interaction = payload.interaction;
    if (!isRecord(interaction) || !boundedString(interaction.id) || !boundedString(interaction.name, 500) || !boundedString(interaction.sourceId) || !validIds(interaction.targetIds, 100) || typeof interaction.trigger !== "string" || !INTERACTION_TRIGGERS.has(interaction.trigger) || !Array.isArray(interaction.timeline) || interaction.timeline.length > 100)
      return null;
    if (!interaction.timeline.every((frame) => isRecord(frame) && typeof frame.at === "number" && Number.isFinite(frame.at) && isRecord(frame.values)))
      return null;
    return [interaction.sourceId, ...interaction.targetIds];
  }
  if (type === "dna.captured") {
    const dna = payload.dna;
    if (!isRecord(dna) || dna.schemaVersion !== 1 || !boundedString(dna.nodeId) || typeof dna.capturedAt !== "number" || !Number.isFinite(dna.capturedAt))
      return null;
    return [dna.nodeId];
  }
  if (type === "responsive.upserted") {
    const responsive = payload.responsive;
    if (!isRecord(responsive) || responsive.schemaVersion !== 1 || !boundedString(responsive.nodeId) || !["critical", "high", "medium", "low", "decorative"].includes(String(responsive.priority)))
      return null;
    for (const key of ["canHide", "canCollapse", "canWrap", "canTruncate", "canCrop", "canReposition"])
      if (typeof responsive[key] !== "boolean")
        return null;
    if (typeof responsive.updatedAt !== "number" || !Number.isFinite(responsive.updatedAt) || !boundedString(responsive.updatedBy))
      return null;
    return [responsive.nodeId];
  }
  return null;
}
function validPayload(type, payload, scope, protectedIds, targets) {
  if (!isRecord(payload) || !boundedJson(payload))
    return false;
  const expectedKey = { "node.upserted": "node", "relation.upserted": "relation", "interaction.upserted": "interaction", "dna.captured": "dna", "responsive.upserted": "responsive" };
  if (Object.keys(payload).length !== 1 || !(expectedKey[type] in payload))
    return false;
  const references = payloadReferences(type, payload);
  if (!references || references.some((id) => !scope.has(id) || protectedIds.has(id)))
    return false;
  if (type === "node.upserted") {
    const node = payload.node;
    if (typeof node.kind !== "string" || !NODE_KINDS.has(node.kind) || typeof node.source !== "string" || !NODE_SOURCES.has(node.source))
      return false;
  }
  return references.some((id) => targets.includes(id));
}
function validateIntelligencePlan(raw, request) {
  if (request.purpose !== "mutate")
    return { valid: false, reason: "Only mutate requests can contain proposals" };
  if (!isRecord(raw) || !boundedJson(raw))
    return { valid: false, reason: "Plan must be bounded JSON" };
  if (raw.purpose != null && raw.purpose !== "mutate")
    return { valid: false, reason: "Response purpose does not match request" };
  if (!Array.isArray(raw.proposals))
    return { valid: false, reason: "proposals must be an array" };
  if (raw.proposals.length > FROAM_INTELLIGENCE_MAX_PROPOSALS)
    return { valid: false, reason: `Too many proposals (max ${FROAM_INTELLIGENCE_MAX_PROPOSALS})` };
  const scope = new Set(request.scopeNodeIds);
  const protectedIds = /* @__PURE__ */ new Set([...request.protectedNodeIds ?? [], ...request.constraints.protectedNodeIds ?? []]);
  const accepted = [];
  for (const candidate of raw.proposals) {
    if (!isRecord(candidate) || !boundedJson(candidate))
      continue;
    if (typeof candidate.type !== "string" || !ALLOWED_EVENT_TYPES.has(candidate.type))
      continue;
    if (typeof candidate.domain !== "string" || !ALLOWED_DOMAINS.has(candidate.domain) || !request.constraints.allow.includes(candidate.domain))
      continue;
    if (!validIds(candidate.targetIds, 100) || candidate.targetIds.length === 0 || candidate.targetIds.some((id) => !scope.has(id) || protectedIds.has(id)))
      continue;
    if (typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence))
      continue;
    if (typeof candidate.rationale !== "string" || !candidate.rationale.trim())
      continue;
    if (!validPayload(candidate.type, candidate.payload, scope, protectedIds, candidate.targetIds))
      continue;
    accepted.push({
      type: candidate.type,
      domain: candidate.domain,
      targetIds: [...candidate.targetIds],
      confidence: Math.max(0, Math.min(1, candidate.confidence)),
      rationale: candidate.rationale.trim().slice(0, MAX_RATIONALE_CHARS),
      payload: structuredClone(candidate.payload),
      dependencies: validIds(candidate.dependencies, 50) ? [...candidate.dependencies] : void 0
    });
  }
  return accepted.length ? { valid: true, proposals: accepted } : { valid: false, reason: "No valid proposals survived validation" };
}
function sanitizeStrings(value, maxItems = 20) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && Boolean(item.trim())).slice(0, maxItems).map((item) => item.trim().slice(0, MAX_RATIONALE_CHARS)) : void 0;
}
function sanitizeFinding(value, scope) {
  if (!isRecord(value) || !boundedJson(value) || typeof value.summary !== "string" || !value.summary.trim() || !["observed", "inferred", "generated"].includes(String(value.origin)))
    return null;
  if (value.confidence != null && (typeof value.confidence !== "number" || !Number.isFinite(value.confidence)))
    return null;
  const nodeIds = validIds(value.nodeIds, 100) ? value.nodeIds.filter((id) => scope.has(id)) : void 0;
  const evidence = Array.isArray(value.evidence) ? value.evidence.slice(0, 20).flatMap((item) => {
    if (!isRecord(item) || typeof item.summary !== "string" || !item.summary.trim() || !["observed", "inferred", "generated"].includes(String(item.origin)))
      return [];
    if (item.confidence != null && (typeof item.confidence !== "number" || !Number.isFinite(item.confidence)))
      return [];
    return [{ origin: item.origin, summary: item.summary.trim().slice(0, MAX_RATIONALE_CHARS), source: typeof item.source === "string" ? item.source.slice(0, 500) : void 0, confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : void 0 }];
  }) : void 0;
  return {
    id: typeof value.id === "string" ? value.id.slice(0, 256) : void 0,
    summary: value.summary.trim().slice(0, MAX_RATIONALE_CHARS),
    detail: typeof value.detail === "string" ? value.detail.slice(0, 4e3) : void 0,
    origin: value.origin,
    confidence: typeof value.confidence === "number" ? Math.max(0, Math.min(1, value.confidence)) : void 0,
    evidence,
    nodeIds
  };
}
function validateIntelligenceResponse(raw, request, provider = "unknown") {
  if (!isRecord(raw) || !boundedJson(raw))
    return { valid: false, code: "provider_invalid_response", reason: "Response must be bounded JSON" };
  if (raw.purpose != null && raw.purpose !== request.purpose)
    return { valid: false, code: "provider_invalid_response", reason: "Response purpose does not match request" };
  if (request.purpose === "mutate") {
    const plan = validateIntelligencePlan(raw, request);
    if (!plan.valid)
      return { valid: false, code: plan.reason.startsWith("No valid") ? "no_valid_proposals" : "provider_invalid_response", reason: plan.reason };
    return { valid: true, response: { schemaVersion: 1, purpose: "mutate", requestId: request.requestId, provider, proposals: plan.proposals, rationale: typeof raw.rationale === "string" ? raw.rationale.slice(0, MAX_RATIONALE_CHARS) : "", confidence: typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0, warnings: sanitizeStrings(raw.warnings, 10) } };
  }
  if ("proposals" in raw)
    return { valid: false, code: "provider_invalid_response", reason: "Analysis responses cannot contain mutation proposals" };
  if (!Array.isArray(raw.findings) || raw.findings.length > MAX_FINDINGS)
    return { valid: false, code: "provider_invalid_response", reason: "findings must be a bounded array" };
  const scope = new Set(request.scopeNodeIds ?? []);
  const findings = raw.findings.map((item) => sanitizeFinding(item, scope)).filter((item) => item !== null);
  if (raw.findings.length > 0 && findings.length === 0)
    return { valid: false, code: "provider_invalid_response", reason: "No valid findings survived validation" };
  const common = { schemaVersion: 1, requestId: request.requestId, provider, findings, recommendations: sanitizeStrings(raw.recommendations), limitations: sanitizeStrings(raw.limitations) };
  if (request.purpose === "reference")
    return { valid: true, response: { ...common, purpose: "reference", referenceIds: validIds(raw.referenceIds, 20) ? raw.referenceIds : void 0 } };
  if (request.purpose === "responsive") {
    const breakpointHypotheses = Array.isArray(raw.breakpointHypotheses) ? raw.breakpointHypotheses.slice(0, 20).flatMap((item) => isRecord(item) && typeof item.summary === "string" && item.summary.trim() && item.origin === "inferred" && (item.confidence == null || typeof item.confidence === "number" && Number.isFinite(item.confidence)) ? [{ summary: item.summary.slice(0, MAX_RATIONALE_CHARS), origin: "inferred", confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : void 0 }] : []) : void 0;
    return { valid: true, response: { ...common, purpose: "responsive", breakpointHypotheses } };
  }
  if (request.purpose === "evaluate")
    return { valid: true, response: { ...common, purpose: "evaluate", score: typeof raw.score === "number" && Number.isFinite(raw.score) ? Math.max(0, Math.min(1, raw.score)) : void 0 } };
  return { valid: true, response: { ...common, purpose: "understand" } };
}
var REMOTE_INTELLIGENCE_PRIVACY = {
  execution: "remote",
  requiresConsent: true,
  sendsSourceCode: false,
  sendsCredentials: false,
  dataDescription: "Bounded Froam-native interface evidence and project memory. No source code, credentials, or raw screenshot pixels."
};

// lib/intelligence-store.mjs
var MAX_PROVIDER_ENVELOPE_BYTES = FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES * 2;
var ERROR_MESSAGES = {
  not_configured: "Froam intelligence is not configured.",
  consent_required: "Remote intelligence requires explicit consent.",
  invalid_request: "The intelligence request is invalid.",
  provider_unavailable: "The intelligence provider is unavailable.",
  provider_invalid_response: "The intelligence provider returned an invalid response.",
  no_valid_proposals: "The provider returned no safe mutation proposals.",
  unsupported_purpose: "The requested intelligence purpose is not supported."
};
function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}
function sendJson3(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
function sendError(res, status, code, extra = {}) {
  sendJson3(res, status, {
    success: false,
    error: { code, message: ERROR_MESSAGES[code] },
    ...extra
  });
}
var RequestBodyError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};
async function readJsonBody2(req) {
  if (req.body !== void 0) {
    let serialized;
    try {
      serialized = JSON.stringify(req.body);
    } catch {
      throw new RequestBodyError("invalid_json");
    }
    if (byteLength(serialized) > FROAM_INTELLIGENCE_MAX_REQUEST_BYTES) throw new RequestBodyError("too_large");
    try {
      return JSON.parse(serialized);
    } catch {
      throw new RequestBodyError("invalid_json");
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let rejected = false;
    req.on("data", (chunk) => {
      if (rejected) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.byteLength;
      if (bytes > FROAM_INTELLIGENCE_MAX_REQUEST_BYTES) {
        rejected = true;
        reject(new RequestBodyError("too_large"));
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (rejected) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new RequestBodyError("invalid_json"));
      }
    });
    req.on("error", () => {
      if (!rejected) reject(new RequestBodyError("read_failed"));
    });
  });
}
function normalizeProviderOutput(value) {
  let serialized;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return { valid: false, reason: "unserializable" };
  }
  if (typeof serialized !== "string" || byteLength(serialized) > FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES) {
    return { valid: false, reason: "too_large" };
  }
  const candidates = [serialized];
  const fenced = serialized.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  if (fenced) candidates.push(fenced);
  const start = serialized.indexOf("{");
  const end = serialized.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(serialized.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      return { valid: true, value: JSON.parse(candidate) };
    } catch {
    }
  }
  return { valid: false, reason: "invalid_json" };
}
function acceptsJson(req) {
  const value = req.headers?.["content-type"];
  return typeof value === "string" && /^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(value);
}
function createFroamIntelligenceApi({ provider = null, authorize = null, log = () => {
} } = {}) {
  return async function handleIntelligenceRequest(req, res) {
    const url = new URL(req.url ?? "/", "http://froam.local");
    if (!url.pathname.endsWith("/plan")) return false;
    if (req.method !== "POST") {
      sendError(res, 405, "invalid_request");
      return true;
    }
    if (req.body === void 0 && !acceptsJson(req)) {
      sendError(res, 415, "invalid_request");
      return true;
    }
    if (authorize) {
      let authorized = false;
      try {
        authorized = await authorize(req);
      } catch {
        authorized = false;
      }
      if (!authorized) {
        sendError(res, 403, "invalid_request");
        return true;
      }
    }
    let body;
    try {
      body = await readJsonBody2(req);
    } catch {
      sendError(res, 400, "invalid_request");
      return true;
    }
    const requestValidation = validateIntelligenceRequest(body);
    if (!requestValidation.valid) {
      const code = requestValidation.code === "unsupported_purpose" ? "unsupported_purpose" : "invalid_request";
      log(`intelligence request rejected: ${code}`);
      sendError(res, 400, code);
      return true;
    }
    const request = requestValidation.request;
    if (!provider) {
      sendError(res, 200, "not_configured", { configured: false, reason: ERROR_MESSAGES.not_configured });
      return true;
    }
    if (provider.privacy?.requiresConsent === true && request.consent !== true) {
      sendError(res, 403, "consent_required");
      return true;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableEnded) controller.abort();
    };
    req.once?.("aborted", abort);
    res.once?.("close", close);
    let providerOutput;
    try {
      providerOutput = await provider.plan(request, { signal: controller.signal });
    } catch {
      if (controller.signal.aborted && (req.aborted || res.destroyed)) return true;
      log(`intelligence provider unavailable: ${String(provider.id ?? "unknown").slice(0, 100)}`);
      sendError(res, 502, "provider_unavailable");
      return true;
    } finally {
      req.removeListener?.("aborted", abort);
      res.removeListener?.("close", close);
    }
    const normalized = normalizeProviderOutput(providerOutput);
    if (!normalized.valid) {
      log(`intelligence provider response rejected: ${normalized.reason}`);
      sendError(res, 502, "provider_invalid_response");
      return true;
    }
    const responseValidation = validateIntelligenceResponse(normalized.value, request, String(provider.id ?? "unknown").slice(0, 200));
    if (!responseValidation.valid) {
      const status = responseValidation.code === "no_valid_proposals" ? 422 : 502;
      log(`intelligence provider response rejected: ${responseValidation.code}`);
      sendError(res, status, responseValidation.code);
      return true;
    }
    log(`intelligence ${request.purpose}: ${request.context.projectId}`);
    sendJson3(res, 200, responseValidation.response);
    return true;
  };
}
var CompatibleProviderError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "CompatibleProviderError";
    this.code = code;
  }
};
var DEFAULT_SYSTEM_PROMPT = `You are Froam's native interface intelligence provider.
Return one strict JSON object and no markdown. Speak only in Froam-native interface knowledge.
Never return JavaScript, JSX, TSX, shell commands, git commands, filesystem writes, source code, or credentials.
For purpose "mutate", return {"purpose":"mutate","proposals":[FroamMutationProposal],"rationale":"...","confidence":0..1}. Allowed event types are node.upserted, relation.upserted, interaction.upserted, dna.captured, and responsive.upserted. Use only allowed domains and node ids supplied by the request. For safe executable edits, prefer dna.captured and copy the supplied selected-node DNA before changing only requested fields. Use dna.visual for color, backgroundColor, border, borderColor, borderRadius, boxShadow and opacity; dna.visual for typography fields such as fontSize, fontWeight, lineHeight, letterSpacing and textAlign; dna.layout for display, positioning, flex/grid alignment, spacing, overflow, width and height; dna.motion for transition, animation and transform; and dna.semantics.textContent for a requested plain-text copy replacement. Never add URLs, HTML, source code, scripts, unrelated nodes, or changes the user did not request.
For purposes "understand", "reference", "responsive", or "evaluate", return {"purpose":"<same purpose>","findings":[{"summary":"...","origin":"observed|inferred|generated","confidence":0..1,"evidence":[]}],"recommendations":[],"limitations":[]} and never return proposals.
Keep observed facts distinct from inference. Responsive breakpoint hypotheses must use origin "inferred" unless directly measured.`;
function createOpenAICompatibleProvider({
  baseUrl,
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  timeout = 3e4
}) {
  if (typeof baseUrl !== "string" || !/^https?:\/\//i.test(baseUrl)) throw new TypeError("A valid compatible-provider baseUrl is required");
  if (typeof apiKey !== "string" || !apiKey) throw new TypeError("A compatible-provider apiKey is required");
  if (typeof model !== "string" || !model) throw new TypeError("A compatible-provider model is required");
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
  const timeoutMs = Number.isFinite(timeout) ? Math.max(1, Math.min(12e4, timeout)) : 3e4;
  return {
    id: "froam-openai-compatible-v1",
    privacy: REMOTE_INTELLIGENCE_PRIVACY,
    async plan(request, { signal } = {}) {
      const { consent: _consent, ...boundedRequest } = request;
      const controller = new AbortController();
      let timedOut = false;
      const abortFromCaller = () => controller.abort();
      if (signal?.aborted) abortFromCaller();
      else signal?.addEventListener("abort", abortFromCaller, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      let response;
      try {
        response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: JSON.stringify(boundedRequest) }
            ],
            temperature: 0.2
          }),
          signal: controller.signal
        });
      } catch {
        throw new CompatibleProviderError(timedOut ? "timeout" : signal?.aborted ? "aborted" : "network");
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abortFromCaller);
      }
      if (!response?.ok) throw new CompatibleProviderError("http_status");
      let envelopeText;
      try {
        envelopeText = await response.text();
      } catch {
        throw new CompatibleProviderError("invalid_envelope");
      }
      if (byteLength(envelopeText) > MAX_PROVIDER_ENVELOPE_BYTES) throw new CompatibleProviderError("oversized_envelope");
      let envelope;
      try {
        envelope = JSON.parse(envelopeText);
      } catch {
        throw new CompatibleProviderError("invalid_envelope");
      }
      if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new CompatibleProviderError("invalid_envelope");
      const content = envelope?.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
      if (content && typeof content === "object" && !Array.isArray(content)) return content;
      if (Array.isArray(content)) {
        const text = content.map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "").join("").trim();
        if (text) return text;
      }
      throw new CompatibleProviderError("missing_content");
    }
  };
}

// lib/publish-store.mjs
var MAX_BODY_BYTES3 = 2e7;
function emptyPublished() {
  return { version: 1, updatedAt: null, routes: {} };
}
function loadPublished(file) {
  try {
    const parsed = JSON.parse(import_node_fs3.default.readFileSync(file, "utf8"));
    if (parsed && typeof parsed === "object" && typeof parsed.routes === "object" && parsed.routes !== null) {
      return parsed;
    }
  } catch {
  }
  return emptyPublished();
}
function savePublished(file, published) {
  import_node_fs3.default.mkdirSync(import_node_path3.default.dirname(file), { recursive: true });
  import_node_fs3.default.writeFileSync(file, JSON.stringify(published, null, 2) + "\n");
}
function sendJson4(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
function readJsonBody3(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES3) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
function publishedToDesign(published) {
  const routes = {};
  for (const [routeKey, viewports] of Object.entries(published.routes ?? {})) {
    for (const [viewportMode, entry] of Object.entries(viewports ?? {})) {
      if (!entry?.store) continue;
      routes[routeKey] = routes[routeKey] ?? {};
      routes[routeKey][viewportMode] = entry.store;
    }
  }
  return {
    version: DESIGN_VERSION,
    updatedAt: published.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    meta: { createdWith: "froam-studio" },
    routes
  };
}
function createFroamPublishApi({ file, authorize = null, log = () => {
}, commit = null }) {
  return async function handlePublishRequest(req, res) {
    const url = new URL(req.url ?? "/", "http://froam.local");
    if (!url.pathname.endsWith("/published")) return false;
    if (req.method === "GET") {
      const routeKey = normalizeRouteKey(url.searchParams.get("routeKey") ?? "/");
      const viewportMode = url.searchParams.get("viewportMode") ?? "desktop";
      if (!VIEWPORTS.includes(viewportMode)) {
        sendJson4(res, 400, { success: false, error: "Invalid viewportMode" });
        return true;
      }
      const entry = loadPublished(file).routes[routeKey]?.[viewportMode] ?? null;
      sendJson4(res, 200, {
        success: true,
        design: entry ? { routeKey, viewportMode, store: entry.store, publishedAt: entry.publishedAt ?? null } : null
      });
      return true;
    }
    if (req.method === "POST") {
      if (authorize && !await authorize(req)) {
        sendJson4(res, 403, { success: false, error: "Not authorized to publish" });
        return true;
      }
      let body;
      try {
        body = await readJsonBody3(req);
      } catch {
        sendJson4(res, 400, { success: false, error: "Invalid JSON body" });
        return true;
      }
      const routeKey = normalizeRouteKey(body?.routeKey ?? "");
      const viewportMode = body?.viewportMode;
      const store = body?.store;
      if (!VIEWPORTS.includes(viewportMode) || typeof store !== "object" || store === null) {
        sendJson4(res, 400, { success: false, error: "Expected { routeKey, viewportMode, store }" });
        return true;
      }
      const published = loadPublished(file);
      const publishedAt = (/* @__PURE__ */ new Date()).toISOString();
      published.routes[routeKey] = published.routes[routeKey] ?? {};
      published.routes[routeKey][viewportMode] = { store, publishedAt };
      published.updatedAt = publishedAt;
      savePublished(file, published);
      log(`published ${routeKey} (${viewportMode}) \u2192 ${import_node_path3.default.basename(file)}`);
      let committed = null;
      if (commit) {
        try {
          committed = await commit({
            design: publishedToDesign(published),
            message: `Froam: ${routeKey} (${viewportMode})`
          });
          log(`committed ${routeKey} (${viewportMode}) to the repo`);
        } catch (error) {
          committed = { error: error?.message ?? "commit failed" };
          log(`commit failed: ${committed.error}`);
        }
      }
      sendJson4(res, 200, { success: true, design: { routeKey, viewportMode, publishedAt }, committed });
      return true;
    }
    sendJson4(res, 405, { success: false, error: "Method not allowed" });
    return true;
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FroamStaleRevisionError,
  PRESENCE_TTL_MS,
  createFileProjectDocumentStore,
  createFroamIntelligenceApi,
  createFroamProjectSyncApi,
  createFroamPublishApi,
  createFroamRoomApi,
  createGitHubCommitter,
  createMemoryProjectDocumentStore,
  createOpenAICompatibleProvider,
  loadPublished
});
