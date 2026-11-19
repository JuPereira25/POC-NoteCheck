namespace backend.Infrastructure.SerialCommunication;

public sealed class SerialOptions
{
    public const string SectionName = "Serial";

    public string PortName { get; set; } = string.Empty;
    public int BaudRate { get; set; }
}
