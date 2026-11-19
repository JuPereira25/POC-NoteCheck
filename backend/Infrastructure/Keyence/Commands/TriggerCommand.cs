using backend.Infrastructure.Tcp;

namespace backend.Infrastructure.Keyence.Commands;

/// <summary>
/// Comando da camera Keyence que dispara uma inspecao.
/// </summary>
public sealed class TriggerCommand
{
    private readonly TcpConnection _tcp;

    public TriggerCommand(TcpConnection tcp)
    {
        _tcp = tcp;
    }

    public async Task<string> ExecuteAsync(CancellationToken cancellationToken = default)
    {
        string result;

        try
        {
            result = await _tcp.SendCommandAsync(
                "TRG",
                cancellationToken,
                response =>
                    response.Contains("TRG\r0", StringComparison.OrdinalIgnoreCase) ||
                    response.Contains("TRG\r1", StringComparison.OrdinalIgnoreCase));
        }
        catch (InvalidOperationException)
        {
            return "FAIL";
        }

        if (result.Contains("TRG\r1", StringComparison.OrdinalIgnoreCase))
            return "PASS";

        return "FAIL";
    }
}
