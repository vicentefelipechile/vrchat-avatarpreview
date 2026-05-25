import { mountWelcome } from './views/welcome';
import { mountViewer } from './views/viewer';

type View = 'welcome' | 'viewer';

const views: Record<View, () => void> = {
    welcome: mountWelcome,
    viewer: mountViewer,
};

function getView(): View {
    const hash = window.location.hash.slice(1);
    return (hash === 'viewer' ? 'viewer' : 'welcome') as View;
}

function activateView(name: View): void {
    const all = document.querySelectorAll<HTMLElement>('.view');
    all.forEach(el => {
        el.style.display = el.dataset.view === name ? '' : 'none';
    });
    views[name]?.();
}

export function navigate(view: View): void {
    window.location.hash = view;
}

export function initRouter(): void {
    window.addEventListener('hashchange', () => {
        activateView(getView());
    });
    activateView(getView());
}
