import { normalizeMutationConstraints } from './mutation.js';
import { deriveBranchState } from './event-log.js';
import { buildIntelligenceMemory } from './intelligence-memory.js';
/** Maximum scan records to include per request (keeps payload bounded). */
const MAX_SCAN_RECORDS = 12;
/** Maximum DNA records to include per request. */
const MAX_DNA_RECORDS = 8;
const MAX_RELATIONSHIPS = 16;
const MAX_RESPONSIVE_POLICIES = 8;
/**
 * Assemble a bounded FroamIntelligencePlanRequest from current Froam state.
 *
 * Returns null if no safe scope can be determined (e.g. no nodes in project
 * and no selection). The caller should show a user-visible message in that
 * case rather than sending an empty request.
 */
export function assembleFroamIntelligenceRequest(input) {
    const { project, intent, scope, priorAttemptFeedback, requestId, consent, selectionEvidence } = input;
    const state = deriveBranchState(project);
    // ── Scope resolution ──────────────────────────────────────────────────────
    if (!scope.selectedNodeId)
        return null;
    const selectedNode = selectionEvidence?.node.id === scope.selectedNodeId
        ? selectionEvidence.node
        : state.nodes[scope.selectedNodeId];
    if (!selectedNode)
        return null;
    const scopeNodeIds = [scope.selectedNodeId];
    const selectedScan = selectionEvidence?.scan?.node.nodeId === scope.selectedNodeId
        ? selectionEvidence.scan
        : Object.values(state.scans).filter((record) => record.node.nodeId === scope.selectedNodeId).sort((a, b) => b.capturedAt - a.capturedAt)[0];
    const evidenceIds = new Set([scope.selectedNodeId, ...(selectedScan?.childNodeIds ?? []), ...(selectedScan?.siblingNodeIds ?? [])]);
    // ── Scan records ──────────────────────────────────────────────────────────
    // Neighbour scans are bounded context, not mutation scope.
    const scanRecords = [
        ...(selectionEvidence?.scan ? [selectionEvidence.scan] : []),
        // A fresh live observation is the authoritative, bounded source. Avoid a
        // project-wide scan in the interactive Ask Froam path; older projects can
        // still fall back to persisted records when no observation was supplied.
        ...(!selectionEvidence?.scan ? Object.values(state.scans) : []),
    ]
        .filter((record, index, all) => evidenceIds.has(record.node.nodeId) && all.findIndex((candidate) => candidate.id === record.id) === index)
        .sort((a, b) => b.capturedAt - a.capturedAt)
        .slice(0, MAX_SCAN_RECORDS);
    // ── DNA ───────────────────────────────────────────────────────────────────
    const dna = {};
    let dnaCount = 0;
    if (selectionEvidence?.dna?.nodeId === scope.selectedNodeId) {
        dna[scope.selectedNodeId] = selectionEvidence.dna;
        dnaCount = 1;
    }
    for (const nodeId of evidenceIds) {
        if (dnaCount >= MAX_DNA_RECORDS)
            break;
        if (!dna[nodeId] && state.dna[nodeId]) {
            dna[nodeId] = state.dna[nodeId];
            dnaCount++;
        }
    }
    const relationships = [
        ...(selectionEvidence?.relationships ?? []),
        ...(!selectionEvidence?.relationships ? Object.values(state.relations) : []),
    ].filter((relation, index, all) => evidenceIds.has(relation.from) || evidenceIds.has(relation.to)
        ? all.findIndex((candidate) => candidate.id === relation.id) === index
        : false).slice(0, MAX_RELATIONSHIPS);
    const responsivePolicies = [...evidenceIds].flatMap((nodeId) => state.responsive[nodeId] ? [state.responsive[nodeId]] : []).slice(0, MAX_RESPONSIVE_POLICIES);
    // ── Memory ────────────────────────────────────────────────────────────────
    const memory = buildIntelligenceMemory(state);
    // ── Context ───────────────────────────────────────────────────────────────
    const context = {
        projectId: project.id,
        activeBranchId: project.activeBranchId,
        routeKey: scope.routeKey,
        viewport: scope.viewport,
        selectedNodeId: scope.selectedNodeId ?? null,
        selectedPath: scope.selectedDomPath ?? null,
        selectedDomPath: scope.selectedDomPath ?? null,
        scanRecords: scanRecords.length > 0 ? scanRecords : undefined,
        dna: dnaCount > 0 ? dna : undefined,
        relationships: relationships.length > 0 ? relationships : undefined,
        responsivePolicies: responsivePolicies.length > 0 ? responsivePolicies : undefined,
        memory,
    };
    // ── Constraints ───────────────────────────────────────────────────────────
    // Safe level by default for Phase 2. Protects navigation and brand colors.
    const constraints = normalizeMutationConstraints('safe', {
        protect: ['navigation', 'logo', 'brand-colors'],
    });
    const request = {
        schemaVersion: 1,
        purpose: 'mutate',
        intent: intent.trim().slice(0, 2000),
        context,
        constraints,
        scopeNodeIds,
        protectedNodeIds: /navigation|menu|logo/i.test(String(selectedNode.metadata?.semanticRole ?? selectedNode.name ?? '')) ? [scope.selectedNodeId] : [],
        priorAttemptFeedback: priorAttemptFeedback?.trim().slice(0, 1000) || null,
        requestId,
        // Consent is passed through so the server can enforce it.
        // It is NOT stored in the context object (no credentials in context).
        ...(consent ? { consent: true } : {}),
    };
    return request;
}
/**
 * Determine whether a query string looks like natural-language intent
 * rather than a known command prefix.
 *
 * Used by the command palette to decide whether to show "Ask Froam".
 * Conservative: requires at least 3 non-whitespace characters and at
 * least one word that is not a single letter.
 */
export function looksLikeNaturalLanguageIntent(query) {
    const trimmed = query.trim();
    if (trimmed.length < 3)
        return false;
    const words = trimmed.split(/\s+/).filter(Boolean);
    return words.some((w) => w.length > 1);
}
//# sourceMappingURL=intelligence-context.js.map