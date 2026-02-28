async function globalTeardown() {
  console.log('🧹 Running global teardown...');
  // Optional: Add cleanup logic if needed
  // For now, keep test data for manual inspection
  console.log('✅ Teardown complete');
}

export default globalTeardown;
