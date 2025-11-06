import * as Sentry from '@sentry/react';

// Test button to verify Sentry error tracking is working
export function SentryTestButton() {
  return (
    <button
      onClick={() => {
        throw new Error('This is your first error!');
      }}
      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
    >
      Break the world
    </button>
  );
}

// Alternative: Test with captured exception instead of throwing
export function SentryCaptureTestButton() {
  return (
    <button
      onClick={() => {
        Sentry.captureException(new Error('Test error from Sentry capture'));
        Sentry.captureMessage('Test message to Sentry', 'info');
        alert('Test error sent to Sentry!');
      }}
      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
    >
      Send Test to Sentry
    </button>
  );
}

