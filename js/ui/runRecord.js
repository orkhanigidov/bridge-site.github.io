/**
 * Collapsible run record: logs what was submitted and how the runner answered,
 * and prints the exact curl commands to repeat the run — the demo's link from
 * the interactive result back to local reproduction.
 */
export function createRunRecord({ toggle, body, hint }) {
    const lines = [];
    let started = false;

    function render() {
        body.textContent = lines.map(({ text }) => text).join('\n');
    }

    toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        body.hidden = open;
    });

    return {
        begin(baseUrl, payload) {
            started = true;
            lines.length = 0;
            hint.hidden = false;
            this.line(`${new Date().toISOString()} — job submitted`, 'muted');
            this.line(`mode: ${payload.mode}${payload.caseId ? ` · caseId: ${payload.caseId}` : ''}`);
            if (payload.params) {
                this.line(`params: ${JSON.stringify(payload.params)}`);
            }
            this.curl(baseUrl, payload, null);
            render();
        },

        line(text, cls = '') {
            lines.push({ text, cls });
            if (started) render();
        },

        finish(jobId, status, waitedS) {
            this.line(`${jobId} finished as ${status} · waited ${waitedS.toFixed(1)} s`);
            render();
        },

        fail(message) {
            this.line(message, 'error');
            render();
        },

        curl(baseUrl, payload, jobId) {
            lines.push({ text: 'reproduce with curl:', cls: 'muted' });
            // Escape single quotes in JSON for shell safety
            const escapedPayload = JSON.stringify(payload).replace(/'/g, "'\\''");
            lines.push({
                text: `curl -X POST ${baseUrl}/jobs -H 'Content-Type: application/json' -H 'Authorization: Bearer <api-secret-key>' -d '${escapedPayload}'`,
                cls: '',
            });
            if (jobId) {
                lines.push({ text: `curl ${baseUrl}/jobs/${jobId} -H 'Authorization: Bearer <api-secret-key>'   # poll until succeeded`, cls: '' });
            }
            if (started) render();
        },
    };
}