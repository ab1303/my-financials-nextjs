#!/usr/bin/env tsx

import { execSync } from 'child_process';

async function checkMCPHealth() {
  try {
    console.log('🔍 Checking MCP setup with official image...');

    // Check if the official image exists locally
    try {
      const images = execSync(
        'docker images mcp/postgres --format "{{.Repository}}:{{.Tag}}"',
        { encoding: 'utf8' }
      );
      if (images.includes('mcp/postgres')) {
        console.log('✅ Official MCP PostgreSQL image found locally');
      }
    } catch {
      console.log(
        '⚠️  Official MCP image not found locally, run: npm run mcp:pull'
      );
    }

    // Check if containers are running
    const psOutput = execSync('docker-compose ps mcp-postgres --format json', {
      encoding: 'utf8',
    });
    const containerInfo = JSON.parse(psOutput);

    if (containerInfo.State === 'running') {
      console.log('✅ MCP PostgreSQL server container is running');
    } else {
      throw new Error(`MCP container state: ${containerInfo.State}`);
    }

    // Test MCP server endpoint
    try {
      execSync('curl -f http://localhost:3001 -m 5', { stdio: 'pipe' });
      console.log('✅ MCP server is responding on port 3001');
    } catch {
      console.log(
        '⚠️  MCP server not responding (this may be normal depending on the image)'
      );
    }

    console.log('🎉 MCP health check complete!');
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('💡 Try running: npm run mcp:logs');
    process.exit(1);
  }
}

if (require.main === module) {
  checkMCPHealth();
}
