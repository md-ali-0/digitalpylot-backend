# Email Templates

This directory contains all email templates used by the application. All templates are stored as JSON files for better maintainability and separation of concerns.

## Template Structure

Each template file follows this structure:

```json
{
  "subject": "Email Subject Line",
  "template": "<!DOCTYPE html>... HTML content with Handlebars variables ..."
}
```

## Available Templates

### 1. `welcome.json`
- **Purpose**: Welcome email for new users
- **Variables**: `{{name}}`, `{{email}}`, `{{role}}`, `{{joinDate}}`, `{{loginUrl}}`

### 2. `login-notification.json`
- **Purpose**: Security notification for new login attempts
- **Variables**: `{{name}}`, `{{loginDate}}`, `{{ipAddress}}`, `{{userAgent}}`, `{{location}}`

### 3. `post-approved.json`
- **Purpose**: Notification when a post is approved
- **Variables**: `{{authorName}}`, `{{postTitle}}`, `{{publishDate}}`, `{{category}}`, `{{postUrl}}`

### 4. `post-rejected.json`
- **Purpose**: Notification when a post needs revisions
- **Variables**: `{{authorName}}`, `{{postTitle}}`, `{{submitDate}}`, `{{category}}`, `{{feedback}}`, `{{editUrl}}`

### 5. `password-reset.json`
- **Purpose**: Password reset with token link
- **Variables**: `{{name}}`, `{{resetUrl}}`, `{{expiryTime}}`

### 6. `comment-notification.json`
- **Purpose**: Notification for new comments on posts
- **Variables**: `{{authorName}}`, `{{commenterName}}`, `{{postTitle}}`, `{{commentDate}}`, `{{commentText}}`, `{{postUrl}}`

### 7. `forgot-password-otp.json`
- **Purpose**: Password reset OTP email
- **Variables**: `{{name}}`, `{{otp}}`, `{{expiryTime}}`

### 8. `forgot-password-link.json`
- **Purpose**: Password reset link email
- **Variables**: `{{name}}`, `{{resetLink}}`, `{{expiryTime}}`

### 9. `forgot-password-both.json`
- **Purpose**: Password reset email with both OTP and link options
- **Variables**: `{{name}}`, `{{otp}}`, `{{resetLink}}`, `{{expiryTime}}`
- **Note**: This template provides users with both OTP and link options in a single email

## Adding New Templates

1. Create a new JSON file in this directory
2. Follow the structure: `{"subject": "...", "template": "..."}`
3. Use Handlebars syntax for variables: `{{variableName}}`
4. The template will be automatically loaded by the EmailService

## Template Features

- **Responsive Design**: All templates are mobile-friendly
- **Professional Styling**: Consistent branding and colors
- **Security Warnings**: Appropriate security notices where needed
- **Accessibility**: Proper HTML structure and fallback text
- **Handlebars Variables**: Dynamic content insertion

## Usage in Code

```typescript
// Send email using template
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Custom Subject', // Optional, will use template subject if not provided
  template: 'template-name', // Name of the JSON file without .json extension
  context: {
    // Variables that will replace {{variableName}} in the template
    name: 'John Doe',
    email: 'john@example.com'
  }
});
```

## Maintenance

- Keep HTML clean and semantic
- Use consistent CSS classes across templates
- Test templates in different email clients
- Update variables documentation when adding new ones
- Ensure all links are properly formatted 