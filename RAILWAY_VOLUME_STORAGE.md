# Railway Volume Storage Implementation

## Overview
Updated file upload system to use Railway's persistent volume storage at `/app/uploads` for production deployment.

## Changes Made

### 1. Multer Configuration Update
- **File**: `index.js` (lines 95-120)
- **Changes**: Updated storage destination to use Railway volume
- **Production Path**: `/app/uploads`
- **Development Path**: `./uploads`

```javascript
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use Railway volume in production, local uploads in development
    const uploadPath = process.env.NODE_ENV === 'production' ? '/app/uploads' : './uploads';
    // ... rest of the logic
  }
});
```

### 2. Static File Serving
- **File**: `index.js` (lines 81-84)
- **Changes**: Added `/uploads` route for serving uploaded files
- **Security**: Files served through Express static middleware with proper headers

```javascript
// Serve uploaded files from Railway volume
app.use('/uploads', express.static('/app/uploads'));
console.log('📁 File serving enabled at /uploads endpoint');
```

### 3. University ID Card Support
- **Model**: Added `universityIdCard` field to User schema
- **Upload Handling**: Added support for both profile images and university cards
- **Team Members**: Extended file upload support to team member university cards

### 4. File URL Generation Updates
- **Profile Images**: Updated to use `/uploads/filename` path
- **Team Member Images**: Updated memberImageMap to use `/uploads/` prefix
- **University Cards**: New memberCardMap for university card file handling

## File Upload Fields

### Main Person Files
- `profileImage`: Profile photo upload
- `universityIdCard`: University identification card upload

### Team Member Files
- `memberImage__[signature]__[index]`: Team member profile photos
- `memberUniversityCard__[signature]__[index]`: Team member university cards

## Frontend Integration

### Form Fields Required
```html
<!-- Main person uploads -->
<input type="file" name="profileImage" accept="image/*">
<input type="file" name="universityIdCard" accept="image/*">

<!-- Team member uploads (dynamic naming) -->
<input type="file" name="memberImage__${signature}__${index}" accept="image/*">
<input type="file" name="memberUniversityCard__${signature}__${index}" accept="image/*">
```

### File Access URLs
- **Profile Images**: `/uploads/filename.ext`
- **University Cards**: `/uploads/filename.ext`
- **Team Member Files**: `/uploads/filename.ext`

## Database Schema Updates

### User Model Fields
```javascript
{
  profileImage: String,      // Profile photo path
  universityIdCard: String,  // University ID card path
  // ... other fields
}
```

## Security Features
- ✅ File size limits (5MB per file)
- ✅ File type validation (images only)
- ✅ Secure filename generation
- ✅ Windows-safe filenames
- ✅ Railway volume persistent storage

## Testing

### Verify File Storage
1. Upload files through registration form
2. Check files are stored in `/app/uploads` (production) or `./uploads` (development)
3. Verify files are accessible via `/uploads/filename` URLs
4. Confirm database stores correct file paths

### Production Deployment
1. Files persist across Railway deployments
2. Volume mounted at `/app/` in Railway environment
3. Static file serving works correctly
4. University card uploads function for both main person and team members

## Benefits
- 🏗️ **Persistent Storage**: Files survive Railway redeploys
- 🚀 **Performance**: Direct file serving through Express
- 🔒 **Security**: Controlled file access and validation
- 📱 **Scalability**: Supports team member file uploads
- 🎓 **Enhanced Features**: University ID card storage for verification
