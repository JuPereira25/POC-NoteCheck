using backend.Infrastructure.Tcp;

namespace backend.Infrastructure.Keyence.Commands;

/// <summary>
/// Envia o comando RS para resetar a câmera Keyence e consome sua confirmação,
/// evitando que ela seja lida junto com o próximo TRG.
/// </summary>
public sealed class ResetCommand
{
    private readonly TcpConnection _tcp;

    public ResetCommand(TcpConnection tcp)
    {
        _tcp = tcp;
    }

    public async Task<bool> ExecuteAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await _tcp.SendCommandAsync(
                "RS",
                cancellationToken,
                response => response.Contains("RS", StringComparison.OrdinalIgnoreCase));
            return true;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }
}
