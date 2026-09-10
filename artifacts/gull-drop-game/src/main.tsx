import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { trackVisit } from '@/game/analytics';
import { ClerkProvider } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';

import './index.css';

trackVisit();

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <ClerkProvider
      publishableKey={publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)}
      proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}
      appearance={{
        theme: dark,
        variables: { colorPrimary: "#5eb7ae", colorBackground: "#132028", colorForeground: "#f0ece4", fontFamily: "Outfit, system-ui, sans-serif" },
      }}
      localization={{ signIn: { start: { title: "Return to the boardwalk" } }, signUp: { start: { title: "Join the gull family" } } }}
    >
      <App />
    </ClerkProvider>
  </ErrorBoundary>,
);
