/**
 * Renders a graph returned by the runner as inline SVG.
 * This module only DRAWS the data it is given — it never computes a layout.
 * Dark-pane styling comes from CSS (.pane--dark), keeping this module theme-agnostic.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW_W = 400;
const VIEW_H = 280;
const PAD = 22;

export function renderGraph(container, graph) {
    container.textContent = '';

    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];

    if (nodes.length === 0) {
        container.append(emptyStateWithDetails(
            'No graph output returned for this path.',
            'The runner did not return any nodes for this execution path.'
        ));
        return;
    }

    const points = nodes
        .map((node) => ({ id: String(node.id), x: Number(node.x), y: Number(node.y) }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    if (points.length === 0) {
        container.append(emptyStateWithDetails(
            'Graph data is missing numeric node coordinates.',
            `Received ${nodes.length} node(s) but none had valid x/y coordinates.`
        ));
        return;
    }

    const byId = new Map(points.map((point) => [point.id, point]));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scaleX = (x) => PAD + ((x - minX) / rangeX) * (VIEW_W - 2 * PAD);
    const scaleY = (y) => PAD + ((y - minY) / rangeY) * (VIEW_H - 2 * PAD);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute('width', String(VIEW_W));
    svg.setAttribute('height', String(VIEW_H));
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Graph output returned by the runner');

    for (const edge of edges) {
        const a = byId.get(String(edge.source));
        const b = byId.get(String(edge.target));
        if (!a || !b) continue;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', scaleX(a.x));
        line.setAttribute('y1', scaleY(a.y));
        line.setAttribute('x2', scaleX(b.x));
        line.setAttribute('y2', scaleY(b.y));
        line.setAttribute('class', 'graph-edge');
        // Per-edge draw animation length based on actual line geometry
        const len = Math.hypot(scaleX(b.x) - scaleX(a.x), scaleY(b.y) - scaleY(a.y));
        line.style.strokeDasharray = String(len);
        line.style.strokeDashoffset = String(len);
        svg.append(line);
    }

    for (const point of points) {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', scaleX(point.x));
        circle.setAttribute('cy', scaleY(point.y));
        circle.setAttribute('r', '5.5');
        circle.setAttribute('class', 'graph-node');
        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = point.id;
        circle.append(title);
        svg.append(circle);
    }

    const meta = document.createElement('p');
    meta.className = 'graph-meta';
    meta.textContent = `${points.length} nodes · ${edges.length} edges`;

    container.append(svg, meta);

    // Trigger the edge-draw transition after nodes pop in (CSS handles reduced-motion)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            for (const line of svg.querySelectorAll('.graph-edge')) {
                line.style.strokeDashoffset = '0';
            }
        });
    });
}

function emptyState(message = 'No graph output returned for this path.') {
    const note = document.createElement('p');
    note.className = 'graph-empty';
    note.textContent = message;
    return note;
}

function emptyStateWithDetails(message, details = '') {
    const wrapper = document.createElement('div');
    wrapper.className = 'graph-empty';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.gap = '0.5rem';
    wrapper.style.textAlign = 'center';
    wrapper.style.padding = '1.5rem';

    const note = document.createElement('p');
    note.textContent = message;
    note.style.margin = '0';
    note.style.fontSize = '0.875rem';
    note.style.color = 'var(--ink-mute)';

    wrapper.append(note);

    if (details) {
        const detail = document.createElement('p');
        detail.textContent = details;
        detail.style.margin = '0';
        detail.style.fontSize = '0.75rem';
        detail.style.color = 'var(--ink-mute)';
        detail.style.fontFamily = 'var(--font-mono)';
        wrapper.append(detail);
    }

    return wrapper;
}