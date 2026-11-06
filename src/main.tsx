import { render } from 'preact';
import { App } from './App';
import { initAuth } from './lib/auth';
import { applyTvMode } from './lib/tv';
import './styles.css';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element in index.html');
applyTvMode();
initAuth();
render(<App />, root);
