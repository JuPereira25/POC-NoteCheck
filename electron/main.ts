import { app, BrowserWindow, dialog } from "electron"
import { spawn, type ChildProcess } from "child_process"
import path from "path"

const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5173"
const BACKEND_PORT = 5272

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null

function appIconPath(): string {
  return path.join(__dirname, "assets", "favicon.ico")
}

function backendExePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "backend", "backend.exe")
    : path.join(__dirname, "resources", "backend", "backend.exe")
}

function frontendIndexPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "frontend", "index.html")
    : path.join(__dirname, "resources", "frontend", "index.html")
}

function startBackend(): void {
  const exePath = backendExePath()
  backendProcess = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    env: {
      ...process.env,
      ASPNETCORE_URLS: `http://127.0.0.1:${BACKEND_PORT}`,
      ASPNETCORE_ENVIRONMENT: "Production",
    },
    windowsHide: true,
  })

  backendProcess.on("error", (error) => {
    console.error("Falha ao iniciar o backend:", error)
    dialog.showErrorBox("MONTAGEM", "Nao foi possivel iniciar o servico da aplicacao.")
  })
}

function stopBackend(): void {
  if (!backendProcess || backendProcess.killed) return
  if (process.platform === "win32" && backendProcess.pid) {
    spawn("taskkill", ["/pid", String(backendProcess.pid), "/f", "/t"], { windowsHide: true })
  } else {
    backendProcess.kill()
  }
  backendProcess = null
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1200,
    minHeight: 600,
    show: false,
    title: "MONTAGEM",
    icon: appIconPath(),
    backgroundColor: "#f5f5f5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (app.isPackaged) void mainWindow.loadFile(frontendIndexPath())
  else void mainWindow.loadURL(FRONTEND_URL)

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show()
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.notecheck.montagem")
  }

  if (app.isPackaged) {
    startBackend()
    setTimeout(createWindow, 1500)
  } else {
    createWindow()
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  stopBackend()
  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", stopBackend)
