// Test button to verify error boundary is working (no external services)
export function SentryTestButton() {
  return (
    <button
      onClick={() => {
        throw new Error('This is a test error!');
      }}
      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-foreground rounded-lg transition-colors"
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
        console.log('Test error event (no Sentry):', new Date().toISOString());
        alert('Test error logged to console!');
      }}
      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-foreground rounded-lg transition-colors"
    >
      Send Test
    </button>
  );
}

