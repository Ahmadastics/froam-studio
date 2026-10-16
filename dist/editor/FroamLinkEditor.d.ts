/**
 * Where a link goes, in the words a person would use: a website, a WhatsApp
 * chat, a call, an email or another page. Saving writes the address on the
 * selected link as an ordinary edit, so Undo, Save and sharing all cover it.
 */
export default function FroamLinkEditor({ href, changed, destinations, onSave, onReset }: {
    /** The link's address as the page shows it now. */
    href: string;
    /** The address is Froam's, not the page's own. */
    changed: boolean;
    /** Pages and sections this site already links to. */
    destinations: Array<{
        href: string;
        label: string;
    }>;
    onSave: (href: string) => void;
    onReset: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=FroamLinkEditor.d.ts.map