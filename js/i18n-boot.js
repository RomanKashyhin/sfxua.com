// Starts the language layer on its own, before the main script: main.js waits for heavier modules
// (three.js for the microphone), and a remembered Ukrainian must not wait for them.
import { initI18n } from './i18n.js';

initI18n();
