import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import MissingClerkKey from './components/MissingClerkKey';

const publishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '')
  .trim()
  .replace(/\$$/, '');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

if (!publishableKey) {
  root.render(
    <React.StrictMode>
      <MissingClerkKey />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App publishableKey={publishableKey} />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
