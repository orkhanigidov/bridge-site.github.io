import { RUNNER } from './config/site.js';
import { createRunnerClient } from './api/runnerClient.js';
import { initDemo } from './ui/demo.js';
import { initContent } from './ui/content.js';
import { initCopyButtons } from './ui/clipboard.js';
import { initScrollReveal } from './ui/animations.js';

const client = createRunnerClient(RUNNER);
initDemo(document, client, RUNNER);
initContent({
    linksList: document.querySelector('#links-list'),
    bibtexCode: document.querySelector('#bibtex-code'),
});
initCopyButtons();
initScrollReveal(document);