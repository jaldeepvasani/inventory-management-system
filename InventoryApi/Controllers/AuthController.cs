using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using InventoryApi.Data;
using InventoryApi.Models;

namespace InventoryApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;

    public AuthController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] AuthDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest("Username and password are required.");

        if (dto.Username.Contains(" "))
            return BadRequest("Username cannot contain spaces.");

        // Password complexity validation
        var passwordErrors = ValidatePassword(dto.Password);
        if (passwordErrors.Any())
        {
            return BadRequest(string.Join(" ", passwordErrors));
        }

        var exists = await _context.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.ToLower());
        if (exists)
            return BadRequest("Username already taken.");

        var user = new User
        {
            Username = dto.Username.Trim(),
            PasswordHash = HashPassword(dto.Password)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { username = user.Username, message = "Registration successful! Please sign in." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AuthDto dto)
    {
        var hash = HashPassword(dto.Password);
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.ToLower() && u.PasswordHash == hash);

        if (user == null)
            return Unauthorized("Invalid username or password.");

        return Ok(new { username = user.Username });
    }

    private static List<string> ValidatePassword(string password)
    {
        var errors = new List<string>();

        if (password.Length < 8)
            errors.Add("Password must be at least 8 characters long.");
        if (password.Contains(' '))
            errors.Add("Password cannot contain spaces.");
        if (!Regex.IsMatch(password, @"[A-Z]"))
            errors.Add("Password must contain at least one uppercase letter.");
        if (!Regex.IsMatch(password, @"[0-9]"))
            errors.Add("Password must contain at least one number.");
        if (!Regex.IsMatch(password, @"[^a-zA-Z0-9\s]"))
            errors.Add("Password must contain at least one special character.");

        return errors;
    }

    private static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(bytes);
    }
}