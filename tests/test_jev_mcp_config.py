"""Offline checks for the local Jev MCP wiring; never reads or prints secrets."""
from pathlib import Path
import json
import subprocess
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]


class JevMcpConfigTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = tomllib.loads((ROOT / '.codex/config.toml').read_text(encoding='utf-8'))
        cls.launcher = ROOT / 'scripts/jev_mcp_launcher.swift'
        cls.integration = (ROOT / 'skills/danta-proposal-guide/references/jev-search-integration.md').read_text(encoding='utf-8')

    def test_project_mcp_uses_keychain_launcher(self):
        server = self.config['mcp_servers']['jev']
        self.assertEqual(server['command'], '/usr/bin/swift')
        self.assertEqual(server['args'], ['scripts/jev_mcp_launcher.swift', 'run'])
        self.assertNotIn('env', server)
        project_files = json.loads((ROOT / 'project-files.json').read_text(encoding='utf-8'))['files']
        self.assertIn('scripts/jev_mcp_launcher.swift', project_files)
        self.assertIn('SecItemCopyMatching', self.launcher.read_text(encoding='utf-8'))
        self.assertIn('SecItemAdd', self.launcher.read_text(encoding='utf-8'))

    def test_launcher_keychain_check_never_reveals_a_secret(self):
        result = subprocess.run(
            ['/usr/bin/swift', str(self.launcher), 'check'],
            capture_output=True, text=True, timeout=60,
        )
        self.assertIn(result.returncode, (0, 2))
        self.assertIn('Keychain', result.stdout + result.stderr)
        self.assertNotIn('apikey_', result.stdout + result.stderr)
        self.assertNotIn('ts_', result.stdout + result.stderr)

    def test_usage_documents_secure_setup_and_public_data_boundary(self):
        self.assertIn('swift scripts/jev_mcp_launcher.swift setup', self.integration)
        self.assertIn('钥匙串', self.integration)
        self.assertIn('患者资料', self.integration)
        self.assertIn('Node.js 22+', self.integration)


if __name__ == '__main__':
    unittest.main()
