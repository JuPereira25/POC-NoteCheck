using backend.Infrastructure.Database;
using backend.Infrastructure.Database.Models;
using backend.Infrastructure.SerialCommunication;
using backend.Infrastructure.Tcp;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("PostgreSql")));
builder.Services.AddCors(options =>
{
    // A API escuta apenas em loopback; permite tambem o renderer file:// do Electron.
    options.AddDefaultPolicy(policy => policy
        .AllowAnyOrigin()
        .AllowAnyHeader()
        .AllowAnyMethod());
});
// Registra a conexão e os comandos TCP da câmera.
builder.Services.AddTcpCamera(builder.Configuration);
builder.Services.Configure<SerialOptions>(
    builder.Configuration.GetSection(SerialOptions.SectionName));
builder.Services.AddSingleton<SerialStatus>();
builder.Services.AddHostedService<SerialReceiver>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.MapControllers();
// Expõe as operações em /api/tcp.
app.MapTcpEndpoints();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast");

try
{
    await using var warmupScope = app.Services.CreateAsyncScope();
    var dbContext = warmupScope.ServiceProvider.GetRequiredService<AppDbContext>();

    await dbContext.Database.OpenConnectionAsync();
    await dbContext.Kits.AsNoTracking().AnyAsync();
    await dbContext.Database.CloseConnectionAsync();
}
catch (Exception exception)
{
    app.Logger.LogWarning(
        exception,
        "Nao foi possivel aquecer a conexao com o banco de dados. A aplicacao continuara iniciando.");
}

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
