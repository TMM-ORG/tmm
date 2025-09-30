import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.REDDIT_CLIENT_ID = 'test_client_id'
process.env.REDDIT_CLIENT_SECRET = 'test_client_secret'
process.env.REDDIT_USER_AGENT = 'test_app:1.0.0 (by /u/testuser)'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key'

// Create a more robust fetch mock
const mockResponse = (data, options = {}) => {
  const { ok = true, status = 200, statusText = 'OK' } = options;
  return Promise.resolve({
    ok,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
    url: '',
    type: 'basic',
    redirected: false,
    bodyUsed: false,
    body: null,
    clone: () => mockResponse(data, options),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
  });
};

// Set up a default fetch mock that can be overridden in tests
global.fetch = jest.fn(() => mockResponse({}));

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});