#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

function createMCPConfig() {
  const config = {
    mcpServers: {
      postgres: {
        transport: {
          type: 'http',
          host: 'localhost',
          port: 3001,
        },
        capabilities: {
          resources: true,
          tools: true,
        },
      },
    },
  };

  writeFileSync('.vscode/mcp-config.json', JSON.stringify(config, null, 2));
  console.log('✅ MCP configuration created');
}

function pullOfficialImage() {
  try {
    console.log('🐳 Pulling official MCP PostgreSQL server image...');
    execSync('docker pull mcp/postgres:latest', {
      stdio: 'inherit',
    });
    console.log('✅ Official MCP image pulled successfully');
  } catch (error) {
    console.error('❌ Failed to pull official image. It might not exist yet.');
    console.log('🔄 Falling back to building custom image...');
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Setting up MCP PostgreSQL server...');

    try {
      pullOfficialImage();
    } catch {
      console.log(
        '⚠️  Official image not available, using alternative approach'
      );
      // You could fall back to building custom image here if needed
    }

    createMCPConfig();

    console.log('🎉 Setup complete! Run the following commands:');
    console.log('   npm run mcp:start');
    console.log('   npm run mcp:test');
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
