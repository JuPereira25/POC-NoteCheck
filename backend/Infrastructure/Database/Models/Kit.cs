namespace backend.Infrastructure.Database.Models;

public class Kit
{
    public int Id { get; set; }
    public string SerialKit { get; set; } = string.Empty;
    public int ProdutoId { get; set; }
    public DateTime CriadoEm { get; set; }

    public Produto Produto { get; set; } = null!;
}
