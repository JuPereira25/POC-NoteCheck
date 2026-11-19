namespace backend.Infrastructure.Tcp;

/// <summary>
/// Configurações usadas para abrir e manter a comunicação TCP com a câmera.
/// Os valores são carregados da seção "Tcp" do appsettings.json.
/// </summary>
public sealed class TcpOptions
{
    public const string SectionName = "Tcp";

    /// <summary>Endereço IP ou nome de rede da câmera.</summary>
    public string Host { get; set; } = string.Empty;

    /// <summary>Porta TCP configurada no equipamento Keyence.</summary>
    public int Port { get; set; } = 8500;

    /// <summary>Tempo máximo para estabelecer uma conexão.</summary>
    public int ConnectTimeoutMilliseconds { get; set; } = 3000;

    /// <summary>Tempo máximo para enviar um comando e receber sua resposta.</summary>
    public int CommandTimeoutMilliseconds { get; set; } = 5000;

    /// <summary>Intervalo entre as tentativas automáticas de reconexão.</summary>
    public int ReconnectIntervalMilliseconds { get; set; } = 5000;

    /// <summary>Indica se o backend deve tentar conectar assim que iniciar.</summary>
    public bool AutoConnect { get; set; } = true;
}
