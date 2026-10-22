import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobile = path.join(root, 'mobile');
const env = { ...process.env };
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path');
const inheritedPath = pathKey ? env[pathKey] : '';
if (pathKey) delete env[pathKey];
env.PATH = [path.dirname(process.execPath), inheritedPath].join(path.delimiter);
if (process.platform === 'win32') {
  const sdk = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, path.join(homedir(), 'AppData', 'Local', 'Android', 'Sdk')].find(p => p && existsSync(path.join(p, 'platform-tools', 'adb.exe')));
  const java = [env.JAVA_HOME, path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr')].find(p => p && existsSync(path.join(p, 'bin', 'java.exe')));
  if (sdk) {
    env.ANDROID_HOME = sdk;
    env.ANDROID_SDK_ROOT = sdk;
    env.PATH = [path.join(sdk, 'platform-tools'), path.join(sdk, 'emulator'), env.PATH].join(path.delimiter);
  }
  if (java) {
    env.JAVA_HOME = java;
    env.PATH = [path.join(java, 'bin'), env.PATH].join(path.delimiter);
  }
}
const require = createRequire(path.join(mobile, 'package.json'));
let expo;
try { expo = require.resolve('expo/bin/cli'); }
catch { console.error('Najpierw zainstaluj zależności: npm --prefix mobile install'); process.exit(1); }
const child = spawn(process.execPath, [expo, 'run:android', ...process.argv.slice(2)], { cwd: mobile, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
