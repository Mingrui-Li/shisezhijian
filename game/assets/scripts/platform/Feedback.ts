import { AudioClip, AudioSource, Node, resources } from 'cc';

/** Optional, quiet feedback; missing audio or vibration never blocks an action. */
export class Feedback {
    private source: AudioSource;
    private clips: Partial<Record<'place' | 'complete', AudioClip>> = {};
    constructor(node: Node) {
        this.source = node.addComponent(AudioSource);
        for (const name of ['place', 'complete'] as const) {
            resources.load(`audio/${name}`, AudioClip, (error, clip) => {
                if (!error && clip) this.clips[name] = clip;
            });
        }
    }
    play(name: 'place' | 'complete', sound: boolean, haptics: boolean): void {
        const clip = this.clips[name];
        if (sound && clip) {
            try { this.source.playOneShot(clip, name === 'place' ? 0.3 : 0.45); } catch { /* Optional capability. */ }
        }
        if (haptics) {
            const tt = (globalThis as unknown as { tt?: { vibrateShort?: (args: object) => void } }).tt;
            try { tt?.vibrateShort?.({ type: 'light', fail: () => {} }); } catch { /* Optional capability. */ }
        }
    }
}
