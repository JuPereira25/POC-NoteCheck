# Electron

Em desenvolvimento, esta pasta abre o frontend React/Vite em uma janela Electron.

## Executar em desenvolvimento

```powershell
cd electron
npm install
npm start
```

O comando `npm start` compila o processo principal, inicia o Vite na porta 5173
e abre a janela quando o frontend estiver disponivel.

## Gerar o instalador Windows

```powershell
cd electron
npm install
npm run dist
```

O instalador sera criado em `electron/dist`. Ele inclui o Electron, o frontend
compilado e o backend .NET autocontido; o computador de destino nao precisa ter
Node.js, Electron ou .NET instalados.
