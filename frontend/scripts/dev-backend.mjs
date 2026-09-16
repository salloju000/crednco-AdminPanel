// Starts the FastAPI backend alongside the Vite dev server (see `npm run dev`).
// Prefers the project virtualenv in backend/.venv, falling back to whatever
// python is on PATH.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const backendDir = path.join(root, 'backend')
const isWindows = process.platform === 'win32'
const host = '127.0.0.1'
const port = process.env.BACKEND_PORT ?? '8001'

const portIsFree = () =>
  new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.once('listening', () => probe.close(() => resolve(true)))
    probe.listen(Number(port), host)
  })

// A backend started outside this script (another terminal, Docker) already
// serves the frontend fine — leave it alone rather than failing the dev run.
if (!(await portIsFree())) {
  console.log(`[backend] something is already listening on ${host}:${port}, not starting a second one`)
  process.exit(0)
}

const venvPython = isWindows
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python')

const python = existsSync(venvPython) ? venvPython : isWindows ? 'python' : 'python3'

if (!existsSync(venvPython)) {
  console.warn(`[backend] ${venvPython} not found, falling back to "${python}" on PATH`)
}

const child = spawn(
  python,
  ['-m', 'uvicorn', 'main:app', '--host', host, '--port', port, '--reload'],
  { cwd: backendDir, stdio: 'inherit' },
)

child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
