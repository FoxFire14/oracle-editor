import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

function findJar(): string {
  if (is.dev) {
    // In dev, look for the built jar in backend/target
    const devPath = join(app.getAppPath(), '../backend/target/oracle-editor-backend-1.0.0.jar')
    if (existsSync(devPath)) return devPath
    throw new Error(`Backend JAR not found at ${devPath}. Run: cd backend && mvn package`)
  }
  // In production, jar is bundled as extraResource
  return join(process.resourcesPath, 'backend.jar')
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const net = require('net')
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

export class JavaProcess {
  private process: ChildProcess | null = null

  async start(): Promise<number> {
    const jarPath = findJar()
    const port = await findFreePort()

    return new Promise((resolve, reject) => {
      this.process = spawn('java', ['-jar', jarPath, String(port)], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      const timeout = setTimeout(() => {
        reject(new Error('Java backend startup timed out'))
      }, 15_000)

      this.process.stdout?.on('data', (data: Buffer) => {
        const line = data.toString()
        if (line.includes('ORACLE_EDITOR_PORT=')) {
          clearTimeout(timeout)
          resolve(port)
        }
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        console.error('[java]', data.toString())
      })

      this.process.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      this.process.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error('Java process exited with code', code)
        }
      })
    })
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM')
      this.process = null
    }
  }
}
