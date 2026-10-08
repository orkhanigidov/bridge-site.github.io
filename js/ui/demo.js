/**
 * Demo state machine: submit a job to the runner, poll until it finishes,
 * then display the graph data the runner returned.
 */
import { CHECKS, STAGES, PARAMS } from '../config/site.js';
import { renderGraph } from '../render/graphView.js';
import { initModeTabs } from './modeTabs.js';
import { initCodeTabs } from './codeTabs.js';
import { createRunRecord } from './runRecord.js';

export function initDemo(root, client, config) {
    const els = {
        runnerUrl: root.querySelector('#runner-url'),
        loadCases: root.querySelector('#load-cases'),
        caseSelect: root.querySelector('#case-select'),
        nodes: root.querySelector('#nodes'),
        nodesVal: root.querySelector('#nodes-val'),
        seedDec: root.querySelector('#seed-dec'),
        seedInc: root.querySelector('#seed-inc'),
        seedVal: root.querySelector('#seed-val'),
        seedRand: root.querySelector('#seed-rand'),
        runCase: root.querySelector('#run-case'),
        runCustom: root.querySelector('#run-custom'),
        sourceDirect: root.querySelector('#source-direct'),
        sourceBridge: root.querySelector('#source-bridge'),
        fileDirect: root.querySelector('#file-direct'),
        fileBridge: root.querySelector('#file-bridge'),
        statusMessage: root.querySelector('#status-message'),
        statusJob: root.querySelector('#status-job'),
        graphDirect: root.querySelector('#graph-direct'),
        graphBridge: root.querySelector('#graph-bridge'),
        checksList: root.querySelector('#checks-list'),
        stagesList: root.querySelector('#stages-list'),
        stagesSummary: root.querySelector('#stages-summary'),
        record: createRunRecord({
            toggle: root.querySelector('#record-toggle'),
            body: root.querySelector('#record-body'),
            hint: root.querySelector('#record-hint'),
        }),
    };

    const codeTabs = initCodeTabs({
        tabDirect: root.querySelector('#tab-cxx'),
        tabBridge: root.querySelector('#tab-lua'),
        codeView: root.querySelector('#code-view'),
    });

    const state = { mode: 'case', busy: false, caseId: '', cases: new Map(), startedAt: 0 };

    if (config.defaultApiKey) els.runnerUrl.value = config.defaultApiKey;

    /* ---------- static panels ---------- */

    for (const check of CHECKS) {
        const row = document.createElement('div');
        row.className = 'check-row';
        const marker = document.createElement('span');
        marker.className = 'check-marker';
        const text = document.createElement('span');
        text.textContent = check;
        row.append(marker, text);
        els.checksList.append(row);
    }

    const stageRows = new Map();
    for (const stage of STAGES) {
        const row = document.createElement('div');
        row.className = 'check-row stage-row is-pending';
        const marker = document.createElement('span');
        marker.className = 'check-marker';
        const text = document.createElement('span');
        text.textContent = stage.label;
        row.append(marker, text);
        els.stagesList.append(row);
        stageRows.set(stage.id, row);
    }

    function renderStages(seen, failed) {
        const order = STAGES.map((stage) => stage.id);
        const failedIdx = failed ? order.indexOf(failed) : -1;
        // Find the first stage in order that hasn't been seen yet (the active one)
        let activeIdx = -1;
        for (let i = 0; i < order.length; i++) {
            if (!seen.has(order[i])) {
                activeIdx = i;
                break;
            }
        }
        for (const [id, row] of stageRows) {
            const idx = order.indexOf(id);
            row.classList.remove('is-pending', 'is-active', 'is-done', 'is-failed');
            if (failedIdx >= 0 && idx === failedIdx) row.classList.add('is-failed');
            else if (seen.has(id)) row.classList.add('is-done');
            else if (idx === activeIdx && !failed) row.classList.add('is-active');
            else row.classList.add('is-pending');
        }
    }

    /* ---------- status, busy state, params ---------- */

    const setStatus = (message, jobState = '') => {
        els.statusMessage.textContent = message;
        els.statusJob.hidden = !jobState;
        els.statusJob.textContent = jobState;
    };

    const setBusy = (busy) => {
        state.busy = busy;
        els.loadCases.disabled = busy;
        els.runCustom.disabled = busy;
        els.runCase.disabled = busy || !state.caseId;
        els.runCase.textContent = busy ? 'Executing script…' : 'Execute comparison';
        els.runCustom.textContent = busy ? 'Executing script…' : 'Execute script';
    };

    const currentParams = () => ({
        layerDistance: Number(els.nodes.value),
        nodeDistance: Number(els.seedVal.textContent),
    });

    function syncParamLabels() {
        els.nodesVal.textContent = els.nodes.value;
    }

    els.nodes.addEventListener('input', syncParamLabels);
    els.seedDec.addEventListener('click', () => {
        const newVal = Math.max(PARAMS.nodeDistance.min, Number(els.seedVal.textContent) - 1);
        els.seedVal.textContent = String(newVal);
        els.seedVal.setAttribute('aria-valuenow', String(newVal));
    });
    els.seedInc.addEventListener('click', () => {
        const newVal = Math.min(PARAMS.nodeDistance.max, Number(els.seedVal.textContent) + 1);
        els.seedVal.textContent = String(newVal);
        els.seedVal.setAttribute('aria-valuenow', String(newVal));
    });

    // Keyboard support for node distance value
    els.seedVal.addEventListener('keydown', (e) => {
        let newVal = Number(els.seedVal.textContent);
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            newVal = Math.min(PARAMS.nodeDistance.max, newVal + 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            newVal = Math.max(PARAMS.nodeDistance.min, newVal - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            newVal = PARAMS.nodeDistance.min;
        } else if (e.key === 'End') {
            e.preventDefault();
            newVal = PARAMS.nodeDistance.max;
        } else {
            return;
        }
        els.seedVal.textContent = String(newVal);
        els.seedVal.setAttribute('aria-valuenow', String(newVal));
    });
    syncParamLabels();

    /* ---------- case loading ---------- */

    function showCaseSources(testCase) {
        codeTabs.setSource('direct', testCase?.directSource || '');
        codeTabs.setSource('bridge', testCase?.bridgeSource || '');
    }

    async function loadCases() {
        try {
            setBusy(true);
            setStatus('Loading scripts from the Engine…');
            const cases = await client.loadCases(els.runnerUrl.value);

            els.caseSelect.textContent = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = cases.length ? 'Choose a script' : 'Engine is connected, but returned no scripts';
            els.caseSelect.append(placeholder);
            state.cases = new Map(cases.map((testCase) => [testCase.id, testCase]));
            for (const testCase of cases) {
                const option = document.createElement('option');
                option.value = testCase.id;
                option.textContent = testCase.name || testCase.id;
                els.caseSelect.append(option);
            }

            state.caseId = cases[0]?.id || '';
            els.caseSelect.value = state.caseId;
            showCaseSources(state.cases.get(state.caseId));
            setBusy(false);
            setStatus(cases.length ? 'Scripts loaded from the Engine.' : 'Engine is connected, but no scripts were returned.');
        } catch (error) {
            setBusy(false);
            setStatus(`Could not load cases: ${error.message}`);
        }
    }

    els.loadCases.addEventListener('click', () => loadCases());
    els.caseSelect.addEventListener('change', () => {
        state.caseId = els.caseSelect.value;
        els.runCase.disabled = state.busy || !state.caseId;
        showCaseSources(state.cases.get(state.caseId));
    });

    /* ---------- running ---------- */

    async function run() {
        const apiKey = els.runnerUrl.value;
        if (state.mode === 'case' && !state.caseId) {
            setStatus('Load and choose a Lua script before running.');
            return;
        }
        if (state.mode === 'custom' && (!els.sourceDirect.value.trim() || !els.sourceBridge.value.trim())) {
            setStatus('Add the Lua scripts for both execution modes to compare.');
            return;
        }

        const payload = state.mode === 'case'
            ? { mode: 'case', caseId: state.caseId, params: currentParams() }
            : { mode: 'custom', directSource: els.sourceDirect.value, bridgeSource: els.sourceBridge.value };

        try {
            setBusy(true);
            state.startedAt = Date.now();
            renderGraph(els.graphDirect, null);
            renderGraph(els.graphBridge, null);
            els.stagesSummary.hidden = true;
            renderStages(new Set(['queued']), null);

            els.record.begin('engine', payload);
            setStatus('Sending script to the Engine…', 'queued');

            const seen = new Set(['queued']);
            const result = await client.runJob(apiKey, payload, (job) => {
                const status = job.status || 'running';
                const stage = job.stage && STAGES.some((entry) => entry.id === job.stage) ? job.stage : (status === 'running' ? 'running' : null);
                if (stage && !seen.has(stage)) {
                    seen.add(stage);
                    els.record.line(`runner reports: ${status}${stage && stage !== status ? ` (${stage})` : ''}`, 'muted');
                }
                renderStages(seen, null);
                setStatus(
                    status === 'running' ? 'The Engine is executing the Lua script…' : 'Connecting to the Engine…',
                    stage || status,
                );
            });

            renderStages(STAGES.map((stage) => stage.id).reduce((set, id) => set.add(id), new Set()), null);
            els.stagesSummary.hidden = false;
            els.stagesSummary.textContent = `${payload.mode === 'case' ? payload.caseId : 'network script'} · succeeded`;
            renderGraph(els.graphDirect, result.directGraph);
            renderGraph(els.graphBridge, result.bridgeGraph);
            const waitedS = (Date.now() - state.startedAt) / 1000;
            els.record.finish(result.jobId, 'succeeded', waitedS);
            setStatus('Completed. Showing graph data returned by the Engine.', 'succeeded');
        } catch (error) {
            els.record.fail(error.message);
            renderStages(new Set(), 'running');
            els.stagesSummary.hidden = false;
            els.stagesSummary.textContent = 'failed';
            setStatus(error.message, 'error');
        } finally {
            setBusy(false);
        }
    }

    els.runCase.addEventListener('click', () => run());
    els.runCustom.addEventListener('click', () => run());

    /* ---------- custom sources ---------- */

    function bindFileSource(input, textarea, path) {
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (file) {
                textarea.value = await file.text();
                if (state.mode === 'custom') codeTabs.setSource(path, textarea.value);
            }
            input.value = '';
        });
    }

    els.sourceDirect.addEventListener('input', () => {
        if (state.mode === 'custom') codeTabs.setSource('direct', els.sourceDirect.value);
    });
    els.sourceBridge.addEventListener('input', () => {
        if (state.mode === 'custom') codeTabs.setSource('bridge', els.sourceBridge.value);
    });
    bindFileSource(els.fileDirect, els.sourceDirect, 'direct');
    bindFileSource(els.fileBridge, els.sourceBridge, 'bridge');

    initModeTabs({
        tabCase: root.querySelector('#tab-case'),
        tabCustom: root.querySelector('#tab-custom'),
        panelCase: root.querySelector('#panel-case'),
        panelCustom: root.querySelector('#panel-custom'),
        onChange: (mode) => {
            state.mode = mode;
            if (mode === 'custom') {
                codeTabs.setSource('direct', els.sourceDirect.value);
                codeTabs.setSource('bridge', els.sourceBridge.value);
            } else {
                showCaseSources(state.cases.get(state.caseId));
            }
        },
    });

    renderGraph(els.graphDirect, null);
    renderGraph(els.graphBridge, null);
}