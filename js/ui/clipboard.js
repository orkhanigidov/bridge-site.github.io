/**
 * Copy-to-clipboard for every [data-copy] button, using event delegation so
 * dynamically created blocks (e.g. curl snippets in the run record) work too.
 * A button must live inside a [data-copy-scope] containing a `pre code` element.
 * Falls back to document.execCommand for older browsers.
 */
export function initCopyButtons() {
    document.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-copy]');
        if (!button) return;
        const scope = button.closest('[data-copy-scope]');
        const code = scope?.querySelector('pre code');
        if (!code) return;

        const label = button.querySelector('[data-copy-label]');
        const original = label?.textContent || 'Copy';
        const text = code.textContent;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers or non-secure contexts
                await fallbackCopy(text);
            }
            if (label) label.textContent = 'Copied';
        } catch {
            if (label) label.textContent = 'Copy failed';
        } finally {
            setTimeout(() => { if (label) label.textContent = original; }, 1600);
        }
    });
}

async function fallbackCopy(text) {
    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                resolve();
            } else {
                reject(new Error('execCommand copy failed'));
            }
        } catch (err) {
            reject(err);
        } finally {
            document.body.removeChild(textarea);
        }
    });
}