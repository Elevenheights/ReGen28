# Wellness App - Shared Styling System

## Overview

The styling for this wellness app has been centralized into shared files to eliminate code duplication and make maintenance easier. All common styles, colors, fonts, and configurations are now managed in a few shared files.

## Shared Files

### 1. `shared-styles.css`
Contains all the common CSS including:
- Font configurations (Inter font family)
- Color variables for light and dark themes  
- Base styling for scrollbars, highlights, etc.
- All CSS custom properties for the color system

### 2. `shared-config.js`
Contains the Tailwind CSS configuration that maps CSS variables to Tailwind classes:
- Color mappings (primary, secondary, neutral, etc.)
- Font family configuration
- Extended variants and plugins

### 3. `shared-head-basic.html`
A template showing the minimal head section that should be used in all HTML files:
- Meta tags
- External resource links (Tailwind, Font Awesome, Google Fonts)
- Links to shared files
- Font Awesome configuration

## How to Update Existing Files

To convert an existing HTML file to use the shared system:

1. **Replace the entire `<head>` section** with this minimal version:

```html
<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <!-- Basic Meta Tags -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Page Title</title>

    <!-- External Resources -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;500;600;700;800;900&display=swap">

    <!-- Shared Styles -->
    <link rel="stylesheet" href="shared-styles.css">

    <!-- Font Awesome Configuration -->
    <script>
        window.FontAwesomeConfig = {
            autoReplaceSvg: 'nest',
        };
    </script>

    <!-- Shared Tailwind Configuration -->
    <script src="shared-config.js"></script>

    <!-- Page-specific scripts (if needed) -->
    <!-- Add any page-specific scripts here, like ApexCharts for dashboard -->
</head>
```

2. **Remove all duplicate styling** from the existing files:
   - Remove all `<style>` tags containing CSS custom properties
   - Remove duplicate font links
   - Remove duplicate Tailwind configuration scripts
   - Remove duplicate Font Awesome configurations

3. **Add page-specific scripts** if needed:
   - For dashboard.html, add `<script src="https://cdn.jsdelivr.net/npm/apexcharts"></script>` before the closing `</head>` tag

## Files Already Updated

✅ **dashboard.html** - Fully updated with shared system
✅ **journal.html** - Fully updated with shared system  
✅ **tracker-management.html** - Partially updated (head section cleaned)

## Files Still Need Updating

⏳ **add-tracker.html** - Needs head section replacement
⏳ **custom-tracker.html** - Needs head section replacement
⏳ **settings.html** - Needs head section replacement
⏳ **upgrade.html** - Needs head section replacement
⏳ **login.html** - Needs head section replacement

## Benefits

1. **Consistency** - All pages use the same styling approach
2. **Maintainability** - Update colors/fonts in one place
3. **Performance** - Smaller HTML files, shared resources can be cached
4. **Developer Experience** - Less code duplication, easier to work with

## Color System

The app uses a comprehensive color system with CSS custom properties:
- **Primary**: Blue tones for main UI elements
- **Secondary**: Purple tones for secondary elements  
- **Neutral**: Gray tones for text and backgrounds
- **Accent**: Pink tones for highlights
- **Semantic**: Success (green), warning (yellow), error (red), info (blue)

All colors automatically support light/dark theme switching through CSS custom properties.

## Next Steps

1. Update the remaining HTML files using the pattern above
2. Test all pages to ensure styling works correctly
3. Consider creating a build process to automatically inject the shared head section
4. Add any page-specific styling as needed while keeping the shared foundation 