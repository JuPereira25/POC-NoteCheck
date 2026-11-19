using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Options;

namespace backend.Infrastructure.Tcp;

/// <summary>
/// Mantém a conexão TCP com a câmera e permite enviar comandos no protocolo Keyence.
/// O protocolo utiliza texto ASCII e finaliza cada comando com o caractere CR (\r).
/// </summary>
public sealed class TcpConnection : IHostedService, IAsyncDisposable
{
    private readonly TcpOptions _options;
    private readonly ILogger<TcpConnection> _logger;

    // Impede duas tentativas de conexão ou dois comandos simultâneos no mesmo socket.
    private readonly SemaphoreSlim _connectionLock = new(1, 1);
    private readonly SemaphoreSlim _commandLock = new(1, 1);

    private CancellationTokenSource? _reconnectCancellation;
    private Task? _reconnectTask;
    private TcpClient? _client;
    private string? _lastCommandSent;
    private string? _lastResponseReceived;

    public TcpConnection(IOptions<TcpOptions> options, ILogger<TcpConnection> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    /// <summary>Informa se o socket continua conectado ao equipamento.</summary>
    public bool IsConnected
    {
        get
        {
            var client = _client;
            if (client is not { Connected: true })
                return false;

            try
            {
                // Um socket legível sem bytes disponíveis indica que o outro lado encerrou a conexão.
                return !(client.Client.Poll(0, SelectMode.SelectRead) && client.Available == 0);
            }
            catch (SocketException)
            {
                return false;
            }
            catch (ObjectDisposedException)
            {
                return false;
            }
        }
    }

    /// <summary>Último comando enviado pelo socket TCP.</summary>
    public string? LastCommandSent => _lastCommandSent;

    /// <summary>Última resposta recebida pelo socket TCP.</summary>
    public string? LastResponseReceived => _lastResponseReceived;

    /// <summary>Registra um comando enviado para disponibilizá-lo no log e na interface.</summary>
    internal void RegisterCommandSent(string command)
    {
        Interlocked.Exchange(ref _lastCommandSent, command);
        _logger.LogInformation("[TCP][ENVIADO] {Command}", command);
    }

    /// <summary>Registra uma resposta recebida para disponibilizá-la no log e na interface.</summary>
    internal void RegisterResponseReceived(string response)
    {
        Interlocked.Exchange(ref _lastResponseReceived, response);
        _logger.LogInformation("[TCP][RECEBIDO] {Response}", response.Replace("\r", "\\r"));
    }

    /// <summary>Limpa o histórico exibido na interface para iniciar uma nova inspeção.</summary>
    public void ClearCommunicationLog()
    {
        Interlocked.Exchange(ref _lastCommandSent, null);
        Interlocked.Exchange(ref _lastResponseReceived, null);
    }

    /// <summary>Abre a conexão usando o host e a porta definidos no appsettings.</summary>
    public async Task<bool> ConnectAsync(CancellationToken cancellationToken = default)
    {
        await _connectionLock.WaitAsync(cancellationToken);
        try
        {
            if (IsConnected)
                return true;

            CloseClient();
            var client = new TcpClient { NoDelay = true };

            // Cancela a tentativa caso a câmera não responda dentro do tempo configurado.
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(_options.ConnectTimeoutMilliseconds);

            try
            {
                await client.ConnectAsync(_options.Host, _options.Port, timeout.Token);
                _client = client;
                _logger.LogInformation("TCP conectado em {Host}:{Port}.", _options.Host, _options.Port);
                return true;
            }
            catch (Exception exception) when (exception is SocketException or OperationCanceledException)
            {
                client.Dispose();
                _logger.LogWarning(
                    "Não foi possível conectar via TCP em {Host}:{Port}: {Message}",
                    _options.Host,
                    _options.Port,
                    exception.Message);
                return false;
            }
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    /// <summary>
    /// Envia um comando genérico e lê a resposta. O CR é incluído automaticamente.
    /// </summary>
    public async Task<string> SendCommandAsync(
        string command,
        CancellationToken cancellationToken = default,
        Func<string, bool>? responseComplete = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(command);
        await _commandLock.WaitAsync(cancellationToken);

        try
        {
            if (!IsConnected && !await ConnectAsync(cancellationToken))
                throw new InvalidOperationException("Câmera não conectada via TCP.");

            var stream = _client!.GetStream();
            var normalizedCommand = command.TrimEnd('\r', '\n');
            var bytes = Encoding.ASCII.GetBytes(normalizedCommand + "\r");

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(_options.CommandTimeoutMilliseconds);

            try
            {
                RegisterCommandSent(normalizedCommand);
                await stream.WriteAsync(bytes, timeout.Token);
                await stream.FlushAsync(timeout.Token);
                var response = await ReadResponseAsync(stream, responseComplete, timeout.Token);
                RegisterResponseReceived(response);
                return response;
            }
            catch (Exception exception) when (exception is IOException or SocketException or OperationCanceledException)
            {
                // Fecha o socket com falha para que a rotina automática possa reconectar.
                CloseClient();
                throw new InvalidOperationException(
                    $"Falha ao executar o comando TCP '{normalizedCommand}'.",
                    exception);
            }
        }
        finally
        {
            _commandLock.Release();
        }
    }

    /// <summary>
    /// Envia um comando terminado em CR sem aguardar resposta do equipamento.
    /// Usado pelo reset RS da câmera Keyence.
    /// </summary>
    public async Task SendCommandWithoutResponseAsync(
        string command,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(command);
        await _commandLock.WaitAsync(cancellationToken);

        try
        {
            if (!IsConnected && !await ConnectAsync(cancellationToken))
                throw new InvalidOperationException("Câmera não conectada via TCP.");

            var normalizedCommand = command.TrimEnd('\r', '\n');
            var bytes = Encoding.ASCII.GetBytes(normalizedCommand + "\r");
            var stream = _client!.GetStream();

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(_options.CommandTimeoutMilliseconds);

            try
            {
                RegisterCommandSent(normalizedCommand);
                await stream.WriteAsync(bytes, timeout.Token);
                await stream.FlushAsync(timeout.Token);
            }
            catch (Exception exception) when (exception is IOException or SocketException or OperationCanceledException)
            {
                CloseClient();
                throw new InvalidOperationException(
                    $"Falha ao executar o comando TCP '{normalizedCommand}'.",
                    exception);
            }
        }
        finally
        {
            _commandLock.Release();
        }
    }

    /// <summary>Encerra manualmente a conexão atual.</summary>
    public Task DisconnectAsync()
    {
        CloseClient();
        return Task.CompletedTask;
    }

    /// <summary>Inicia a rotina de conexão automática junto com o backend.</summary>
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_options.AutoConnect)
            return Task.CompletedTask;

        _reconnectCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        _reconnectTask = ReconnectLoopAsync(_reconnectCancellation.Token);
        return Task.CompletedTask;
    }

    /// <summary>Interrompe a reconexão e fecha o socket durante o desligamento.</summary>
    public async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_reconnectCancellation is not null)
            await _reconnectCancellation.CancelAsync();

        if (_reconnectTask is not null)
        {
            try
            {
                await _reconnectTask.WaitAsync(cancellationToken);
            }
            catch (OperationCanceledException)
            {
                // Cancelamento esperado durante o encerramento da aplicação.
            }
        }

        CloseClient();
    }

    public async ValueTask DisposeAsync()
    {
        if (_reconnectCancellation is not null)
            await _reconnectCancellation.CancelAsync();

        CloseClient();
        _reconnectCancellation?.Dispose();
        _connectionLock.Dispose();
        _commandLock.Dispose();
    }

    // Verifica periodicamente a conexão e tenta restabelecê-la quando necessário.
    private async Task ReconnectLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            if (!IsConnected)
                await ConnectAsync(cancellationToken);

            await Task.Delay(_options.ReconnectIntervalMilliseconds, cancellationToken);
        }
    }

    // Acumula os pacotes recebidos até encontrar o final esperado da resposta.
    private static async Task<string> ReadResponseAsync(
        NetworkStream stream,
        Func<string, bool>? responseComplete,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[1024];
        var response = new StringBuilder();

        while (true)
        {
            var bytesRead = await stream.ReadAsync(buffer, cancellationToken);
            if (bytesRead == 0)
                throw new IOException("A câmera encerrou a conexão TCP.");

            response.Append(Encoding.ASCII.GetString(buffer, 0, bytesRead));
            var text = response.ToString();
            var isComplete = responseComplete?.Invoke(text) ?? text.Contains('\r');

            if (isComplete)
                return text.TrimEnd('\0', '\r', '\n');
        }
    }

    // Troca a referência de forma segura e libera os recursos da conexão anterior.
    private void CloseClient()
    {
        var client = Interlocked.Exchange(ref _client, null);
        client?.Dispose();
    }
}
