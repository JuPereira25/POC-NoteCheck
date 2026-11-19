using backend.Infrastructure.Database.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Infrastructure.Database;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<Kit> Kits => Set<Kit>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Produto>(entity =>
        {
            entity.ToTable("produto");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Id).HasColumnName("id");
            entity.Property(p => p.Nome).HasColumnName("nome");
            entity.Property(p => p.Qtd).HasColumnName("qtd");
            entity.Property(p => p.Status).HasColumnName("status");
            entity.Property(p => p.Qrcode).HasColumnName("qrcode");
            entity.Property(p => p.CriadoEm).HasColumnName("criado_em");
        });

        modelBuilder.Entity<Kit>(entity =>
        {
            entity.ToTable("kit");
            entity.HasKey(k => k.Id);
            entity.Property(k => k.Id).HasColumnName("id");
            entity.Property(k => k.SerialKit).HasColumnName("serial_kit");
            entity.Property(k => k.ProdutoId).HasColumnName("produto_id");
            entity.Property(k => k.CriadoEm).HasColumnName("criado_em");
            entity.HasOne(k => k.Produto)
                .WithMany(p => p.Kits)
                .HasForeignKey(k => k.ProdutoId);
        });
    }
}
