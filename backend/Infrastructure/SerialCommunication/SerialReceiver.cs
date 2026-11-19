using System.IO.Ports;
using System.Text;
using backend.Infrastructure.Keyence.Commands;
using Microsoft.Extensions.Options;

namespace backend.Infrastructure.SerialCommunication;

public sealed class SerialReceiver : BackgroundService
{
    private const int BatchSize = 3;
    private static readonly TimeSpan TriggerInterval = TimeSpan.FromMilliseconds(500);
    private static readonly TimeSpan TriggerDebounceInterval = TimeSpan.FromMilliseconds(500);

    private readonly SerialOptions _options;
    private readonly TriggerCommand _triggerCommand;
    private readonly SerialStatus _serialStatus;
    private readonly ILogger<SerialReceiver> _logger;

    public SerialReceiver(
        IOptions<SerialOptions> options,
        TriggerCommand triggerCommand,
        SerialStatus serialStatus,
        ILogger<SerialReceiver> logger)
    {
        _options = options.Value;
        _triggerCommand = triggerCommand;
        _serialStatus = serialStatus;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var ignoreTriggersUntil = DateTimeOffset.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var serialPort = new SerialPort(_options.PortName, _options.BaudRate);

                serialPort.Open();
                _logger.LogInformation("Porta serial {PortName} aberta.", _options.PortName);
                var receivedText = new StringBuilder();

                while (!stoppingToken.IsCancellationRequested)
                {
                    var chunk = serialPort.ReadExisting();
                    if (!string.IsNullOrEmpty(chunk))
                    {
                        _logger.LogInformation("Serial {PortName} recebeu: {Chunk}", _options.PortName, chunk.Replace("\r", "\\r").Replace("\n", "\\n"));
                        receivedText.Append(chunk);
                    }

                    var buffer = receivedText.ToString();
                    var triggerIndex = buffer.IndexOf("Trigger", StringComparison.OrdinalIgnoreCase);
                    if (triggerIndex >= 0)
                    {
                        receivedText.Clear();

                        if (DateTimeOffset.UtcNow < ignoreTriggersUntil)
                        {
                            _logger.LogInformation("Trigger serial duplicado ignorado.");
                            continue;
                        }

                        _logger.LogInformation("Trigger recebido pela porta serial. Disparando lote de {BatchSize} TRG.", BatchSize);
                        try
                        {
                            _serialStatus.RecordTrigger("Trigger");
                        }
                        catch
                        {
                            // Não falha a leitura por problemas no registro do status.
                        }

                        var batchResults = new string[BatchSize];
                        for (var index = 0; index < BatchSize; index++)
                        {
                            if (index > 0)
                                await Task.Delay(TriggerInterval, stoppingToken);

                            batchResults[index] = await _triggerCommand.ExecuteAsync(stoppingToken);
                            _logger.LogInformation(
                                "Resultado do TRG {Index}/{BatchSize}: {Result}.",
                                index + 1,
                                BatchSize,
                                batchResults[index]);
                        }

                        _serialStatus.RecordBatchResults(batchResults);
                        _logger.LogInformation(
                            "Lote concluído: {Results}.",
                            string.Join(", ", batchResults));

                        // Descarta acionamentos repetidos que chegaram enquanto a inspeção
                        // estava sendo processada e aplica um curto debounce após a execução.
                        serialPort.DiscardInBuffer();
                        receivedText.Clear();
                        ignoreTriggersUntil = DateTimeOffset.UtcNow.Add(TriggerDebounceInterval);
                    }

                    await Task.Delay(100, stoppingToken);
                }
            }
            catch (Exception exception) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Nao foi possivel ler a porta serial {PortName}: {Message}",
                    _options.PortName,
                    exception.Message);

                await Task.Delay(3000, stoppingToken);
            }
        }
    }
}
