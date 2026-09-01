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
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest("Username and password are required.");

        if (dto.Username.Contains(" "))
            return BadRequest("Username cannot contain spaces.");

        if (string.IsNullOrWhiteSpace(dto.SecurityQuestion) || string.IsNullOrWhiteSpace(dto.SecurityAnswer))
            return BadRequest("Security question and answer are required.");

        var passwordErrors = ValidatePassword(dto.Password);
        if (passwordErrors.Any())
            return BadRequest(string.Join(" ", passwordErrors));

        var exists = await _context.Users.AnyAsync(u => u.Username.ToLower() == dto.Username.ToLower());
        if (exists)
            return BadRequest("Username already taken.");

        var user = new User
        {
            Username = dto.Username.Trim(),
            PasswordHash = HashString(dto.Password),
            SecurityQuestion = dto.SecurityQuestion.Trim(),
            SecurityAnswerHash = HashString(dto.SecurityAnswer.Trim().ToLowerInvariant()),
            AvatarUrl = string.IsNullOrWhiteSpace(dto.AvatarUrl) ? "" : dto.AvatarUrl
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { username = user.Username, message = "Registration successful! Please sign in." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var hash = HashString(dto.Password);
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.ToLower() && u.PasswordHash == hash);

        if (user == null)
            return Unauthorized("Invalid username or password.");

        return Ok(new { username = user.Username, avatarUrl = user.AvatarUrl });
    }

    // 1. Get Security Question for Forgot Password
    [HttpPost("get-question")]
    public async Task<IActionResult> GetSecurityQuestion([FromBody] GetSecurityQuestionDto dto)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower());

        if (user == null)
            return NotFound("User not found.");

        return Ok(new { question = user.SecurityQuestion });
    }

    // 2. Reset Password via Security Question Verification
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower());

        if (user == null)
            return NotFound("User not found.");

        var answerHash = HashString(dto.SecurityAnswer.Trim().ToLowerInvariant());
        if (user.SecurityAnswerHash != answerHash)
            return BadRequest("Incorrect answer to security question.");

        var passwordErrors = ValidatePassword(dto.NewPassword);
        if (passwordErrors.Any())
            return BadRequest(string.Join(" ", passwordErrors));

        user.PasswordHash = HashString(dto.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password reset successfully! Please sign in with your new password." });
    }

    // 3. Change Password from Profile Settings
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var currentHash = HashString(dto.CurrentPassword);
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower() && u.PasswordHash == currentHash);

        if (user == null)
            return BadRequest("Current password is incorrect.");

        var passwordErrors = ValidatePassword(dto.NewPassword);
        if (passwordErrors.Any())
            return BadRequest(string.Join(" ", passwordErrors));

        user.PasswordHash = HashString(dto.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password changed successfully!" });
    }

    // 4. Update Profile Avatar
    [HttpPost("update-profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == dto.Username.Trim().ToLower());

        if (user == null)
            return NotFound("User not found.");

        user.AvatarUrl = dto.AvatarUrl;
        await _context.SaveChangesAsync();

        return Ok(new { username = user.Username, avatarUrl = user.AvatarUrl, message = "Profile updated!" });
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

    private static string HashString(string input)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToBase64String(bytes);
    }
}