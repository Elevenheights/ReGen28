// Shared Tailwind Configuration for Wellness App
tailwind.config = {
    "theme": {
        "extend": {
            "colors": {
                "transparent": "transparent",
                "current": "currentColor",
                "black": "#000000",
                "white": "#ffffff",
                "primary": {
                    "50": "var(--color-primary-50)",
                    "100": "var(--color-primary-100)",
                    "200": "var(--color-primary-200)",
                    "300": "var(--color-primary-300)",
                    "400": "var(--color-primary-400)",
                    "500": "var(--color-primary-500)",
                    "600": "var(--color-primary-600)",
                    "700": "var(--color-primary-700)",
                    "800": "var(--color-primary-800)",
                    "900": "var(--color-primary-900)",
                    "DEFAULT": "var(--color-primary)",
                    "focus": "var(--color-primary-focus)",
                    "content": "var(--color-primary-content)"
                },
                "neutral": {
                    "50": "var(--color-neutral-50)",
                    "100": "var(--color-neutral-100)",
                    "200": "var(--color-neutral-200)",
                    "300": "var(--color-neutral-300)",
                    "400": "var(--color-neutral-400)",
                    "500": "var(--color-neutral-500)",
                    "600": "var(--color-neutral-600)",
                    "700": "var(--color-neutral-700)",
                    "800": "var(--color-neutral-800)",
                    "900": "var(--color-neutral-900)",
                    "DEFAULT": "var(--color-neutral)",
                    "focus": "var(--color-neutral-focus)",
                    "content": "var(--color-neutral-content)"
                }
            },
            "fontFamily": {
                "sans": ["Inter", "sans-serif"]
            }
        }
    },
    "variants": {
        "extend": {
            "backgroundColor": ["active", "group-hover"],
            "textColor": ["active", "group-hover"]
        }
    },
    "plugins": []
}; 