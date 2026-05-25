import type { AvatarStats } from '../types/scene';

export function renderStatsBar(container: HTMLElement, stats: AvatarStats): void {
    container.innerHTML = `
        <div class="stats-bar">
            <div class="stat-item">
                <span class="stat-value">${stats.triangle_count.toLocaleString()}</span>
                <span class="stat-label">Triangles</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.bone_count.toLocaleString()}</span>
                <span class="stat-label">Bones</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.material_count}</span>
                <span class="stat-label">Materials</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${stats.blend_shape_count}</span>
                <span class="stat-label">Shapes</span>
            </div>
        </div>
    `;
}
