import { invoke } from '@tauri-apps/api/core';
import { navigate } from '../router';
import { resetForNewPackage, setState } from '../store/scene';
import type { SceneGraph } from '../types/scene';
import { setSceneGraph } from './viewer';

const FOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

let mounted = false;

export function mountWelcome(): void {
    if (mounted) {
        const btn = document.getElementById('btn-open') as HTMLButtonElement | null;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `${FOLDER_ICON} Open Package`;
        }
        const errEl = document.getElementById('welcome-error');
        if (errEl) errEl.style.display = 'none';
        return;
    }
    mounted = true;

    const container = document.getElementById('view-welcome')!;
    container.innerHTML = `
        <div class="welcome-screen">
            <div class="welcome-content">
                <h1 class="welcome-title">VRCStorage Avatar Preview</h1>
                <p class="welcome-subtitle">Open a <code>.unitypackage</code> to preview the avatar — no Unity required.</p>
                <button id="btn-open" class="btn-primary">
                    ${FOLDER_ICON}
                    Open Package
                </button>
                <p id="welcome-error" class="welcome-error" style="display:none"></p>
            </div>
        </div>
    `;

    document.getElementById('btn-open')!.addEventListener('click', onOpenClick);
}

async function onOpenClick(): Promise<void> {
    const btn = document.getElementById('btn-open') as HTMLButtonElement;
    const errEl = document.getElementById('welcome-error')!;

    btn.disabled = true;
    btn.textContent = 'Opening…';
    errEl.style.display = 'none';

    try {
        const path = await invoke<string | null>('open_file_dialog');
        if (!path) {
            btn.disabled = false;
            btn.innerHTML = `${FOLDER_ICON} Open Package`;
            return;
        }

        btn.textContent = 'Loading…';
        resetForNewPackage();
        setState({ isLoading: true });

        const graph = await invoke<SceneGraph>('load_package', { path });

        setState({ sceneGraph: graph, isLoading: false });
        setSceneGraph(graph);
        navigate('viewer');
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errEl.textContent = msg;
        errEl.style.display = '';
        btn.disabled = false;
        btn.innerHTML = `${FOLDER_ICON} Open Package`;
        setState({ isLoading: false, error: msg });
    }
}
