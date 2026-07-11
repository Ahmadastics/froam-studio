import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronRight,
  GitBranch,
  GitCommit,
  Image,
  Loader2,
  Plus,
  Radio,
  Search,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { apiGetFresh, apiPost, apiDelete } from '../lib/api'
import { getFroamRootElement } from '../config'

/* ── Types ───────────────────────────────────────────────────── */
export type FroamVersionMeta = {
  id: string
  name: string
  description?: string | null
  tags?: string[]
  notes?: string | null
  changeSummary?: FroamChangeSummary | null
  imageRefs?: FroamImageRef[]
  isLive: boolean
  parentVersionId?: string | null
  createdAt: string
  localOnly?: boolean
  routeKey?: string
  viewportMode?: string
}

type FroamChangeSummary = {
  draftCount: number
  insertedBlockCount: number
  textCount: number
  styleCount: number
  imageCount: number
  changedPaths?: string[]
}

type FroamImageRef = {
  path: string
  kind: 'image' | 'background'
  sha256?: string
  size?: number
  mime?: string | null
  preview?: string
}

type DiffEntry = {
  path: string
  kind: 'added' | 'removed' | 'changed'
  from?: unknown
  to?: unknown
}

type DiffResult = {
  a: { id: string; name: string; createdAt: string }
  b: { id: string; name: string; createdAt: string }
  diff: DiffEntry[]
  summary: { added: number; removed: number; changed: number; total: number }
}

type Props = {
  routeKey: string
  viewportMode: string
  currentStore: Record<string, unknown>
  getCurrentStore?: () => Record<string, unknown>
  onLoadVersion: (store: Record<string, unknown>, versionName: string) => void
  onClose: () => void
  captureThumb?: () => Promise<string | null>
}

type LocalFroamVersion = FroamVersionMeta & {
  routeKey: string
  viewportMode: string
  store: Record<string, unknown>
  localOnly: true
}

const LOCAL_VERSION_PREFIX = 'local:'
const LOCAL_VERSIONS_KEY = 'froam:local-versions:v1'
const LOCAL_THUMBS_KEY = 'froam:thumbs:v1'

/* Migrate versions saved under pre-3.1 (Run'Am-branded) localStorage keys. */
if (typeof window !== 'undefined') {
  try {
    const legacyPairs: Array<[string, string]> = [
      ['runam:froam-local-versions:v1', LOCAL_VERSIONS_KEY],
      ['runam:froam-thumbs:v1', LOCAL_THUMBS_KEY],
    ]
    for (const [oldKey, newKey] of legacyPairs) {
      const legacy = window.localStorage.getItem(oldKey)
      if (legacy !== null && window.localStorage.getItem(newKey) === null) {
        window.localStorage.setItem(newKey, legacy)
      }
    }
  } catch { /* storage unavailable */ }
}

function readThumbs(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(window.localStorage.getItem(LOCAL_THUMBS_KEY) ?? '{}') } catch { return {} }
}

function saveThumb(versionId: string, dataUrl: string) {
  if (typeof window === 'undefined') return
  const thumbs = readThumbs()
  thumbs[versionId] = dataUrl
  // keep max 40 thumbs — evict oldest by simple key count
  const keys = Object.keys(thumbs)
  if (keys.length > 40) delete thumbs[keys[0]]
  window.localStorage.setItem(LOCAL_THUMBS_KEY, JSON.stringify(thumbs))
}

function deleteThumb(versionId: string) {
  if (typeof window === 'undefined') return
  const thumbs = readThumbs()
  delete thumbs[versionId]
  window.localStorage.setItem(LOCAL_THUMBS_KEY, JSON.stringify(thumbs))
}

async function capturePageThumb(): Promise<string | null> {
  try {
    const root = getFroamRootElement()
    if (!root) return null
    // Use native browser API to take a bitmap snapshot of the root
    // We draw it onto a canvas at 320×180 for a compact thumbnail
    const rect = root.getBoundingClientRect()
    const scale = Math.min(320 / rect.width, 180 / rect.height, 1)
    const w = Math.round(rect.width * scale)
    const h = Math.round(rect.height * scale)
    // getDisplayMedia not available — use CSS paint worklet fallback: screenshot via scrollbar canvas
    // Best cross-browser approach without a lib: take a screenshot using the Offscreen approach
    // Since html2canvas isn't installed, we craft an SVG foreignObject snapshot
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Draw a simplified color-map from computed background
    const computed = window.getComputedStyle(root)
    ctx.fillStyle = computed.backgroundColor || '#050505'
    ctx.fillRect(0, 0, w, h)
    // Walk top-level visible children and paint rough blocks
    const children = Array.from(root.children).slice(0, 20) as HTMLElement[]
    for (const child of children) {
      const cr = child.getBoundingClientRect()
      const cc = window.getComputedStyle(child)
      if (cc.display === 'none') continue
      const x = (cr.left - rect.left) * scale
      const y = (cr.top - rect.top) * scale
      const cw = cr.width * scale
      const ch = cr.height * scale
      ctx.fillStyle = cc.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cc.backgroundColor : 'rgba(255,255,255,0.05)'
      const r = Math.min(parseFloat(cc.borderRadius) * scale, cw / 2, ch / 2) || 0
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x, y, cw, ch, r)
      } else {
        ctx.rect(x, y, cw, ch)
      }
      ctx.fill()
    }
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch {
    return null
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return 'Server sync failed'
}

function readLocalVersions() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_VERSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isLocalVersion) : []
  } catch {
    return []
  }
}

function writeLocalVersions(versions: LocalFroamVersion[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_VERSIONS_KEY, JSON.stringify(versions.slice(0, 80)))
}

function isLocalVersion(value: unknown): value is LocalFroamVersion {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LocalFroamVersion>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.startsWith(LOCAL_VERSION_PREFIX) &&
    typeof candidate.name === 'string' &&
    typeof candidate.routeKey === 'string' &&
    typeof candidate.viewportMode === 'string' &&
    typeof candidate.createdAt === 'string' &&
    !!candidate.store &&
    typeof candidate.store === 'object' &&
    !Array.isArray(candidate.store)
  )
}

function getScopedLocalVersions(routeKey: string, viewportMode: string) {
  return readLocalVersions()
    .filter((version) => version.routeKey === routeKey && version.viewportMode === viewportMode)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

function saveLocalVersion(
  routeKey: string,
  viewportMode: string,
  store: Record<string, unknown>,
  name: string,
  description?: string,
  tags: string[] = [],
  notes?: string,
  changeSummary?: FroamChangeSummary,
  imageRefs?: FroamImageRef[],
) {
  const version: LocalFroamVersion = {
    id: `${LOCAL_VERSION_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    routeKey,
    viewportMode,
    store,
    name,
    description: description || null,
    tags,
    notes: notes || null,
    changeSummary: changeSummary ?? summarizeStore(store),
    imageRefs: imageRefs ?? extractImageRefs(store),
    isLive: false,
    parentVersionId: null,
    createdAt: new Date().toISOString(),
    localOnly: true,
  }
  writeLocalVersions([version, ...readLocalVersions()])
  return version
}

function findLocalVersion(versionId: string) {
  return readLocalVersions().find((version) => version.id === versionId) ?? null
}

function deleteLocalVersion(versionId: string) {
  writeLocalVersions(readLocalVersions().filter((version) => version.id !== versionId))
}

function countInsertedBlocks(store: Record<string, unknown>) {
  return Object.keys(store).filter((key) => key.startsWith('__froam_injection__:')).length
}

function parseTags(value: string) {
  const tags: string[] = []
  for (const raw of value.split(',')) {
    const tag = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 40)
    if (tag && !tags.includes(tag)) tags.push(tag)
    if (tags.length >= 12) break
  }
  return tags
}

function isDraft(value: unknown): value is { text?: unknown; imageUrl?: unknown; styles?: unknown } {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function readBackgroundImageUrl(value: string) {
  const match = value.match(/url\((['"]?)(.*?)\1\)/i)
  return match?.[2] ?? null
}

function summarizeStore(store: Record<string, unknown>): FroamChangeSummary {
  const changedPaths = Object.keys(store)
  let textCount = 0
  let styleCount = 0
  let imageCount = 0
  for (const draftValue of Object.values(store)) {
    if (!isDraft(draftValue)) continue
    if (typeof draftValue.text === 'string') textCount += 1
    if (typeof draftValue.imageUrl === 'string') imageCount += 1
    if (draftValue.styles && typeof draftValue.styles === 'object' && !Array.isArray(draftValue.styles)) {
      const styles = draftValue.styles as Record<string, unknown>
      styleCount += Object.keys(styles).length
      if (typeof styles.backgroundImage === 'string' && readBackgroundImageUrl(styles.backgroundImage)) {
        imageCount += 1
      }
    }
  }
  return {
    draftCount: changedPaths.length,
    insertedBlockCount: countInsertedBlocks(store),
    textCount,
    styleCount,
    imageCount,
    changedPaths: changedPaths.slice(0, 120),
  }
}

function extractImageRefs(store: Record<string, unknown>): FroamImageRef[] {
  const refs: FroamImageRef[] = []
  for (const [path, draftValue] of Object.entries(store)) {
    if (!isDraft(draftValue)) continue
    if (typeof draftValue.imageUrl === 'string') {
      refs.push({ path, kind: 'image', size: draftValue.imageUrl.length, preview: draftValue.imageUrl.slice(0, 120) })
    }
    if (draftValue.styles && typeof draftValue.styles === 'object' && !Array.isArray(draftValue.styles)) {
      const styles = draftValue.styles as Record<string, unknown>
      if (typeof styles.backgroundImage === 'string') {
        const src = readBackgroundImageUrl(styles.backgroundImage)
        if (src) refs.push({ path, kind: 'background', size: src.length, preview: src.slice(0, 120) })
      }
    }
    if (refs.length >= 80) break
  }
  return refs
}

function summaryParts(summary?: FroamChangeSummary | null) {
  if (!summary) return []
  return [
    `${summary.draftCount} drafts`,
    summary.insertedBlockCount > 0 ? `${summary.insertedBlockCount} blocks` : '',
    summary.textCount > 0 ? `${summary.textCount} text` : '',
    summary.styleCount > 0 ? `${summary.styleCount} styles` : '',
    summary.imageCount > 0 ? `${summary.imageCount} images` : '',
  ].filter(Boolean)
}

/* ── FroamVersionPanel ──────────────────────────────────────── */
export default function FroamVersionPanel({
  routeKey,
  viewportMode,
  currentStore,
  getCurrentStore,
  onLoadVersion,
  onClose,
  captureThumb,
}: Props) {
  const [versions, setVersions] = useState<FroamVersionMeta[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => readThumbs())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [branching, setBranching] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [diffing, setDiffing] = useState<string | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [diffTarget, setDiffTarget] = useState<string | null>(null)
  const [libraryScope, setLibraryScope] = useState<'current' | 'all'>('current')
  const [librarySearch, setLibrarySearch] = useState('')

  // Save form
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [saveNotes, setSaveNotes] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  // Branch form
  const [branchName, setBranchName] = useState('')
  const [branchFromId, setBranchFromId] = useState<string | null>(null)
  const [showBranchForm, setShowBranchForm] = useState(false)

  const [toast, setToast] = useState('')
  const toastTimer = useRef<number>(0)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 3600)
  }, [])

  const loadVersions = useCallback(async () => {
    setLoading(true)
    const localVersions = libraryScope === 'all'
      ? readLocalVersions().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      : getScopedLocalVersions(routeKey, viewportMode)
    try {
      if (libraryScope === 'all') {
        const res = await apiGetFresh<{ success: boolean; versions: FroamVersionMeta[] }>('/api/froam/library')
        setVersions([...localVersions, ...(res.versions ?? [])])
        return
      }
      const params = new URLSearchParams({ routeKey, viewportMode })
      const res = await apiGetFresh<{ success: boolean; versions: FroamVersionMeta[] }>(
        `/api/froam/versions?${params}`,
      )
      setVersions([...localVersions, ...(res.versions ?? [])])
    } catch (error) {
      setVersions(localVersions)
      if (localVersions.length > 0) {
        showToast(`Showing local versions. ${getErrorMessage(error)}`)
      }
    } finally {
      setLoading(false)
    }
  }, [libraryScope, routeKey, viewportMode, showToast])

  useEffect(() => { void loadVersions() }, [loadVersions])

  async function handleSave() {
    if (!saveName.trim()) return
    const storeToSave = getCurrentStore?.() ?? currentStore
    const tags = parseTags(saveTags)
    const notes = saveNotes.trim()
    const changeSummary = summarizeStore(storeToSave)
    const imageRefs = extractImageRefs(storeToSave)
    const insertedBlockCount = changeSummary.insertedBlockCount
    setSaving(true)
    // Capture thumb before network ops
    const thumb = captureThumb ? await captureThumb() : await capturePageThumb()
    try {
      const res = await apiPost<{ success: boolean; version?: { id: string } }>('/api/froam/versions', {
        routeKey,
        viewportMode,
        store: storeToSave,
        name: saveName.trim(),
        description: saveDesc.trim() || undefined,
        tags,
        notes: notes || undefined,
      })
      if (thumb && res.version?.id) {
        saveThumb(res.version.id, thumb)
        setThumbs((prev) => ({ ...prev, [res.version!.id]: thumb }))
      }
      setSaveName('')
      setSaveDesc('')
      setSaveTags('')
      setSaveNotes('')
      setShowSaveForm(false)
      showToast(`Version saved (${insertedBlockCount} blocks, ${imageRefs.length} images tagged)`)
      await loadVersions()
    } catch (error) {
      const localVersion = saveLocalVersion(
        routeKey,
        viewportMode,
        storeToSave,
        saveName.trim(),
        saveDesc.trim() || undefined,
        tags,
        notes || undefined,
        changeSummary,
        imageRefs,
      )
      if (thumb) {
        saveThumb(localVersion.id, thumb)
        setThumbs((prev) => ({ ...prev, [localVersion.id]: thumb }))
      }
      setVersions((prev) => [localVersion, ...prev])
      setSaveName('')
      setSaveDesc('')
      setSaveTags('')
      setSaveNotes('')
      setShowSaveForm(false)
      showToast(`Saved locally (${insertedBlockCount} blocks, ${imageRefs.length} images tagged). Sync failed: ${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handlePromote(versionId: string) {
    if (versionId.startsWith(LOCAL_VERSION_PREFIX)) {
      showToast('Local versions need to sync before they can go live')
      return
    }
    setPromoting(versionId)
    try {
      await apiPost(`/api/froam/versions/${versionId}/promote`, {})
      const promoted = versions.find((version) => version.id === versionId)
      const res = await apiGetFresh<{
        success: boolean
        version: FroamVersionMeta & { store: Record<string, unknown> }
      }>(`/api/froam/versions/${versionId}`)
      if (res.success && res.version?.store) {
        onLoadVersion(res.version.store, promoted?.name ?? 'Promoted version')
      }
      showToast('Version promoted and loaded live')
      await loadVersions()
    } catch {
      showToast('Failed to promote version')
    } finally {
      setPromoting(null)
    }
  }

  async function handleLoadVersion(versionId: string, versionName: string) {
    if (versionId.startsWith(LOCAL_VERSION_PREFIX)) {
      const localVersion = findLocalVersion(versionId)
      if (localVersion) {
        onLoadVersion(localVersion.store, versionName)
        showToast(`Loaded local "${versionName}"`)
      } else {
        showToast('Local version not found')
      }
      return
    }
    try {
      const res = await apiGetFresh<{
        success: boolean
        version: FroamVersionMeta & { store: Record<string, unknown> }
      }>(`/api/froam/versions/${versionId}`)
      if (res.success && res.version?.store) {
        onLoadVersion(res.version.store, versionName)
        showToast(`Loaded "${versionName}"`)
      }
    } catch {
      showToast('Failed to load version')
    }
  }

  async function handleBranch() {
    if (!branchName.trim() || !branchFromId) return
    if (branchFromId.startsWith(LOCAL_VERSION_PREFIX)) {
      const localVersion = findLocalVersion(branchFromId)
      if (!localVersion) {
        showToast('Local version not found')
        return
      }
      const branch = saveLocalVersion(
        routeKey,
        viewportMode,
        localVersion.store,
        branchName.trim(),
        `Local branch from ${localVersion.name}`,
        localVersion.tags ?? [],
        localVersion.notes ?? undefined,
        localVersion.changeSummary ?? summarizeStore(localVersion.store),
        localVersion.imageRefs ?? extractImageRefs(localVersion.store),
      )
      branch.parentVersionId = branchFromId
      writeLocalVersions(readLocalVersions().map((version) => (version.id === branch.id ? branch : version)))
      setVersions((prev) => [branch, ...prev])
      setBranchName('')
      setBranchFromId(null)
      setShowBranchForm(false)
      showToast('Local branch created')
      return
    }
    setBranching(branchFromId)
    try {
      await apiPost(`/api/froam/versions/${branchFromId}/branch`, {
        name: branchName.trim(),
      })
      setBranchName('')
      setBranchFromId(null)
      setShowBranchForm(false)
      showToast('Branch created')
      await loadVersions()
    } catch {
      showToast('Failed to create branch')
    } finally {
      setBranching(null)
    }
  }

  async function handleDelete(versionId: string) {
    if (versionId.startsWith(LOCAL_VERSION_PREFIX)) {
      deleteLocalVersion(versionId)
      deleteThumb(versionId)
      setThumbs((prev) => { const n = { ...prev }; delete n[versionId]; return n })
      setVersions((prev) => prev.filter((version) => version.id !== versionId))
      setDiffResult(null)
      showToast('Local version deleted')
      return
    }
    setDeleting(versionId)
    try {
      await apiDelete(`/api/froam/versions/${versionId}`)
      deleteThumb(versionId)
      setThumbs((prev) => { const n = { ...prev }; delete n[versionId]; return n })
      showToast('Version deleted')
      setDiffResult(null)
      await loadVersions()
    } catch {
      showToast('Failed to delete version')
    } finally {
      setDeleting(null)
    }
  }

  async function handleDiff(versionId: string) {
    if (versionId.startsWith(LOCAL_VERSION_PREFIX)) {
      showToast('Local versions need to sync before diffing')
      return
    }
    // Toggle off if already viewing this diff
    if (diffTarget === versionId) {
      setDiffTarget(null)
      setDiffResult(null)
      return
    }
    // Need the live version to compare against — find it
    const liveVersion = versions.find((v) => v.isLive && !v.localOnly)
    if (!liveVersion) {
      showToast('No live version to compare against')
      return
    }
    if (liveVersion.id === versionId) {
      showToast('This is already the live version')
      return
    }
    setDiffing(versionId)
    setDiffTarget(versionId)
    try {
      const params = new URLSearchParams({ a: liveVersion.id, b: versionId })
      const res = await apiGetFresh<DiffResult & { success: boolean }>(`/api/froam/diff?${params}`)
      setDiffResult(res)
    } catch {
      showToast('Failed to compute diff')
      setDiffTarget(null)
    } finally {
      setDiffing(null)
    }
  }

  const query = librarySearch.trim().toLowerCase()
  const visibleVersions = query
    ? versions.filter((version) => {
        const haystack = [
          version.name,
          version.description ?? '',
          version.notes ?? '',
          version.routeKey ?? '',
          version.viewportMode ?? '',
          ...(version.tags ?? []),
        ].join(' ').toLowerCase()
        return haystack.includes(query)
      })
    : versions
  const liveId = versions.find((v) => v.isLive)?.id

  return (
    <div className="froam-versions" data-chef-editor-root="true">

      {/* Header */}
      <div className="froam-versions__header" data-chef-editor-root="true">
        <span className="froam-versions__title">
          <GitCommit size={13} />
          Saved Changes
        </span>
        <button type="button" className="froam-versions__close" onClick={onClose} data-chef-editor-root="true">
          <X size={13} />
        </button>
      </div>

      <div className="froam-versions__library" data-chef-editor-root="true">
        <div className="froam-versions__scope" data-chef-editor-root="true">
          <button
            type="button"
            className={`froam-versions__scope-btn ${libraryScope === 'current' ? 'is-active' : ''}`}
            onClick={() => setLibraryScope('current')}
            data-chef-editor-root="true"
          >
            This page
          </button>
          <button
            type="button"
            className={`froam-versions__scope-btn ${libraryScope === 'all' ? 'is-active' : ''}`}
            onClick={() => setLibraryScope('all')}
            data-chef-editor-root="true"
          >
            All saved
          </button>
        </div>
        <label className="froam-versions__search" data-chef-editor-root="true">
          <Search size={12} />
          <input
            type="search"
            placeholder="Search names, tags, notes"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            data-chef-editor-root="true"
          />
        </label>
      </div>

      {/* Save new version */}
      <div className="froam-versions__save-zone" data-chef-editor-root="true">
        {showSaveForm ? (
          <div className="froam-versions__save-form" data-chef-editor-root="true">
            <input
              className="froam-versions__input"
              type="text"
              placeholder="Version name (e.g. Dark hero v2)"
              value={saveName}
              maxLength={120}
              autoFocus
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setShowSaveForm(false) }}
              data-chef-editor-root="true"
            />
            <input
              className="froam-versions__input"
              type="text"
              placeholder="Description (optional)"
              value={saveDesc}
              maxLength={400}
              onChange={(e) => setSaveDesc(e.target.value)}
              data-chef-editor-root="true"
            />
            <input
              className="froam-versions__input"
              type="text"
              placeholder="Tags, comma separated (hero, mobile, image-fix)"
              value={saveTags}
              maxLength={240}
              onChange={(e) => setSaveTags(e.target.value)}
              data-chef-editor-root="true"
            />
            <textarea
              className="froam-versions__input froam-versions__textarea"
              placeholder="Notes about what changed (optional)"
              value={saveNotes}
              maxLength={1000}
              rows={3}
              onChange={(e) => setSaveNotes(e.target.value)}
              data-chef-editor-root="true"
            />
            <div className="froam-versions__save-actions" data-chef-editor-root="true">
              <button
                type="button"
                className="froam-versions__btn is-accent"
                onClick={() => void handleSave()}
                disabled={saving || !saveName.trim()}
                data-chef-editor-root="true"
              >
                {saving ? <Loader2 size={12} className="froam-versions__spin" /> : <Check size={12} />}
                Save version
              </button>
              <button type="button" className="froam-versions__btn" onClick={() => setShowSaveForm(false)} data-chef-editor-root="true">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="froam-versions__btn is-accent is-full"
            onClick={() => setShowSaveForm(true)}
            data-chef-editor-root="true"
          >
            <Plus size={12} /> Save current as version
          </button>
        )}
      </div>

      {/* Branch form (shown when branching) */}
      <AnimatePresence>
        {showBranchForm && branchFromId && (
          <motion.div
            className="froam-versions__branch-form"
            data-chef-editor-root="true"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <span className="froam-versions__branch-label">
              <GitBranch size={11} />
              Branch from: <strong>{versions.find((v) => v.id === branchFromId)?.name}</strong>
            </span>
            <input
              className="froam-versions__input"
              type="text"
              placeholder="New branch name"
              value={branchName}
              maxLength={120}
              autoFocus
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleBranch(); if (e.key === 'Escape') setShowBranchForm(false) }}
              data-chef-editor-root="true"
            />
            <div className="froam-versions__save-actions" data-chef-editor-root="true">
              <button
                type="button"
                className="froam-versions__btn is-accent"
                onClick={() => void handleBranch()}
                disabled={!!branching || !branchName.trim()}
                data-chef-editor-root="true"
              >
                {branching ? <Loader2 size={12} className="froam-versions__spin" /> : <GitBranch size={12} />}
                Create branch
              </button>
              <button type="button" className="froam-versions__btn" onClick={() => setShowBranchForm(false)} data-chef-editor-root="true">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Versions list */}
      <div className="froam-versions__list" data-chef-editor-root="true">
        {loading ? (
          <div className="froam-versions__empty" data-chef-editor-root="true">
            <Loader2 size={18} className="froam-versions__spin" />
            <span>Loading versions…</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="froam-versions__empty" data-chef-editor-root="true">
            <GitCommit size={22} style={{ opacity: 0.3 }} />
            <span>No saved versions yet.</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Save your current edits as a named version above.</span>
          </div>
        ) : visibleVersions.length === 0 ? (
          <div className="froam-versions__empty" data-chef-editor-root="true">
            <Search size={22} style={{ opacity: 0.3 }} />
            <span>No saved changes match your search.</span>
          </div>
        ) : (
          visibleVersions.map((v) => (
            <div key={v.id} className={`froam-versions__item ${v.isLive ? 'is-live' : ''}`} data-chef-editor-root="true">
              {/* Branch connector */}
              {v.parentVersionId && (
                <div className="froam-versions__branch-line" data-chef-editor-root="true">
                  <ChevronRight size={10} />
                </div>
              )}

              <div className="froam-versions__item-main" data-chef-editor-root="true">
                {thumbs[v.id] && (
                  <button
                    type="button"
                    className="froam-versions__thumb"
                    title="Restore this visual version"
                    onClick={() => void handleLoadVersion(v.id, v.name)}
                    data-chef-editor-root="true"
                  >
                    <img src={thumbs[v.id]} alt="" aria-hidden="true" className="froam-versions__thumb-img" />
                    {v.isLive && <span className="froam-versions__thumb-live">LIVE</span>}
                  </button>
                )}
                <div className="froam-versions__item-meta" data-chef-editor-root="true">
                  <span className="froam-versions__item-name">
                    {v.parentVersionId && <GitBranch size={10} style={{ opacity: 0.5, marginRight: 4 }} />}
                    {v.name}
                  </span>
                  {v.isLive && !thumbs[v.id] && (
                    <span className="froam-versions__live-badge" data-chef-editor-root="true">
                      <Radio size={8} /> LIVE
                    </span>
                  )}
                  {v.localOnly && (
                    <span className="froam-versions__live-badge" data-chef-editor-root="true">
                      LOCAL
                    </span>
                  )}
                </div>
                {v.description && (
                  <span className="froam-versions__item-desc">{v.description}</span>
                )}
                {libraryScope === 'all' && v.routeKey && (
                  <span className="froam-versions__route-chip" data-chef-editor-root="true">
                    {v.routeKey} - {v.viewportMode ?? 'desktop'}
                  </span>
                )}
                {(v.tags?.length ?? 0) > 0 && (
                  <div className="froam-versions__tags" data-chef-editor-root="true">
                    {(v.tags ?? []).map((tag) => (
                      <span key={tag} className="froam-versions__tag" data-chef-editor-root="true">
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                  </div>
                )}
                {v.notes && (
                  <span className="froam-versions__notes" data-chef-editor-root="true">{v.notes}</span>
                )}
                {(summaryParts(v.changeSummary).length > 0 || (v.imageRefs?.length ?? 0) > 0) && (
                  <div className="froam-versions__summary" data-chef-editor-root="true">
                    {summaryParts(v.changeSummary).map((part) => (
                      <span key={part} className="froam-versions__summary-pill" data-chef-editor-root="true">{part}</span>
                    ))}
                    {(v.imageRefs?.length ?? 0) > 0 && (
                      <span className="froam-versions__summary-pill" data-chef-editor-root="true">
                        <Image size={10} /> {v.imageRefs?.length} refs
                      </span>
                    )}
                  </div>
                )}
                <span className="froam-versions__item-time">
                  {new Date(v.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>

              {/* Actions */}
              <div className="froam-versions__item-actions" data-chef-editor-root="true">
                {/* Load / Restore — primary CTA */}
                <button
                  type="button"
                  className="froam-versions__action-btn is-restore"
                  title="Restore this version into the editor"
                  onClick={() => void handleLoadVersion(v.id, v.name)}
                  data-chef-editor-root="true"
                >
                  <Zap size={11} /> Restore
                </button>

                {/* Promote to live */}
                {!v.isLive && !v.localOnly && (
                  <button
                    type="button"
                    className="froam-versions__action-btn is-accent"
                    title="Promote to live"
                    disabled={promoting === v.id}
                    onClick={() => void handlePromote(v.id)}
                    data-chef-editor-root="true"
                  >
                    {promoting === v.id
                      ? <Loader2 size={11} className="froam-versions__spin" />
                      : <Zap size={11} />}
                  </button>
                )}
                {v.isLive && (
                  <span className="froam-versions__action-btn is-live-indicator" data-chef-editor-root="true">
                    <Zap size={11} />
                  </span>
                )}

                {/* Diff vs live */}
                {!v.isLive && !v.localOnly && liveId && (
                  <button
                    type="button"
                    className={`froam-versions__action-btn ${diffTarget === v.id ? 'is-active' : ''}`}
                    title="Diff vs live"
                    disabled={diffing === v.id}
                    onClick={() => void handleDiff(v.id)}
                    data-chef-editor-root="true"
                  >
                    {diffing === v.id
                      ? <Loader2 size={11} className="froam-versions__spin" />
                      : 'Diff'}
                  </button>
                )}

                {/* Branch from */}
                <button
                  type="button"
                  className="froam-versions__action-btn"
                  title="Branch from this version"
                  onClick={() => { setBranchFromId(v.id); setBranchName(''); setShowBranchForm(true) }}
                  data-chef-editor-root="true"
                >
                  <GitBranch size={11} />
                </button>

                {/* Delete */}
                {!v.isLive && (
                  <button
                    type="button"
                    className="froam-versions__action-btn is-danger"
                    title="Delete version"
                    disabled={deleting === v.id}
                    onClick={() => void handleDelete(v.id)}
                    data-chef-editor-root="true"
                  >
                    {deleting === v.id
                      ? <Loader2 size={11} className="froam-versions__spin" />
                      : <Trash2 size={11} />}
                  </button>
                )}
              </div>

              {/* Diff panel (shown inline under the version) */}
              <AnimatePresence>
                {diffTarget === v.id && diffResult && (
                  <motion.div
                    className="froam-versions__diff"
                    data-chef-editor-root="true"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="froam-versions__diff-header" data-chef-editor-root="true">
                      <span>
                        <strong style={{ color: 'var(--fs-accent)' }}>{diffResult.a.name}</strong>
                        {' '}→{' '}
                        <strong style={{ color: 'var(--fs-text-warm)' }}>{diffResult.b.name}</strong>
                      </span>
                      <span className="froam-versions__diff-summary" data-chef-editor-root="true">
                        <span style={{ color: '#5eead4' }}>+{diffResult.summary.added}</span>
                        {' '}
                        <span style={{ color: '#ff6c4f' }}>−{diffResult.summary.removed}</span>
                        {' '}
                        <span style={{ color: '#f0f4f8' }}>~{diffResult.summary.changed}</span>
                      </span>
                    </div>
                    {diffResult.diff.length === 0 ? (
                      <span className="froam-versions__diff-empty" data-chef-editor-root="true">No differences</span>
                    ) : (
                      <ul className="froam-versions__diff-list" data-chef-editor-root="true">
                        {diffResult.diff.map((entry) => (
                          <li
                            key={entry.path}
                            className={`froam-versions__diff-row is-${entry.kind}`}
                            data-chef-editor-root="true"
                          >
                            <span className="froam-versions__diff-kind">
                              {entry.kind === 'added' ? '+' : entry.kind === 'removed' ? '−' : '~'}
                            </span>
                            <span className="froam-versions__diff-path" title={entry.path}>
                              {entry.path.length > 54 ? `…${entry.path.slice(-50)}` : entry.path}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="froam-versions__toast" data-chef-editor-root="true">
          {toast}
        </div>
      )}
    </div>
  )
}
