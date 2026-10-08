/**
 * Segmented control that switches the demo between the predefined-case
 * panel and the custom C++ pair panel.
 */
export function initModeTabs({ tabCase, tabCustom, panelCase, panelCustom, onChange }) {
    const entries = [
        { tab: tabCase, panel: panelCase, mode: 'case' },
        { tab: tabCustom, panel: panelCustom, mode: 'custom' },
    ];

    function activate(mode) {
        for (const { tab, panel } of entries) {
            const active = tab.dataset.mode === mode;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
            tab.setAttribute('aria-controls', panel.id);
            panel.hidden = !active;
        }
        onChange?.(mode);
    }

    for (const entry of entries) {
        entry.tab.dataset.mode = entry.mode;
        entry.tab.setAttribute('role', 'tab');
        entry.tab.setAttribute('aria-controls', entry.panel.id);
        entry.panel.setAttribute('role', 'tabpanel');
        entry.panel.setAttribute('aria-labelledby', entry.tab.id);
        entry.tab.addEventListener('click', () => activate(entry.mode));
    }

    // Keyboard navigation for tabs
    const tabs = entries.map(e => e.tab);
    tabs.forEach((tab, index) => {
        tab.addEventListener('keydown', (e) => {
            let newIndex = index;
            if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
            else if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabs.length) % tabs.length;
            else if (e.key === 'Home') newIndex = 0;
            else if (e.key === 'End') newIndex = tabs.length - 1;
            else return;
            
            e.preventDefault();
            tabs[newIndex].focus();
            activate(tabs[newIndex].dataset.mode);
        });
    });

    return { activate };
}