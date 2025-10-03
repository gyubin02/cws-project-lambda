// Test setup file
import 'dotenv/config';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MOCK = '1';
process.env.PORT = '0'; // Use random port for tests
