using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InventoryApi.Data;
using InventoryApi.Models;

namespace InventoryApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProductsController(AppDbContext context)
    {
        _context = context;
    }

    // GET: api/products
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
    {
        return await _context.Products.OrderByDescending(p => p.LastModifiedAt).ToListAsync();
    }

    // POST: api/products
    [HttpPost]
    public async Task<ActionResult<Product>> CreateProduct(Product product)
    {
        if (product.Price < 0 || product.StockQuantity < 0)
            return BadRequest("Price and Stock cannot be negative.");

        product.LastModifiedAt = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(product.LastModifiedBy))
            product.LastModifiedBy = "Anonymous";

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProducts), new { id = product.Id }, product);
    }

    // PUT: api/products/5
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProduct(int id, Product updatedProduct)
    {
        if (id != updatedProduct.Id)
            return BadRequest("Product ID mismatch.");

        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound("Product not found.");

        product.Name = updatedProduct.Name;
        product.Price = updatedProduct.Price;
        product.StockQuantity = updatedProduct.StockQuantity;
        product.LastModifiedBy = string.IsNullOrWhiteSpace(updatedProduct.LastModifiedBy) ? "Anonymous" : updatedProduct.LastModifiedBy;
        product.LastModifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(product);
    }

    // PATCH: api/products/5/stock
    [HttpPatch("{id}/stock")]
    public async Task<IActionResult> UpdateStock(int id, [FromBody] StockUpdateDto dto)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound("Product not found.");

        if (product.StockQuantity + dto.Change < 0)
            return BadRequest("Stock level cannot be negative.");

        product.StockQuantity += dto.Change;
        product.LastModifiedBy = string.IsNullOrWhiteSpace(dto.Username) ? "Anonymous" : dto.Username;
        product.LastModifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(product);
    }

    // DELETE: api/products/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound();

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}