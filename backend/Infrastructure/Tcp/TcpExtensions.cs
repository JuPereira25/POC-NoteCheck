using backend.Infrastructure.Keyence.Commands;

namespace backend.Infrastructure.Tcp;

/// <summary>
/// Centraliza o registro da comunicação TCP, das rotas HTTP e dos comandos
/// específicos que utilizam essa conexão.
/// </summary>
public static class TcpExtensions
{
    /// <summary>Registra configuração, conexão e comandos TCP na aplicação.</summary>
    public static IServiceCollection AddTcpCamera(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Carrega e valida a seção "Tcp" antes de iniciar o backend.
        services.AddOptions<TcpOptions>()
            .Bind(configuration.GetSection(TcpOptions.SectionName))
            .Validate(options => !string.IsNullOrWhiteSpace(options.Host), "Tcp:Host é obrigatório.")
            .Validate(options => options.Port is > 0 and <= 65535, "Tcp:Port é inválida.")
            .Validate(options => options.ConnectTimeoutMilliseconds > 0, "Timeout de conexão inválido.")
            .Validate(options => options.CommandTimeoutMilliseconds > 0, "Timeout de comando inválido.")
            .Validate(options => options.ReconnectIntervalMilliseconds > 0, "Intervalo de reconexão inválido.")
            .ValidateOnStart();

        // Uma única conexão é compartilhada por toda a aplicação.
        services.AddSingleton<TcpConnection>();
        services.AddSingleton<IHostedService>(provider => provider.GetRequiredService<TcpConnection>());
        services.AddTransient<ResetCommand>();
        services.AddTransient<TriggerCommand>();
        return services;
    }

    /// <summary>Disponibiliza as operações TCP para o frontend através de HTTP.</summary>
    public static IEndpointRouteBuilder MapTcpEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/tcp").WithTags("TCP");

        // Retorna apenas o estado atual da conexão.
        group.MapGet("/status", (TcpConnection connection, backend.Infrastructure.SerialCommunication.SerialStatus serialStatus) =>
            Results.Ok(new
            {
                connected = connection.IsConnected,
                lastCommandSent = connection.LastCommandSent,
                lastResponseReceived = connection.LastResponseReceived,
                lastSerialTrigger = serialStatus.LastTriggerReceived,
                lastInspectionResult = serialStatus.LastInspectionResult,
                batchResults = serialStatus.LastBatchResults,
                batchStartSequence = serialStatus.BatchStartSequence,
                inspectionSequence = serialStatus.InspectionSequence
            }));

        // Solicita uma conexão imediata, sem esperar a próxima reconexão automática.
        group.MapPost("/connect", async (TcpConnection connection, CancellationToken token) =>
        {
            var connected = await connection.ConnectAsync(token);
            return connected
                ? Results.Ok(new { connected = true })
                : Results.Json(
                    new { connected = false, error = "Não foi possível estabelecer a conexão TCP." },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
        });

        // Fecha a conexão atual.
        group.MapPost("/disconnect", async (TcpConnection connection) =>
        {
            await connection.DisconnectAsync();
            return Results.Ok(new { connected = false });
        });

        // Reseta a câmera ao pressionar STOP ou ao concluir todas as etapas do teste.
        group.MapPost("/reset", async (
            ResetCommand reset,
            TcpConnection connection,
            backend.Infrastructure.SerialCommunication.SerialStatus serialStatus,
            CancellationToken token) =>
        {
            var resetSent = await reset.ExecuteAsync(token);
            connection.ClearCommunicationLog();
            serialStatus.Clear();

            return resetSent
                ? Results.NoContent()
                : Results.Json(
                    new { error = "Não foi possível enviar o reset para a câmera." },
                    statusCode: StatusCodes.Status503ServiceUnavailable);
        });

        // Permite enviar outros comandos suportados pela câmera.
        group.MapPost("/commands", async (
            TcpCommandRequest request,
            TcpConnection connection,
            CancellationToken token) =>
        {
            if (string.IsNullOrWhiteSpace(request.Command))
                return Results.BadRequest(new { error = "O comando é obrigatório." });

            var response = await connection.SendCommandAsync(request.Command, token);
            return Results.Ok(new { response });
        });

        return endpoints;
    }
}

/// <summary>Corpo recebido pelo endpoint de comandos TCP genéricos.</summary>
public sealed record TcpCommandRequest(string Command);
