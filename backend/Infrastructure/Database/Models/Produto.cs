namespace backend.Infrastructure.Database.Models;

public class Produto
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public int Qtd { get; set; }
    public bool Status { get; set; }
    public string? Qrcode { get; set; }
    public DateTime CriadoEm { get; set; }

    public ICollection<Kit> Kits { get; set; } = new List<Kit>();
}
