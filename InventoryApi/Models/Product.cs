namespace InventoryApi.Models;

public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int StockQuantity { get; set; }
    public string LastModifiedBy { get; set; } = "System";
    public DateTime LastModifiedAt { get; set; } = DateTime.UtcNow;
}

public class StockUpdateDto
{
    public int Change { get; set; }
    public string Username { get; set; } = "Anonymous";
}