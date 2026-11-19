using backend.Infrastructure.Database;
using backend.Infrastructure.Database.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/kits")]
public class KitsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public KitsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("{serialKit}")]
    public async Task<IActionResult> BuscarPorSerial(string serialKit)
    {
        var serial = serialKit?.Trim();

        if (string.IsNullOrWhiteSpace(serial))
            return BadRequest(new { mensagem = "O serial do kit é obrigatório." });

        var kits = await _dbContext.Kits
            .AsNoTracking()
            .Include(k => k.Produto)
            .Where(k => k.SerialKit == serial)
            .OrderBy(k => k.CriadoEm)
            .ThenBy(k => k.Id)
            .ToListAsync();

        if (kits.Count == 0)
            return NotFound(new { mensagem = "Kit não encontrado." });

        var produtos = kits
            .Select(k => k.Produto.Nome)
            .Where(nome => !string.IsNullOrWhiteSpace(nome))
            .ToArray();

        return Ok(new
        {
            serialKit = kits[0].SerialKit,
            steps = produtos.Select(nome => nome.ToUpperInvariant()).ToArray(),
            produtos
        });
    }
}
