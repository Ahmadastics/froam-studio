import type { FroamArchiveItem, FroamProjectState } from './types';
export type FroamMemoryInsight = {
    id: string;
    tone: 'signal' | 'opportunity' | 'warning';
    title: string;
    detail: string;
    action?: 'scan-selection' | 'open-archive' | 'save-interaction';
};
export type FroamIntelligenceMemory = {
    artifactCounts: Record<'component' | 'style' | 'motion' | 'interaction' | 'interface-pattern', number>;
    learnedTriggers: Array<{
        trigger: string;
        count: number;
    }>;
    learnedRoles: Array<{
        role: string;
        count: number;
    }>;
    totalUses: number;
    insights: FroamMemoryInsight[];
};
export declare function buildIntelligenceMemory(state: FroamProjectState): FroamIntelligenceMemory;
export declare function archiveItemsForNode(items: FroamArchiveItem[], nodeId?: string): FroamArchiveItem[];
//# sourceMappingURL=intelligence-memory.d.ts.map