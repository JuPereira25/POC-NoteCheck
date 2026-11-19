const { spawn } = require("node:child_process")

const electronPath = require("electron")
const environment = { ...process.env }

// Alguns terminais de automação definem esta variável, fazendo o executável do
// Electron se comportar como Node e encerrar sem criar uma janela.
delete environment.ELECTRON_RUN_AS_NODE

const electron = spawn(electronPath, ["."], {
  cwd: __dirname,
  env: environment,
  stdio: "inherit"
})

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => electron.kill(signal))
}

electron.on("exit", (code) => process.exit(code ?? 0))
