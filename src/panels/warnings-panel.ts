export function renderWarningsPanel(container: HTMLElement, warnings: string[]): void {
    container.innerHTML = '';

    if (warnings.length === 0) {
        container.innerHTML = `
            <div class="panel-empty no-warnings">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                No warnings
            </div>
        `;
        return;
    }

    const section = document.createElement('div');
    section.className = 'panel-section';
    section.innerHTML = `<div class="panel-section-title">Warnings (${warnings.length})</div>`;

    for (const warning of warnings) {
        const item = document.createElement('div');
        item.className = 'warning-item';
        item.innerHTML = `
            <svg class="warning-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>${escHtml(warning)}</span>
        `;
        section.appendChild(item);
    }

    container.appendChild(section);
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
