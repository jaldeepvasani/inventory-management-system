using Microsoft.EntityFrameworkCore;
using InventoryApi.Data;

var builder = WebApplication.CreateBuilder(args);

// Add Controllers and native .NET 9 OpenAPI
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register In-Memory Database Context
builder.Services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase("InventoryDb"));

// Configure CORS for Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Enable native OpenAPI endpoint in development
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.Run();