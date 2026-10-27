/** Tester build only. WebMCP exercises the same callbacks as visible Cocos controls. */
export class BrowserTestBridge {
    private controls = new Map<string, { label: string; invoke: () => void }>();
    private texts: string[] = [];
    private sequence = 0;
    constructor(enabled: boolean, private snapshot: () => object) {
        if (!enabled || typeof document === 'undefined') return;
        const context = (document as unknown as { modelContext?: { registerTool: (tool: object) => Promise<unknown> } }).modelContext
            || (navigator as unknown as { modelContext?: { registerTool: (tool: object) => Promise<unknown> } }).modelContext;
        if (!context) return;
        const state = () => ({ ...this.snapshot(), texts: [...this.texts],
            controls: [...this.controls].map(([id, item]) => ({ id, label: item.label })) });
        const register = (tool: object) => {
            try { Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch { /* Optional browser support. */ }
        };
        register({ name: 'shise_state', description: 'Read the visible state and currently available controls of this Cocos tester build. Does not reveal puzzle answers.',
            inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true }, execute: async () => ({ content: [{ type: 'text', text: JSON.stringify(state()) }] }) });
        register({ name: 'shise_tap', description: 'Tap one currently displayed Cocos game control using its id from shise_state. Uses the same callback as the visible UI; no arbitrary state edits.',
            inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            execute: async (input: { id: string }) => {
                const control = this.controls.get(input.id);
                if (!control) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Control is stale; read shise_state again.' }) }] };
                control.invoke();
                await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
                return { content: [{ type: 'text', text: JSON.stringify(state()) }] };
            } });
    }
    clear(): void { this.controls.clear(); this.texts = []; }
    modal(): void { this.controls.clear(); }
    text(value: string): void { this.texts.push(value); }
    control(label: string, invoke: () => void): void {
        this.controls.set(`control-${++this.sequence}`, { label, invoke });
    }
}
