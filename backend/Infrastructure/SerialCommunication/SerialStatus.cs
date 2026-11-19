namespace backend.Infrastructure.SerialCommunication;

/// <summary>
/// Serviço singleton que armazena o último evento de trigger vindo pela serial,
/// para expor ao frontend através do endpoint de status.
/// </summary>
public sealed class SerialStatus
{
    private string? _lastTriggerReceived;
    private string? _lastInspectionResult;
    private string[]? _lastBatchResults;
    private long _inspectionSequence;
    private long _batchStartSequence;

    public string? LastTriggerReceived => Volatile.Read(ref _lastTriggerReceived);
    public string? LastInspectionResult => Volatile.Read(ref _lastInspectionResult);
    public string[]? LastBatchResults => Volatile.Read(ref _lastBatchResults);
    public long InspectionSequence => Interlocked.Read(ref _inspectionSequence);
    public long BatchStartSequence => Interlocked.Read(ref _batchStartSequence);

    public void RecordTrigger(string message)
    {
        Volatile.Write(ref _lastTriggerReceived, message);
        Interlocked.Increment(ref _batchStartSequence);
    }

    public void RecordInspectionResult(string result)
    {
        Volatile.Write(ref _lastInspectionResult, result);
        Volatile.Write(ref _lastBatchResults, new[] { result });
        Interlocked.Increment(ref _inspectionSequence);
    }

    public void RecordBatchResults(string[] results)
    {
        ArgumentNullException.ThrowIfNull(results);

        Volatile.Write(ref _lastBatchResults, results);
        Volatile.Write(
            ref _lastInspectionResult,
            results.Length > 0 && results.All(static result => result == "PASS") ? "PASS" : "FAIL");
        Interlocked.Increment(ref _inspectionSequence);
    }

    public void Clear()
    {
        Volatile.Write(ref _lastTriggerReceived, null);
        Volatile.Write(ref _lastInspectionResult, null);
        Volatile.Write(ref _lastBatchResults, null);
    }
}
