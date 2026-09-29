import { type DeviceFrame } from './chef/device-sizes';
type Props = {
    frame: DeviceFrame;
    onPick: (id: string) => void;
    onDesktop: () => void;
};
/**
 * Under the phone or tablet: which screen it is, how big, how far it's scaled
 * to fit — and a menu of the other screens that preview the same edits.
 */
export default function FroamDeviceBar({ frame, onPick, onDesktop }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FroamDeviceBar.d.ts.map