#!/usr/bin/env tsx

import { execSync } from 'child_process';

function runMCPServer() {
  const dockerCommand = `
    docker run -d \\
      --name mcp-postgres-server \\
      --network my-financials-nextjs_financials-network \\
      -p 3001:3001 \\
      -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/financials \\
      mcp/postgres:latest
  `
    .replace(/\s+/g, ' ')
    .trim();

  try {
    console.log('🐳 Starting MCP PostgreSQL server with Docker...');
    execSync(dockerCommand, { stdio: 'inherit' });
    console.log('✅ MCP server started successfully');
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    throw error;
  }
}

function stopMCPServer() {
  try {
    execSync(
      'docker stop mcp-postgres-server && docker rm mcp-postgres-server',
      { stdio: 'inherit' }
    );
    console.log('✅ MCP server stopped and removed');
  } catch (error) {
    console.log('⚠️  MCP server was not running or already removed');
  }
}

const command = process.argv[2];

switch (command) {
  case 'start':
    runMCPServer();
    break;
  case 'stop':
    stopMCPServer();
    break;
  case 'restart':
    stopMCPServer();
    runMCPServer();
    break;
  default:
    console.log('Usage: tsx mcp-docker-run.ts [start|stop|restart]');
}
