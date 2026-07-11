import { type FroamFrameSpec, type FroamInsertPlacement, type FroamWireframeSection } from './FroamPlannerTypes';
type Props = {
    routeKey: string;
    onInsertComponent: (componentId: string, placement: FroamInsertPlacement, frame: FroamFrameSpec) => void;
    onInsertBlankFrame: (placement: FroamInsertPlacement, frame: FroamFrameSpec) => void;
    onBuildPage: (sections: FroamWireframeSection[]) => void;
    onToast: (message: string) => void;
};
export default function FroamSitePlanner({ routeKey, onInsertComponent, onInsertBlankFrame, onBuildPage, onToast }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamSitePlanner.d.ts.map