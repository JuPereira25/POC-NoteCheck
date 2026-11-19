# POC NoteCheck

Aplicação de bancada para acompanhar a montagem de um notebook. O operador lê a serial do kit, a tela mostra as etapas daquele produto e registra o resultado de cada camada, com cronômetro e o estado da câmera de inspeção.

A interface se chama **MONTAGEM** e abre em uma janela no Windows.

## Como funciona

1. O operador lê ou digita a serial no campo de barcode e confirma com Enter.
2. O backend consulta o PostgreSQL e devolve os produtos daquele kit. Cada produto vira uma etapa, em letras maiúsculas.
3. As etapas aparecem em duas camadas de três: camada 1 (etapas 1 a 3) e camada 2 (etapas 4 a 6).
4. Um sinal na porta serial (`Trigger`) pede à câmera, via TCP, o resultado do lote atual. Cada item volta como OK ou NOK.
5. Se a camada falha, a tela pede para refazer a sequência. Se as duas camadas passam, a montagem é concluída.

Enquanto isso, a tela mostra o tempo total, o tempo de cada camada, o último comando enviado à câmera e se ela está conectada.

A serial `123456789` é um mock local: não consulta o banco e preenche só a primeira etapa, com o nome `HD`.

## Estrutura

- `frontend` — interface em React, TypeScript e Vite.
- `backend` — API em ASP.NET Core (.NET 10). Consulta kits no PostgreSQL, fala com a câmera por TCP e escuta a porta serial.
- `electron` — abre o frontend em uma janela e, no instalador, embute o backend.

## Pré-requisitos

- Node.js
- .NET 10 SDK
- PostgreSQL com as tabelas `produto` e `kit`
- Câmera acessível por TCP e, para o fluxo completo, a porta serial configurada

## Configuração

Edite `backend/appsettings.json` antes de subir a API.

- `ConnectionStrings:PostgreSql` — servidor, banco, usuário e senha. O valor publicado usa `Password=CHANGE_ME`; troque pela senha real.
- `Tcp` — endereço e porta da câmera, além dos tempos de conexão e de comando.
- `Serial` — nome da porta (por exemplo `COM3`) e a velocidade em baud.

O banco precisa ter:

- `produto`: `id`, `nome`, `qtd`, `status`, `qrcode`, `criado_em`
- `kit`: `id`, `serial_kit`, `produto_id`, `criado_em`

Vários registros de `kit` com a mesma `serial_kit` formam a lista de etapas, na ordem de criação.

## Executar em desenvolvimento

Em um terminal, suba a API:

```powershell
cd backend
dotnet run --launch-profile http
```

A API fica em `http://localhost:5272`.

Em outro terminal, abra a janela:

```powershell
cd electron
npm install
npm start
```

Esse comando compila o processo do Electron, inicia o Vite em `http://127.0.0.1:5173` e abre a janela quando a página responde. Em desenvolvimento a janela não inicia o backend; os dois processos precisam estar no ar.

Para usar só o navegador, na pasta `frontend`:

```powershell
npm install
npm run dev
```

## API

- `GET /api/kits/{serial}` — etapas e produtos do kit. Responde 404 quando a serial não existe.
- `GET /api/tcp/status` — câmera conectada, último comando, última resposta e o lote de inspeção.
- `POST /api/tcp/connect` e `POST /api/tcp/disconnect` — abre ou fecha a conexão TCP.
- `POST /api/tcp/reset` — envia o reset da câmera e limpa o estado da inspeção.
- `POST /api/tcp/commands` — envia um comando de texto para a câmera. Corpo: `{ "command": "..." }`.

## Instalador Windows

```powershell
cd electron
npm install
npm run dist
```

O instalador sai em `electron/dist`. Ele leva o Electron, o frontend compilado e o backend autocontido. O computador de destino não precisa de Node.js nem do SDK do .NET.
