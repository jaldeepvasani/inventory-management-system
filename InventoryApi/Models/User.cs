namespace InventoryApi.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string SecurityQuestion { get; set; } = string.Empty;
    public string SecurityAnswerHash { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RegisterDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string SecurityQuestion { get; set; } = string.Empty;
    public string SecurityAnswer { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}

public class LoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class GetSecurityQuestionDto
{
    public string Username { get; set; } = string.Empty;
}

public class ResetPasswordDto
{
    public string Username { get; set; } = string.Empty;
    public string SecurityAnswer { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangePasswordDto
{
    public string Username { get; set; } = string.Empty;
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class UpdateProfileDto
{
    public string Username { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
}