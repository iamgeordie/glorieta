import { render } from 'preact';
import { App } from './App';
import { initAuth } from './lib/auth';
import './styles.css';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element in index.html');
initAuth();
render(<App />, root);
